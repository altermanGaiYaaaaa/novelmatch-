use std::collections::HashSet;
use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::Duration;

use encoding_rs::{Encoding, GBK, UTF_8};
use regex::Regex;
use reqwest::header::CONTENT_TYPE;
use reqwest::Client;
use scraper::{Html, Selector};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::error::{CommandError, CommandResult};
use crate::models::BookMeta;

const MAX_PAGE_BYTES: usize = 8 * 1024 * 1024;
const PAGE_TIMEOUT: Duration = Duration::from_secs(28);
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

#[derive(Debug, Clone)]
pub struct Chapter {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct FetchedBook {
    pub title: String,
    pub author: String,
    pub chapters: Vec<Chapter>,
}

impl FetchedBook {
    pub fn chapter_range(&self) -> String {
        if self.chapters.len() >= 10 {
            "前十章".to_string()
        } else if self.chapters.is_empty() {
            "未获取到正文".to_string()
        } else {
            format!("前 {} 章（正文获取不完整）", self.chapters.len())
        }
    }

    pub fn excerpt(&self, per_chapter: usize) -> String {
        self.chapters
            .iter()
            .enumerate()
            .map(|(index, chapter)| {
                let content: String = chapter.content.chars().take(per_chapter).collect();
                format!("【第 {} 章】{}\n{}", index + 1, chapter.title, content)
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

pub fn build_client() -> CommandResult<Client> {
    Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| {
            CommandError::new(
                "HTTP_CLIENT_ERROR",
                format!("初始化网络客户端失败：{error}"),
            )
        })
}

pub async fn fetch_info(
    http: &Client,
    url: &str,
    token: &CancellationToken,
) -> CommandResult<BookMeta> {
    let (final_url, html) = fetch_page(http, url, token).await?;
    let info = parse_book_info(&html);
    Ok(BookMeta {
        title: info.title,
        author: info.author,
        url: final_url.to_string(),
    })
}

pub async fn fetch_book(
    http: &Client,
    url: &str,
    token: &CancellationToken,
    limit: usize,
) -> CommandResult<FetchedBook> {
    let (page_url, html) = fetch_page(http, url, token).await?;
    let info = parse_book_info(&html);
    let links = extract_chapter_links(&html, &page_url);

    let mut chapters = Vec::new();
    let mut last_chapter_error: Option<CommandError> = None;

    if !links.is_empty() {
        for (chapter_url, label) in links.into_iter().take(limit) {
            if token.is_cancelled() {
                return Err(CommandError::cancelled());
            }
            match fetch_page(http, chapter_url.as_str(), token).await {
                Ok((_, chapter_html)) => {
                    if let Some(content) = extract_content(&chapter_html) {
                        if content.chars().count() >= 80 {
                            let title = extract_chapter_title(&chapter_html)
                                .filter(|value| !value.trim().is_empty())
                                .unwrap_or(label);
                            chapters.push(Chapter { title, content });
                        }
                    }
                }
                Err(error) => {
                    last_chapter_error = Some(error);
                }
            }
        }
    }

    if chapters.is_empty() {
        if let Some(mut content) = extract_content(&html) {
            if content.chars().count() >= 500 {
                let mut current_url = page_url.clone();
                let mut current_html = html;
                let mut current_title = extract_chapter_title(&current_html)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| info.title.clone());
                let mut visited: HashSet<String> = HashSet::new();
                visited.insert(current_url.to_string());

                loop {
                    if token.is_cancelled() {
                        return Err(CommandError::cancelled());
                    }
                    chapters.push(Chapter {
                        title: current_title,
                        content,
                    });
                    if chapters.len() >= limit {
                        break;
                    }

                    let Some(next_url) = find_next_link(&current_html, &current_url) else {
                        break;
                    };
                    if !visited.insert(next_url.to_string()) {
                        break;
                    }

                    match fetch_page(http, next_url.as_str(), token).await {
                        Ok((resolved, next_html)) => {
                            if let Some(next_content) = extract_content(&next_html) {
                                if next_content.chars().count() < 80 {
                                    break;
                                }
                                current_url = resolved;
                                current_html = next_html;
                                current_title = extract_chapter_title(&current_html)
                                    .filter(|value| !value.trim().is_empty())
                                    .unwrap_or_else(|| format!("第 {} 章", chapters.len() + 1));
                                content = next_content;
                            } else {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            }
        }
    }

    if chapters.is_empty() {
        if let Some(error) = last_chapter_error {
            return Err(error);
        }
        return Err(CommandError::new(
            "CONTENT_EXTRACT_FAILED",
            "无法从该页面提取小说正文。当前来源可能使用动态加载、需要登录或限制了访问，请换用公开的章节页或作品页。",
        ));
    }

    Ok(FetchedBook {
        title: info.title,
        author: info.author,
        chapters,
    })
}

async fn fetch_page(
    http: &Client,
    input: &str,
    token: &CancellationToken,
) -> CommandResult<(Url, String)> {
    let mut current = Url::parse(input)
        .map_err(|_| CommandError::new("INVALID_URL", "小说链接格式不正确，请检查后重试。"))?;

    for _ in 0..=5 {
        if token.is_cancelled() {
            return Err(CommandError::cancelled());
        }
        ensure_public_url(&current).await?;

        let response = tokio::select! {
            _ = token.cancelled() => return Err(CommandError::cancelled()),
            result = http
                .get(current.clone())
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.6")
                .timeout(PAGE_TIMEOUT)
                .send() => result,
        }
        .map_err(|error| {
            if error.is_timeout() {
                CommandError::new("FETCH_TIMEOUT", "访问小说页面超时，请检查网络或稍后重试。")
            } else if error.is_connect() {
                CommandError::new("FETCH_FAILED", "无法访问小说页面，请检查链接或网络。")
            } else {
                CommandError::new("FETCH_FAILED", format!("访问小说页面失败：{error}"))
            }
        })?;

        let status = response.status();
        if status.is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| CommandError::new("FETCH_FAILED", "页面跳转缺少目标地址。"))?;
            current = current
                .join(location)
                .map_err(|_| CommandError::new("FETCH_FAILED", "页面跳转地址无效。"))?;
            continue;
        }

        if !status.is_success() {
            let message = match status.as_u16() {
                401 | 403 => {
                    "该页面拒绝访问，可能需要登录或受平台访问限制。软件不会绕过登录或付费墙。"
                }
                404 | 410 => "小说页面不存在或已经下架。",
                429 => "访问小说来源过于频繁，被暂时限制，请稍后再试。",
                _ => "小说页面返回异常状态，当前来源可能暂时不可用。",
            };
            return Err(CommandError::new("FETCH_HTTP_ERROR", message));
        }

        if let Some(length) = response.content_length() {
            if length as usize > MAX_PAGE_BYTES {
                return Err(CommandError::new(
                    "PAGE_TOO_LARGE",
                    "小说页面体积过大，无法安全解析。",
                ));
            }
        }
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let bytes = response.bytes().await.map_err(|error| {
            CommandError::new("FETCH_FAILED", format!("读取小说页面失败：{error}"))
        })?;
        if bytes.len() > MAX_PAGE_BYTES {
            return Err(CommandError::new(
                "PAGE_TOO_LARGE",
                "小说页面体积过大，无法安全解析。",
            ));
        }
        let html = decode_html(&bytes, &content_type);
        return Ok((current, html));
    }

    Err(CommandError::new(
        "TOO_MANY_REDIRECTS",
        "页面跳转次数过多，无法读取小说内容。",
    ))
}

async fn ensure_public_url(url: &Url) -> CommandResult<()> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err(CommandError::new(
            "INVALID_URL",
            "仅支持 http:// 或 https:// 开头的小说链接。",
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| CommandError::new("INVALID_URL", "小说链接缺少有效域名。"))?;
    let lower = host.to_ascii_lowercase();
    if lower == "localhost" || lower.ends_with(".local") || lower == "0.0.0.0" {
        return Err(CommandError::new(
            "UNSAFE_URL",
            "出于安全考虑，不支持访问本机或内网地址。",
        ));
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(ip) {
            return Err(CommandError::new(
                "UNSAFE_URL",
                "出于安全考虑，不支持访问本机或内网地址。",
            ));
        }
        return Ok(());
    }

    let port = url.port_or_known_default().unwrap_or(80);
    let addrs = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| CommandError::new("URL_UNREACHABLE", "无法解析小说链接的域名。"))?;
    let mut resolved = false;
    for addr in addrs {
        resolved = true;
        if is_private_ip(addr.ip()) {
            return Err(CommandError::new(
                "UNSAFE_URL",
                "出于安全考虑，不支持访问本机或内网地址。",
            ));
        }
    }
    if !resolved {
        return Err(CommandError::new(
            "URL_UNREACHABLE",
            "无法解析小说链接的域名。",
        ));
    }
    Ok(())
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(value) => {
            let octets = value.octets();
            value.is_private()
                || value.is_loopback()
                || value.is_link_local()
                || value.is_broadcast()
                || value.is_unspecified()
                || value.is_documentation()
                || octets[0] == 0
                || (octets[0] == 100 && (64..=127).contains(&octets[1]))
        }
        IpAddr::V6(value) => {
            if let Some(mapped) = value.to_ipv4_mapped() {
                return is_private_ip(IpAddr::V4(mapped));
            }
            value.is_loopback()
                || value.is_unspecified()
                || value.is_unique_local()
                || value.is_unicast_link_local()
        }
    }
}

fn decode_html(bytes: &[u8], content_type: &str) -> String {
    let mut encoding: Option<&'static Encoding> = charset_from_header(content_type);
    if encoding.is_none() {
        let prefix = &bytes[..bytes.len().min(4096)];
        let lossy = String::from_utf8_lossy(prefix);
        encoding = charset_from_meta(&lossy);
    }
    let encoding = encoding.unwrap_or(UTF_8);
    let (text, used_encoding, had_errors) = encoding.decode(bytes);
    if had_errors && used_encoding == UTF_8 {
        let (gbk_text, _, _) = GBK.decode(bytes);
        return gbk_text.into_owned();
    }
    text.into_owned()
}

fn charset_from_header(content_type: &str) -> Option<&'static Encoding> {
    let lower = content_type.to_ascii_lowercase();
    let index = lower.find("charset=")?;
    let rest = &content_type[index + 8..];
    let label = rest
        .split([';', ' '])
        .next()
        .unwrap_or("")
        .trim_matches(['"', '\'']);
    Encoding::for_label(label.as_bytes())
}

fn charset_from_meta(html: &str) -> Option<&'static Encoding> {
    static CHARSET_RE: OnceLock<Regex> = OnceLock::new();
    let regex = CHARSET_RE.get_or_init(|| {
        Regex::new(r#"(?i)charset\s*=\s*["']?\s*([a-zA-Z0-9_\-]+)"#).expect("valid charset regex")
    });
    let captures = regex.captures(html)?;
    Encoding::for_label(captures.get(1)?.as_str().as_bytes())
}

fn parse_book_info(html: &str) -> BookMeta {
    let document = Html::parse_document(html);
    let title = meta_content(&document, "meta[property='og:novel:book_name']")
        .or_else(|| meta_content(&document, "meta[name='og:novel:book_name']"))
        .or_else(|| meta_content(&document, "meta[property='og:title']"))
        .or_else(|| meta_content(&document, "meta[name='og:title']"))
        .or_else(|| first_text(&document, "h1"))
        .or_else(|| first_text(&document, "title"))
        .unwrap_or_else(|| "未命名作品".to_string());

    let author = meta_content(&document, "meta[property='og:novel:author']")
        .or_else(|| meta_content(&document, "meta[name='og:novel:author']"))
        .or_else(|| meta_content(&document, "meta[name='author']"))
        .or_else(|| first_text(&document, "#info p"))
        .or_else(|| first_text(&document, ".author"))
        .or_else(|| first_text(&document, ".book-info .author"))
        .unwrap_or_default();

    BookMeta {
        title: clean_book_title(&title),
        author: clean_author(&author),
        url: String::new(),
    }
}

fn meta_content(document: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    document
        .select(&selector)
        .next()
        .and_then(|element| element.value().attr("content"))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn first_text(document: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    document
        .select(&selector)
        .next()
        .map(|element| element.text().collect::<String>().trim().to_string())
        .filter(|value| !value.is_empty())
}

fn clean_book_title(raw: &str) -> String {
    let mut value = raw.trim().to_string();
    for separator in [" - ", "_", " | ", "—"] {
        if let Some((head, tail)) = value.rsplit_once(separator) {
            if tail.contains('网')
                || tail.contains('站')
                || tail.contains("阅读")
                || tail.contains("小说")
            {
                value = head.trim().to_string();
            }
        }
    }
    for suffix in [
        "最新章节",
        "全文阅读",
        "无弹窗",
        "免费阅读",
        "章节目录",
        "小说在线阅读",
    ] {
        if let Some(index) = value.find(suffix) {
            value.truncate(index);
        }
    }
    value = value.trim().to_string();
    if value.starts_with('《') && value.ends_with('》') && value.chars().count() > 2 {
        value = value
            .trim_start_matches('《')
            .trim_end_matches('》')
            .to_string();
    }
    if value.is_empty() {
        "未命名作品".to_string()
    } else {
        value
    }
}

fn clean_author(raw: &str) -> String {
    let mut value = raw.trim().to_string();
    for prefix in ["作者：", "作者:", "作 者：", "著者："] {
        if let Some(stripped) = value.strip_prefix(prefix) {
            value = stripped.trim().to_string();
            break;
        }
    }
    for suffix in [" 著", "著"] {
        if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() {
            value.truncate(value.len() - suffix.len());
        }
    }
    value.trim().to_string()
}

fn extract_chapter_title(html: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let title = first_text(&document, "h1")
        .or_else(|| first_text(&document, "h2"))
        .or_else(|| meta_content(&document, "meta[property='og:title']"))
        .or_else(|| meta_content(&document, "meta[name='og:title']"))
        .or_else(|| first_text(&document, "title"))?;
    Some(clean_book_title(&title))
}

fn extract_chapter_links(html: &str, base: &Url) -> Vec<(Url, String)> {
    static CHAPTER_RE: OnceLock<Regex> = OnceLock::new();
    let regex = CHAPTER_RE.get_or_init(|| {
        Regex::new(r"第\s*[0-9０-９零〇一二三四五六七八九十百千万两]+\s*[章节回话]|^(序章|楔子|引子|尾声|终章)")
            .expect("valid chapter regex")
    });
    let document = Html::parse_document(html);
    let Ok(selector) = Selector::parse("a[href]") else {
        return Vec::new();
    };
    let mut seen = HashSet::new();
    let mut candidates = Vec::new();

    for (order, anchor) in document.select(&selector).enumerate() {
        let text = anchor
            .text()
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if text.is_empty() || text.chars().count() > 80 {
            continue;
        }
        if text.contains("最新章节") || text.contains("目录") || text.contains("书签") {
            continue;
        }
        if !regex.is_match(&text) {
            continue;
        }
        let Some(href) = anchor.value().attr("href") else {
            continue;
        };
        let Ok(joined) = base.join(href) else {
            continue;
        };
        if !matches!(joined.scheme(), "http" | "https") {
            continue;
        }
        if joined.host_str() != base.host_str() {
            continue;
        }
        let key = joined.to_string();
        if !seen.insert(key) {
            continue;
        }
        let number = chapter_number(&text);
        candidates.push((number, order, joined, text));
    }

    if candidates.len() > 2 && candidates.iter().filter(|item| item.0 > 0).count() > 2 {
        candidates.sort_by_key(|item| (item.0, item.1));
    }

    candidates
        .into_iter()
        .map(|(_, _, url, text)| (url, text))
        .collect()
}

fn chapter_number(text: &str) -> u64 {
    static NUMBER_RE: OnceLock<Regex> = OnceLock::new();
    let regex = NUMBER_RE.get_or_init(|| {
        Regex::new(r"第\s*([0-9０-９]+|[零〇一二三四五六七八九十百千万两]+)\s*[章节回话]")
            .expect("valid number regex")
    });
    let Some(captures) = regex.captures(text) else {
        return 0;
    };
    let Some(raw) = captures.get(1) else {
        return 0;
    };
    let value = raw.as_str();
    if value.chars().all(|ch| ch.is_ascii_digit()) {
        return value.parse().unwrap_or(0);
    }
    let value: String = value
        .chars()
        .map(|ch| match ch {
            '０'..='９' => char::from_u32(ch as u32 - 0xFF10 + 0x30).unwrap_or(ch),
            _ => ch,
        })
        .collect();
    if let Ok(number) = value.parse::<u64>() {
        return number;
    }
    chinese_number(&value)
}

fn chinese_number(value: &str) -> u64 {
    let mut total = 0u64;
    let mut section = 0u64;
    let mut number = 0u64;
    for ch in value.chars() {
        match ch {
            '零' | '〇' => {}
            '一' => number = 1,
            '二' | '两' => number = 2,
            '三' => number = 3,
            '四' => number = 4,
            '五' => number = 5,
            '六' => number = 6,
            '七' => number = 7,
            '八' => number = 8,
            '九' => number = 9,
            '十' => {
                if number == 0 {
                    number = 1;
                }
                section += number * 10;
                number = 0;
            }
            '百' => {
                if number == 0 {
                    number = 1;
                }
                section += number * 100;
                number = 0;
            }
            '千' => {
                if number == 0 {
                    number = 1;
                }
                section += number * 1000;
                number = 0;
            }
            '万' => {
                total += (section + number) * 10_000;
                section = 0;
                number = 0;
            }
            _ => {}
        }
    }
    total + section + number
}

fn find_next_link(html: &str, base: &Url) -> Option<Url> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("a[href]").ok()?;
    for anchor in document.select(&selector) {
        let text = anchor
            .text()
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("");
        if !text.contains("下一章") || text.contains("目录") {
            continue;
        }
        let href = anchor.value().attr("href")?;
        let joined = base.join(href).ok()?;
        if joined.host_str() == base.host_str() {
            return Some(joined);
        }
    }
    None
}

fn extract_content(html: &str) -> Option<String> {
    let cleaned_html = clean_html_for_text(html);
    let document = Html::parse_document(&cleaned_html);
    let selectors = [
        "#chaptercontent",
        "#content",
        "#booktxt",
        "#txtContent",
        ".read-content",
        ".RichText",
        ".content",
        ".chapter-content",
        "article",
        "main",
    ];

    let mut best = String::new();
    for selector_text in selectors {
        let Ok(selector) = Selector::parse(selector_text) else {
            continue;
        };
        for element in document.select(&selector) {
            let text = normalize_content(&element.text().collect::<String>());
            if text.chars().count() > best.chars().count() {
                best = text;
            }
        }
    }

    if best.chars().count() < 80 {
        let Ok(selector) = Selector::parse("body") else {
            return None;
        };
        if let Some(body) = document.select(&selector).next() {
            let text = normalize_content(&body.text().collect::<String>());
            if text.chars().count() > best.chars().count() {
                best = text;
            }
        }
    }

    if best.chars().count() < 80 {
        None
    } else {
        Some(best.chars().take(16_000).collect())
    }
}

fn clean_html_for_text(html: &str) -> String {
    static SCRIPT_RE: OnceLock<Regex> = OnceLock::new();
    static STYLE_RE: OnceLock<Regex> = OnceLock::new();
    static NOISE_RES: OnceLock<Vec<Regex>> = OnceLock::new();
    static COMMENT_RE: OnceLock<Regex> = OnceLock::new();
    static BREAK_RE: OnceLock<Regex> = OnceLock::new();
    static PARA_RE: OnceLock<Regex> = OnceLock::new();

    let script =
        SCRIPT_RE.get_or_init(|| Regex::new(r"(?is)<script\b.*?</script>").expect("script regex"));
    let style =
        STYLE_RE.get_or_init(|| Regex::new(r"(?is)<style\b.*?</style>").expect("style regex"));
    let noise = NOISE_RES.get_or_init(|| {
        [
            "noscript", "iframe", "svg", "nav", "header", "footer", "aside",
        ]
        .iter()
        .map(|tag| Regex::new(&format!(r"(?is)<{tag}\b.*?</{tag}>")).expect("noise tag regex"))
        .collect()
    });
    let comment = COMMENT_RE.get_or_init(|| Regex::new(r"(?s)<!--.*?-->").expect("comment regex"));
    let br = BREAK_RE.get_or_init(|| Regex::new(r"(?i)<br\s*/?>").expect("br regex"));
    let para = PARA_RE
        .get_or_init(|| Regex::new(r"(?i)</(p|div|li|h[1-6])\s*>").expect("paragraph regex"));

    let mut value = script.replace_all(html, " ").into_owned();
    value = style.replace_all(&value, " ").into_owned();
    for regex in noise {
        value = regex.replace_all(&value, " ").into_owned();
    }
    value = comment.replace_all(&value, " ").into_owned();
    value = br.replace_all(&value, "\n").into_owned();
    value = para.replace_all(&value, "\n").into_owned();
    value
}

fn normalize_content(raw: &str) -> String {
    static NOISE_LINE_RE: OnceLock<Regex> = OnceLock::new();
    let noise = NOISE_LINE_RE.get_or_init(|| {
        Regex::new(
            r"(?i)本章未完|点击下一页|下一页继续|请收藏本站|最新网址|手机版阅读|加入书签|投推荐票|起点中文网|晋江文学城|番茄小说|www\.|https?://|请记住本站|章节错误",
        )
        .expect("noise line regex")
    });

    let mut lines = Vec::new();
    for line in raw.replace('\r', "\n").split('\n') {
        let line = line.replace('\u{00a0}', " ").replace('\u{3000}', " ");
        let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if line.is_empty() || noise.is_match(&line) {
            continue;
        }
        lines.push(line);
    }
    lines.join("\n\n").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_arabic_and_chinese_chapter_numbers() {
        assert_eq!(chapter_number("第12章 借剑"), 12);
        assert_eq!(chapter_number("第一百零二章"), 102);
        assert_eq!(chapter_number("第两千章"), 2000);
        assert_eq!(chapter_number("楔子"), 0);
    }

    #[test]
    fn cleans_site_suffixes_from_titles() {
        assert_eq!(clean_book_title("《归墟剑主》_起点中文网"), "归墟剑主");
        assert_eq!(clean_book_title("长夜行舟 - 某小说网"), "长夜行舟");
    }

    #[test]
    fn rejects_private_ip_addresses() {
        assert!(is_private_ip("127.0.0.1".parse().unwrap()));
        assert!(is_private_ip("192.168.1.20".parse().unwrap()));
        assert!(is_private_ip("10.0.0.1".parse().unwrap()));
        assert!(!is_private_ip("1.1.1.1".parse().unwrap()));
    }
}
