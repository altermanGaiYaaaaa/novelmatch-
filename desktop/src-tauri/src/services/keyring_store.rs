use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use keyring::Entry;

use crate::db::Database;
use crate::error::{CommandError, CommandResult};

const SERVICE: &str = "NovelMatch";
const ACCOUNT: &str = "model-api-key";
const DEV_FALLBACK_KEY: &str = "dev_model_api_key";

fn entry() -> CommandResult<Entry> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| {
        CommandError::new("KEYRING_ERROR", format!("无法访问系统凭据存储：{error}"))
    })
}

pub fn set_api_key(db: &Database, api_key: &str) -> CommandResult<()> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(CommandError::validation("API Key 不能为空。"));
    }

    match entry().and_then(|item| {
        item.set_password(api_key).map_err(|error| {
            CommandError::new("KEYRING_ERROR", format!("保存 API Key 失败：{error}"))
        })
    }) {
        Ok(()) => {
            let _ = db.delete_setting(DEV_FALLBACK_KEY);
            Ok(())
        }
        Err(error) => {
            // 仅在没有系统凭据服务的开发环境中回退，方便本地联调。
            if cfg!(debug_assertions) && !cfg!(windows) {
                eprintln!(
                    "warning: 系统凭据存储不可用，开发环境回退到本地文件：{}",
                    error.message
                );
                db.set_setting(DEV_FALLBACK_KEY, &STANDARD.encode(api_key.as_bytes()))?;
                Ok(())
            } else {
                Err(error)
            }
        }
    }
}

pub fn get_api_key(db: &Database) -> CommandResult<Option<String>> {
    match entry().and_then(|item| match item.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(CommandError::new(
            "KEYRING_ERROR",
            format!("读取 API Key 失败：{error}"),
        )),
    }) {
        Ok(Some(value)) => Ok(Some(value)),
        Ok(None) => read_dev_fallback(db),
        Err(error) => {
            if cfg!(debug_assertions) && !cfg!(windows) {
                eprintln!(
                    "warning: 读取系统凭据失败，尝试开发环境回退：{}",
                    error.message
                );
                read_dev_fallback(db)
            } else {
                eprintln!("warning: 读取系统凭据失败：{}", error.message);
                Ok(None)
            }
        }
    }
}

fn read_dev_fallback(db: &Database) -> CommandResult<Option<String>> {
    let Some(encoded) = db.get_setting(DEV_FALLBACK_KEY)? else {
        return Ok(None);
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| CommandError::new("KEYRING_ERROR", "本地 API Key 记录已损坏，请重新保存。"))?;
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| CommandError::new("KEYRING_ERROR", "本地 API Key 记录已损坏，请重新保存。"))
}

pub fn delete_api_key(db: &Database) -> CommandResult<()> {
    if let Ok(item) = entry() {
        match item.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => {
                eprintln!("warning: 删除系统凭据失败：{error}");
            }
        }
    }
    let _ = db.delete_setting(DEV_FALLBACK_KEY);
    Ok(())
}

pub fn mask_api_key(api_key: &str) -> String {
    let chars: Vec<char> = api_key.chars().collect();
    if chars.len() > 8 {
        let head: String = chars.iter().take(3).collect();
        let tail: String = chars.iter().skip(chars.len().saturating_sub(4)).collect();
        format!("{head}••••{tail}")
    } else if chars.is_empty() {
        String::new()
    } else {
        "••••".to_string()
    }
}
