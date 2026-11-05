use std::collections::BTreeMap;

use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::db::now_iso;
use crate::error::{CommandError, CommandResult};
use crate::models::{
    BookMeta, Bootstrap, EvaluationRecord, EvaluationReport, ModelConfigView, Profile,
    ProgressEvent, ReferenceBook, TestConnectionResult,
};
use crate::services::ai::{self, AiClient};
use crate::services::analysis;
use crate::services::book;
use crate::services::keyring_store;
use crate::state::AppState;

#[tauri::command]
pub fn bootstrap(state: State<'_, AppState>) -> CommandResult<Bootstrap> {
    let profiles = state.db.list_profiles()?;
    let model_config = model_config_view(state.inner())?;
    let monthly_evaluations = state.db.monthly_evaluations()?;
    Ok(Bootstrap {
        profiles,
        model_config,
        monthly_evaluations,
    })
}

#[tauri::command]
pub fn list_profiles(state: State<'_, AppState>) -> CommandResult<Vec<Profile>> {
    state.db.list_profiles()
}

#[tauri::command]
pub fn get_profile(state: State<'_, AppState>, profile_id: String) -> CommandResult<Profile> {
    state.db.require_profile(&profile_id)
}

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    name: String,
    genre: String,
    custom_genre: Option<String>,
) -> CommandResult<Profile> {
    state
        .db
        .create_profile(&name, &genre, custom_genre.as_deref())
}

#[tauri::command]
pub fn update_profile(
    state: State<'_, AppState>,
    profile_id: String,
    name: String,
    summary: String,
    keywords: Vec<String>,
) -> CommandResult<Profile> {
    state
        .db
        .update_profile(&profile_id, &name, &summary, &keywords)
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, profile_id: String) -> CommandResult<()> {
    state.db.delete_profile(&profile_id)
}

#[tauri::command]
pub fn list_reference_books(
    state: State<'_, AppState>,
    profile_id: String,
) -> CommandResult<Vec<ReferenceBook>> {
    state.db.list_books(&profile_id)
}

