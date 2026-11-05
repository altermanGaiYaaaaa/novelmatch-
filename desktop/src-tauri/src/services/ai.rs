use std::time::{Duration, Instant};

use reqwest::Client;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;

use crate::db::Database;
use crate::error::{CommandError, CommandResult};
use crate::models::TestConnectionResult;
use crate::services::{keyring_store, prompts};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(35);

#[derive(Clone)]
pub struct AiClient {
    http: Client,
    model: String,
    base_url: String,
    api_key: String,
}

impl AiClient {
    pub fn new(http: Client, model: String, base_url: String, api_key: String) -> Self {
        Self {
            http,
            model,
            base_url,
            api_key,
        }
    }

    pub fn from_database(db: &Database, http: &Client) -> CommandResult<Self> {
        let model = db
            .get_setting("model_name")?
            .unwrap_or_default()
            .trim()
            .to_string();
        let base_url = db
            .get_setting("base_url")?
            .unwrap_or_default()
            .trim()
            .to_string();
        if model.is_empty() || base_url.is_empty() {
            return Err(CommandError::new(
                "MODEL_NOT_CONFIGURED",
                "尚未配置模型，请先在「模型设置」中填写 API Key、模型名称和接口地址。",
            ));
        }
        let api_key = keyring_store::get_api_key(db)?.ok_or_else(|| {
            CommandError::new(
                "MODEL_NOT_CONFIGURED",
                "尚未保存 API Key，请先在「模型设置」中完成配置。",
            )
        })?;
        let base_url = normalize_base_url(&base_url)?;
        Ok(Self::new(http.clone(), model, base_url, api_key))
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn endpoint(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }

    pub async fn chat_json<T: DeserializeOwned>(
        &self,
        system: &str,
        user: &str,
        token: &CancellationToken,
    ) -> CommandResult<T> {
        let content = self.request(system, user, token, REQUEST_TIMEOUT).await?;
        match parse_json::<T>(&content) {
            Ok(value) => Ok(value),
            Err(first_error) => {
                let repair_user = format!(
                    "下面这段内容本应是一个合法的 JSON 对象，但解析失败了。请保持原意，修复为严格合法的 JSON，只输出 JSON 本身。\n\n解析错误：{}\n\n原始内容：\n{}",
                    first_error, content
                );
                let repaired = self
                    .request(prompts::REPAIR_SYSTEM, &repair_user, token, REQUEST_TIMEOUT)
                    .await?;
                parse_json::<T>(&repaired).map_err(|error| {
                    CommandError::new(
                        "AI_INVALID_JSON",
                        format!("模型返回的内容不是有效的结构化数据：{error}"),
                    )
                })
            }
        }
    }

    async fn request(
        &self,
        system: &str,
        user: &str,
        token: &CancellationToken,
        timeout: Duration,
    ) -> CommandResult<String> {
        let body = json!({
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "temperature": 0.3,
            "stream": false
        });

        let mut last_message = String::new();
        for attempt in 0..3u32 {
            if token.is_cancelled() {
                return Err(CommandError::cancelled());
            }

            let response = tokio::select! {
                _ = token.cancelled() => return Err(CommandError::cancelled()),
                result = self.http
                    .post(self.endpoint())
                    .bearer_auth(&self.api_key)
                    .header("Accept", "application/json")
                    .json(&body)
                    .timeout(timeout)
                    .send() => result,
            };

            let response = match response {
                Ok(value) => value,
                Err(error) => {
                    let message = if error.is_timeout() {
                        "模型请求超时，请检查网络或稍后重试。".to_string()
                    } else if error.is_connect() {
                        "无法连接到模型服务，请检查接口地址与网络。".to_string()
                    } else {
                        format!("模型请求失败：{error}")
                    };
                    last_message = message;
                    if attempt < 2 && (error.is_timeout() || error.is_connect()) {
                        sleep_or_cancel(700 * u64::from(attempt + 1), token).await?;
                        continue;
                    }
                    return Err(CommandError::new("NETWORK_ERROR", last_message));
                }
            };

            let status = response.status();
            if status.is_success() {
                let text = response.text().await.map_err(|error| {
                    CommandError::new("NETWORK_ERROR", format!("读取模型响应失败：{error}"))
                })?;
                let value: Value = serde_json::from_str(&text).map_err(|_| {
                    CommandError::new("AI_INVALID_RESPONSE", "模型返回的不是 JSON 响应。")
                })?;
                let content = extract_content(&value).ok_or_else(|| {
                    CommandError::new("AI_INVALID_RESPONSE", "模型响应中没有可用的文本内容。")
                })?;
                if content.trim().is_empty() {
                    return Err(CommandError::new(
                        "AI_EMPTY_RESPONSE",
                        "模型返回了空内容，请稍后重试。",
                    ));
                }
                return Ok(content.trim().to_string());
            }

            let status_code = status.as_u16();
            let body_text = response.text().await.unwrap_or_default();
            let detail = extract_api_error(&body_text);

            let message = match status_code {
                401 | 403 => {
                    return Err(CommandError::new(
                        "API_KEY_INVALID",
                        "API Key 无效或没有访问权限，请检查「模型设置」中的配置。",
                    ));
                }
                404 => {
                    return Err(CommandError::new(
                        "MODEL_NOT_FOUND",
                        "接口地址或模型名称不正确。请确认 Base URL 和模型名称与你的服务商一致。",
                    ));
                }
                429 => "请求频率受限，正在等待重试…".to_string(),
                500..=599 => "模型服务暂时不可用，正在等待重试…".to_string(),
                _ => {
                    if detail.is_empty() {
                        format!("模型服务返回了 HTTP {status_code}。")
                    } else {
                        format!("模型服务返回了 HTTP {status_code}：{detail}")
                    }
                }
            };

            last_message = message;
            if (status_code == 429 || status_code >= 500) && attempt < 2 {
                sleep_or_cancel(1000 * u64::from(attempt + 1), token).await?;
                continue;
            }

            let code = match status_code {
                429 => "RATE_LIMITED",
                500..=599 => "MODEL_SERVICE_ERROR",
                _ => "MODEL_ERROR",
            };
            return Err(CommandError::new(code, last_message));
        }

        Err(CommandError::new(
            "MODEL_ERROR",
            if last_message.is_empty() {
                "模型请求失败，请稍后重试。".to_string()
            } else {
                last_message
            },
        ))
    }

    pub async fn test_connection(
        &self,
        token: &CancellationToken,
    ) -> CommandResult<TestConnectionResult> {
        let started = Instant::now();
        let content = self
            .request(
                "你是连通性测试助手。",
                "请只回复 OK 两个字符。",
                token,
                CONNECT_TIMEOUT,
            )
            .await?;
        let latency = started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
        Ok(TestConnectionResult {
            ok: true,
            message: format!(
                "连接成功，模型返回：{}",
                content.chars().take(40).collect::<String>()
            ),
            latency_ms: latency,
            model_name: self.model.clone(),
        })
    }
}

pub fn normalize_base_url(value: &str) -> CommandResult<String> {
    let trimmed = value.trim().trim_end_matches('/');
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(CommandError::validation(
            "模型网址需以 http:// 或 https:// 开头。",
        ));
    }
    let normalized = trimmed
        .strip_suffix("/chat/completions")
        .unwrap_or(trimmed)
        .trim_end_matches('/')
        .to_string();
    if normalized.is_empty() {
        return Err(CommandError::validation("模型网址不能为空。"));
    }
    Ok(normalized)
}