#[tauri::command]
pub async fn add_reference_book(
    state: State<'_, AppState>,
    profile_id: String,
    url: String,
    reference_type: String,
    title: Option<String>,
) -> CommandResult<ReferenceBook> {
    let url = url.trim().to_string();
    let parsed = Url::parse(&url)
        .map_err(|_| CommandError::new("INVALID_URL", "小说链接格式不正确，请检查后重试。"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(CommandError::new(
            "INVALID_URL",
            "小说链接需以 http:// 或 https:// 开头。",
        ));
    }

    let mut book_title = title.unwrap_or_default().trim().to_string();
    if book_title.is_empty() {
        let token = CancellationToken::new();
        match book::fetch_info(&state.book_http, &url, &token).await {
            Ok(meta) => {
                book_title = meta.title;
            }
            Err(error) => {
                return Err(CommandError::new(
                    error.code,
                    format!("{}\n你可以在添加窗口中手动填写书名后重试。", error.message),
                ));
            }
        }
    }
    if book_title.chars().count() > 80 {
        book_title = book_title.chars().take(80).collect();
    }

    state
        .db
        .add_book(&profile_id, &book_title, &url, &reference_type)
}

#[tauri::command]
pub fn save_book_rating(
    state: State<'_, AppState>,
    book_id: String,
    ratings: BTreeMap<String, i64>,
) -> CommandResult<ReferenceBook> {
    state.db.save_ratings(&book_id, &ratings)
}

#[tauri::command]
pub fn save_book_negatives(
    state: State<'_, AppState>,
    book_id: String,
    worst_dimension: String,
    second_worst_dimension: String,
) -> CommandResult<ReferenceBook> {
    state
        .db
        .save_negatives(&book_id, &worst_dimension, &second_worst_dimension)
}

#[tauri::command]
pub fn delete_reference_book(state: State<'_, AppState>, book_id: String) -> CommandResult<()> {
    state.db.delete_book(&book_id)
}

#[tauri::command]
pub fn get_model_config(state: State<'_, AppState>) -> CommandResult<ModelConfigView> {
    model_config_view(state.inner())
}

#[tauri::command]
pub fn save_model_config(
    state: State<'_, AppState>,
    api_key: Option<String>,
    model_name: String,
    base_url: String,
) -> CommandResult<ModelConfigView> {
    let model_name = model_name.trim().to_string();
    if model_name.is_empty() {
        return Err(CommandError::validation("请填写要调用的模型名称。"));
    }
    let base_url = ai::normalize_base_url(&base_url)?;
    let api_key = api_key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(key) = api_key {
        keyring_store::set_api_key(&state.db, &key)?;
    } else if keyring_store::get_api_key(&state.db)?.is_none() {
        return Err(CommandError::validation("请填写你的 API Key。"));
    }

    state.db.set_setting("model_name", &model_name)?;
    state.db.set_setting("base_url", &base_url)?;
    model_config_view(state.inner())
}

#[tauri::command]
pub fn clear_model_config(state: State<'_, AppState>) -> CommandResult<ModelConfigView> {
    keyring_store::delete_api_key(&state.db)?;
    state.db.delete_setting("model_name")?;
    state.db.delete_setting("base_url")?;
    model_config_view(state.inner())
}

#[tauri::command]
pub async fn test_model_connection(
    state: State<'_, AppState>,
    api_key: Option<String>,
    model_name: String,
    base_url: String,
) -> CommandResult<TestConnectionResult> {
    let model_name = model_name.trim().to_string();
    if model_name.is_empty() {
        return Err(CommandError::validation("请填写要调用的模型名称。"));
    }
    let base_url = ai::normalize_base_url(&base_url)?;
    let draft_key = api_key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let api_key = if let Some(value) = draft_key {
        value
    } else {
        keyring_store::get_api_key(&state.db)?.ok_or_else(|| {
            CommandError::new(
                "MODEL_NOT_CONFIGURED",
                "尚未保存 API Key，请先填写后再测试连接。",
            )
        })?
    };

    let client = AiClient::new(state.http.clone(), model_name, base_url, api_key);
    let token = CancellationToken::new();
    client.test_connection(&token).await
}

#[tauri::command]
pub async fn fetch_book_meta(state: State<'_, AppState>, url: String) -> CommandResult<BookMeta> {
    let token = CancellationToken::new();
    book::fetch_info(&state.book_http, url.trim(), &token).await
}

#[tauri::command]
pub async fn generate_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    task_id: String,
) -> CommandResult<Profile> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return Err(CommandError::validation("任务标识不能为空。"));
    }
    let token = state.register_task(&task_id);
    let result = run_generate_profile(&app, state.inner(), &profile_id, &task_id, &token).await;
    state.finish_task(&task_id);
    result
}

#[tauri::command]
pub async fn evaluate_novel(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    url: String,
    task_id: String,
) -> CommandResult<EvaluationRecord> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return Err(CommandError::validation("任务标识不能为空。"));
    }
    let token = state.register_task(&task_id);
    let result = run_evaluate_novel(&app, state.inner(), &profile_id, &url, &task_id, &token).await;
    state.finish_task(&task_id);
    result
}

#[tauri::command]
pub fn cancel_task(state: State<'_, AppState>, task_id: String) -> bool {
    state.cancel_task(&task_id)
}

#[tauri::command]
pub fn list_evaluations(
    state: State<'_, AppState>,
    profile_id: String,
) -> CommandResult<Vec<EvaluationRecord>> {
    state.db.list_evaluations(&profile_id)
}

#[tauri::command]
pub fn get_evaluation(
    state: State<'_, AppState>,
    evaluation_id: String,
) -> CommandResult<EvaluationRecord> {
    state.db.get_evaluation(&evaluation_id)
}

#[tauri::command]
pub fn delete_evaluation(state: State<'_, AppState>, evaluation_id: String) -> CommandResult<()> {
    state.db.delete_evaluation(&evaluation_id)
}

fn model_config_view(state: &AppState) -> CommandResult<ModelConfigView> {
    let model_name = state.db.get_setting("model_name")?.unwrap_or_default();
    let base_url = state.db.get_setting("base_url")?.unwrap_or_default();
    let api_key = keyring_store::get_api_key(&state.db)?.unwrap_or_default();
    let configured =
        !model_name.trim().is_empty() && !base_url.trim().is_empty() && !api_key.is_empty();
    Ok(ModelConfigView {
        configured,
        model_name,
        base_url,
        api_key_masked: keyring_store::mask_api_key(&api_key),
    })
}

async fn run_generate_profile(
    app: &AppHandle,
    state: &AppState,
    profile_id: &str,
    task_id: &str,
    token: &CancellationToken,
) -> CommandResult<Profile> {
    let profile = state.db.require_profile(profile_id)?;
    let books = state.db.list_books(profile_id)?;
    if books.is_empty() {
        return Err(CommandError::validation(
            "至少需要一本参考小说才能生成画像。",
        ));
    }
    let unfinished = books.iter().filter(|book| !book.ready).count();
    if unfinished > 0 {
        return Err(CommandError::validation(format!(
            "还有 {unfinished} 本参考小说没有完成评价。"
        )));
    }

    let ai = AiClient::from_database(&state.db, &state.http)?;
    let count = books.len().max(1);
    let mut analyses = BTreeMap::new();

    for (index, reference) in books.iter().enumerate() {
        if token.is_cancelled() {
            return Err(CommandError::cancelled());
        }
        emit_progress(
            app,
            "profile-progress",
            task_id,
            "fetching",
            0,
            3,
            (4.0 + index as f32 / count as f32 * 26.0) as u8,
            format!(
                "正在获取《{}》的正文（{}/{}）",
                reference.title,
                index + 1,
                count
            ),
        );

        let fetched = book::fetch_book(&state.book_http, &reference.url, token, 10)
            .await
            .map_err(|error| {
                CommandError::new(
                    error.code,
                    format!("无法获取《{}》的正文：{}", reference.title, error.message),
                )
            })?;
        if fetched.chapters.is_empty() {
            return Err(CommandError::new(
                "CONTENT_EXTRACT_FAILED",
                format!("《{}》没有获取到可用正文。", reference.title),
            ));
        }

        emit_progress(
            app,
            "profile-progress",
            task_id,
            "analyzing",
            1,
            3,
            (32.0 + index as f32 / count as f32 * 36.0) as u8,
            format!(
                "AI 正在分析《{}》的七个维度（{}/{}）",
                reference.title,
                index + 1,
                count
            ),
        );

        let excerpt = fetched.excerpt(1800);
        let analysis =
            analysis::analyze_book(&ai, &reference.title, &fetched.author, &excerpt, token)
                .await
                .map_err(|error| {
                    CommandError::new(
                        error.code,
                        format!("分析《{}》失败：{}", reference.title, error.message),
                    )
                })?;
        let analysis_json = serde_json::to_string(&analysis)?;
        state.db.save_analysis(
            Some(profile_id),
            Some(&reference.id),
            &reference.title,
            &reference.url,
            "reference",
            &fetched.chapter_range(),
            &analysis_json,
            ai.model_name(),
        )?;
        analyses.insert(reference.id.clone(), analysis);
    }

    if token.is_cancelled() {
        return Err(CommandError::cancelled());
    }
    emit_progress(
        app,
        "profile-progress",
        task_id,
        "generating",
        2,
        3,
        76,
        "正在归纳你的阅读偏好与口味边界…",
    );
    let generated = analysis::generate_profile(&ai, &profile, &books, &analyses, token).await?;
    let updated = state.db.update_generated_profile(
        profile_id,
        &generated.summary,
        &generated.preferences,
    )?;

    emit_progress(
        app,
        "profile-progress",
        task_id,
        "completed",
        3,
        3,
        100,
        "画像生成完成。",
    );
    Ok(updated)
}