async fn sleep_or_cancel(milliseconds: u64, token: &CancellationToken) -> CommandResult<()> {
    tokio::select! {
        _ = token.cancelled() => Err(CommandError::cancelled()),
        _ = tokio::time::sleep(Duration::from_millis(milliseconds)) => Ok(()),
    }
}

fn extract_content(value: &Value) -> Option<String> {
    let content = value.pointer("/choices/0/message/content")?;
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }
    if let Some(parts) = content.as_array() {
        let text = parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.as_str())
            })
            .collect::<Vec<_>>()
            .join("");
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

fn extract_api_error(raw: &str) -> String {
    if let Ok(value) = serde_json::from_str::<Value>(raw) {
        if let Some(message) = value
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| value.get("message").and_then(Value::as_str))
        {
            return message.chars().take(220).collect();
        }
    }
    let collapsed = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.chars().take(220).collect()
}

fn parse_json<T: DeserializeOwned>(raw: &str) -> Result<T, String> {
    let cleaned = strip_code_fence(raw);
    let candidate = if let (Some(start), Some(end)) = (cleaned.find('{'), cleaned.rfind('}')) {
        if end > start {
            &cleaned[start..=end]
        } else {
            cleaned.as_str()
        }
    } else {
        cleaned.as_str()
    };
    serde_json::from_str::<T>(candidate).map_err(|error| error.to_string())
}

fn strip_code_fence(raw: &str) -> String {
    let trimmed = raw.trim();
    if !trimmed.starts_with("```") {
        return trimmed.to_string();
    }
    let without_open = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```JSON"))
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed);
    without_open
        .trim_start()
        .strip_suffix("```")
        .unwrap_or(without_open)
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_base_urls() {
        assert_eq!(
            normalize_base_url("https://api.deepseek.com/").unwrap(),
            "https://api.deepseek.com"
        );
        assert_eq!(
            normalize_base_url("https://api.openai.com/v1/chat/completions").unwrap(),
            "https://api.openai.com/v1"
        );
        assert!(normalize_base_url("api.example.com").is_err());
    }

    #[test]
    fn extracts_json_from_fenced_response() {
        let value = parse_json::<Value>("```json\n{\"ok\":true}\n```").unwrap();
        assert_eq!(value["ok"], true);
    }
}