async fn run_evaluate_novel(
    app: &AppHandle,
    state: &AppState,
    profile_id: &str,
    url: &str,
    task_id: &str,
    token: &CancellationToken,
) -> CommandResult<EvaluationRecord> {
    let profile = state.db.require_profile(profile_id)?;
    if profile.status != "generated" {
        return Err(CommandError::validation(
            "这套画像还没有生成，请先补充参考小说并生成画像。",
        ));
    }
    let ai = AiClient::from_database(&state.db, &state.http)?;
    let url = url.trim();
    if url.is_empty() {
        return Err(CommandError::validation("请先粘贴小说链接。"));
    }
    let parsed = Url::parse(url)
        .map_err(|_| CommandError::new("INVALID_URL", "小说链接格式不正确，请检查后重试。"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(CommandError::new(
            "INVALID_URL",
            "小说链接需以 http:// 或 https:// 开头。",
        ));
    }

    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "info",
        0,
        5,
        4,
        "正在获取小说信息…",
    );

    let fetched = book::fetch_book(&state.book_http, url, token, 10).await?;
    if fetched.chapters.is_empty() {
        return Err(CommandError::new(
            "CONTENT_EXTRACT_FAILED",
            "没有获取到可分析的小说正文。",
        ));
    }
    let chapter_range = fetched.chapter_range();
    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "chapters",
        1,
        5,
        20,
        format!(
            "已获取 {}，共 {} 章正文",
            chapter_range,
            fetched.chapters.len()
        ),
    );

    if token.is_cancelled() {
        return Err(CommandError::cancelled());
    }
    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "analyzing",
        2,
        5,
        38,
        "AI 正在分析小说内容与七维度特征…",
    );

    let excerpt = fetched.excerpt(2400);
    let analysis =
        analysis::analyze_book(&ai, &fetched.title, &fetched.author, &excerpt, token).await?;
    let analysis_json = serde_json::to_string(&analysis)?;
    state.db.save_analysis(
        Some(profile_id),
        None,
        &analysis.title,
        url,
        "target",
        &chapter_range,
        &analysis_json,
        ai.model_name(),
    )?;

    if token.is_cancelled() {
        return Err(CommandError::cancelled());
    }
    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "matching",
        3,
        5,
        68,
        format!("正在与「{}」的阅读偏好进行匹配…", profile.name),
    );
    let outcome = analysis::evaluate_match(&ai, &profile, &analysis, token).await?;

    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "report",
        4,
        5,
        88,
        "正在生成评估报告…",
    );

    let book_title = if analysis.title.trim().is_empty() {
        fetched.title.clone()
    } else {
        analysis.title.clone()
    };
    let author = if outcome.author.trim().is_empty() {
        fetched.author.clone()
    } else {
        outcome.author.clone()
    };
    let genre = if outcome.genre.trim().is_empty() {
        if analysis.genre.trim().is_empty() {
            "小说".to_string()
        } else {
            analysis.genre.clone()
        }
    } else {
        outcome.genre.clone()
    };
    let tags = if outcome.tags.is_empty() {
        analysis.tags.clone()
    } else {
        outcome.tags.clone()
    };
    let created_at = now_iso();

    let report = EvaluationReport {
        book_title: book_title.clone(),
        author,
        genre,
        tags,
        score: outcome.score,
        verdict: outcome.verdict,
        verdict_note: outcome.verdict_note,
        reasons: outcome.reasons,
        risks: outcome.risks,
        quote: outcome.quote,
        quote_source: outcome.quote_source,
        profile_name: profile.name.clone(),
        chapter_range: chapter_range.clone(),
        model_name: ai.model_name().to_string(),
        base_url: ai.base_url().to_string(),
        created_at: created_at.clone(),
    };

    let record = state.db.insert_evaluation(
        profile_id,
        &book_title,
        url,
        outcome.score as f64,
        &chapter_range,
        &report,
        ai.model_name(),
    )?;

    emit_progress(
        app,
        "evaluation-progress",
        task_id,
        "completed",
        5,
        5,
        100,
        "评估报告已生成。",
    );
    Ok(record)
}

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app: &AppHandle,
    event_name: &str,
    task_id: &str,
    stage: &str,
    stage_index: usize,
    total_stages: usize,
    progress: u8,
    message: impl Into<String>,
) {
    let _ = app.emit(
        event_name,
        ProgressEvent {
            task_id: task_id.to_string(),
            stage: stage.to_string(),
            stage_index,
            total_stages,
            progress: progress.min(100),
            message: message.into(),
        },
    );
}
