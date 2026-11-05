use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use chrono::{Local, SecondsFormat};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::error::{CommandError, CommandResult};
use crate::models::{
    dimension_label, is_dimension, EvaluationRecord, EvaluationReport, Profile, ProfilePreferences,
    ReferenceBook, DIMENSION_KEYS,
};

const PROFILE_SELECT: &str = r#"
SELECT
    p.id, p.name, p.genre, p.custom_genre, p.summary, p.preference_data,
    p.status, p.created_at, p.updated_at,
    (SELECT COUNT(*) FROM reference_books rb WHERE rb.profile_id = p.id) AS book_count,
    (SELECT COUNT(*) FROM evaluation_records er WHERE er.profile_id = p.id) AS evaluation_count
FROM profiles p
"#;

pub fn now_iso() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, false)
}

pub fn month_prefix() -> String {
    Local::now().format("%Y-%m").to_string()
}

fn confidence_for(book_count: i64) -> &'static str {
    if book_count >= 8 {
        "高"
    } else if book_count >= 5 {
        "中高"
    } else if book_count >= 3 {
        "中"
    } else {
        "建立中"
    }
}

fn clean_preferences(mut preferences: ProfilePreferences, book_count: i64) -> ProfilePreferences {
    preferences.keywords = preferences
        .keywords
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .take(8)
        .collect();
    preferences.likes.retain(|item| !item.is_empty());
    preferences.dislikes.retain(|item| !item.is_empty());
    preferences.likes.truncate(5);
    preferences.dislikes.truncate(5);
    if preferences.confidence.trim().is_empty() {
        preferences.confidence = confidence_for(book_count).to_string();
    }
    preferences
}

fn map_profile(row: &Row<'_>) -> rusqlite::Result<Profile> {
    let book_count: i64 = row.get(9)?;
    let evaluation_count: i64 = row.get(10)?;
    let raw_preferences: String = row.get(5)?;
    let preferences = serde_json::from_str::<ProfilePreferences>(&raw_preferences)
        .map(|value| clean_preferences(value, book_count))
        .unwrap_or_else(|_| {
            let mut value = ProfilePreferences::default();
            value.confidence = confidence_for(book_count).to_string();
            value
        });

    Ok(Profile {
        id: row.get(0)?,
        name: row.get(1)?,
        genre: row.get(2)?,
        custom_genre: row.get(3)?,
        summary: row.get(4)?,
        preferences,
        status: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        book_count,
        evaluation_count,
    })
}

fn read_book(conn: &Connection, book_id: &str) -> rusqlite::Result<Option<ReferenceBook>> {
    let base = conn
        .query_row(
            "SELECT id, profile_id, title, url, reference_type, created_at \
             FROM reference_books WHERE id = ?1",
            params![book_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()?;

    let Some((id, profile_id, title, url, reference_type, created_at)) = base else {
        return Ok(None);
    };

    let mut stmt =
        conn.prepare("SELECT dimension, rating, rank FROM user_ratings WHERE book_id = ?1")?;
    let rows = stmt.query_map(params![book_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<i64>>(1)?,
            row.get::<_, Option<i64>>(2)?,
        ))
    })?;

    let mut ratings = BTreeMap::new();
    let mut worst = None;
    let mut second = None;
    for row in rows {
        let (dimension, rating, rank) = row?;
        if !is_dimension(&dimension) {
            continue;
        }
        if let Some(value) = rating {
            ratings.insert(dimension.clone(), value);
        }
        if rank == Some(1) {
            worst = Some(dimension.clone());
        }
        if rank == Some(2) {
            second = Some(dimension.clone());
        }
    }

    let ready = if reference_type == "positive" {
        DIMENSION_KEYS.iter().all(|key| {
            ratings
                .get(*key)
                .is_some_and(|value| (1..=5).contains(value))
        })
    } else {
        worst.is_some() && second.is_some()
    };

    Ok(Some(ReferenceBook {
        id,
        profile_id,
        title,
        url,
        reference_type,
        ratings,
        worst_dimension: worst,
        second_worst_dimension: second,
        ready,
        created_at,
    }))
}

fn parse_report(raw: &str) -> EvaluationReport {
    serde_json::from_str::<EvaluationReport>(raw).unwrap_or_default()
}

fn map_evaluation(row: &Row<'_>) -> rusqlite::Result<EvaluationRecord> {
    let profile_id: String = row.get(1)?;
    let book_title: String = row.get(2)?;
    let book_url: String = row.get(3)?;
    let match_score: f64 = row.get(4)?;
    let chapter_range: String = row.get(5)?;
    let raw_report: String = row.get(6)?;
    let status: String = row.get(7)?;
    let model_name: String = row.get(8)?;
    let created_at: String = row.get(9)?;
    let mut report = parse_report(&raw_report);
    if report.book_title.is_empty() {
        report.book_title = book_title.clone();
    }
    if report.score == 0 {
        report.score = match_score.round() as i64;
    }
    if report.chapter_range.is_empty() {
        report.chapter_range = chapter_range.clone();
    }
    if report.model_name.is_empty() {
        report.model_name = model_name.clone();
    }
    if report.created_at.is_empty() {
        report.created_at = created_at.clone();
    }
    Ok(EvaluationRecord {
        id: row.get(0)?,
        profile_id,
        book_title,
        book_url,
        match_score,
        chapter_range,
        report,
        status,
        model_name,
        created_at,
    })
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> CommandResult<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.busy_timeout(Duration::from_secs(8))?;
        let database = Self {
            conn: Mutex::new(conn),
        };
        database.migrate()?;
        Ok(database)
    }

    fn lock(&self) -> CommandResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| CommandError::database("数据库连接暂时不可用，请重启应用。"))
    }

    fn migrate(&self) -> CommandResult<()> {
        let mut conn = self.lock()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
        )?;
        let applied: i64 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )?;
        if applied < 1 {
            let tx = conn.transaction()?;
            tx.execute_batch(include_str!("../../migrations/001_init.sql"))?;
            tx.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
                params![now_iso()],
            )?;
            tx.commit()?;
        }
        Ok(())
    }

    pub fn list_profiles(&self) -> CommandResult<Vec<Profile>> {
        let conn = self.lock()?;
        let sql = format!("{PROFILE_SELECT} ORDER BY p.updated_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], map_profile)?;
        let mut profiles = Vec::new();
        for row in rows {
            profiles.push(row?);
        }
        Ok(profiles)
    }

    pub fn get_profile(&self, profile_id: &str) -> CommandResult<Option<Profile>> {
        let conn = self.lock()?;
        let sql = format!("{PROFILE_SELECT} WHERE p.id = ?1");
        let profile = conn
            .query_row(&sql, params![profile_id], map_profile)
            .optional()?;
        Ok(profile)
    }

    pub fn require_profile(&self, profile_id: &str) -> CommandResult<Profile> {
        self.get_profile(profile_id)?
            .ok_or_else(|| CommandError::not_found("画像不存在或已被删除。"))
    }

    pub fn create_profile(
        &self,
        name: &str,
        genre: &str,
        custom_genre: Option<&str>,
    ) -> CommandResult<Profile> {
        let name = name.trim();
        let genre = genre.trim();
        if name.is_empty() {
            return Err(CommandError::validation("请填写画像名称。"));
        }
        if genre.is_empty() {
            return Err(CommandError::validation("请选择一个偏好题材。"));
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        let mut preferences = ProfilePreferences::default();
        preferences.keywords = vec![genre.to_string()];
        preferences.confidence = "建立中".to_string();
        let preference_json = serde_json::to_string(&preferences)?;
        let custom = custom_genre
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        {
            let conn = self.lock()?;
            conn.execute(
                "INSERT INTO profiles \
                 (id, name, genre, custom_genre, summary, preference_data, status, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, '', ?5, 'draft', ?6, ?6)",
                params![id, name, genre, custom, preference_json, now],
            )?;
        }

        self.require_profile(&id)
    }

    pub fn update_profile(
        &self,
        profile_id: &str,
        name: &str,
        summary: &str,
        keywords: &[String],
    ) -> CommandResult<Profile> {
        let name = name.trim();
        if name.is_empty() {
            return Err(CommandError::validation("画像名称不能为空。"));
        }

        let conn = self.lock()?;
        let current_json: Option<String> = conn
            .query_row(
                "SELECT preference_data FROM profiles WHERE id = ?1",
                params![profile_id],
                |row| row.get(0),
            )
            .optional()?;
        let Some(current_json) = current_json else {
            return Err(CommandError::not_found("画像不存在或已被删除。"));
        };
        drop(conn);

        let mut preferences =
            serde_json::from_str::<ProfilePreferences>(&current_json).unwrap_or_default();
        let cleaned_keywords: Vec<String> = keywords
            .iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .take(8)
            .collect();
        if !cleaned_keywords.is_empty() {
            preferences.keywords = cleaned_keywords;
        }
        let preference_json = serde_json::to_string(&preferences)?;
        {
            let conn = self.lock()?;
            conn.execute(
                "UPDATE profiles SET name = ?1, summary = ?2, preference_data = ?3, updated_at = ?4 \
                 WHERE id = ?5",
                params![name, summary.trim(), preference_json, now_iso(), profile_id],
            )?;
        }
        self.require_profile(profile_id)
    }

    pub fn update_generated_profile(
        &self,
        profile_id: &str,
        summary: &str,
        preferences: &ProfilePreferences,
    ) -> CommandResult<Profile> {
        let preference_json = serde_json::to_string(preferences)?;
        {
            let conn = self.lock()?;
            let changed = conn.execute(
                "UPDATE profiles SET summary = ?1, preference_data = ?2, status = 'generated', updated_at = ?3 \
                 WHERE id = ?4",
                params![summary.trim(), preference_json, now_iso(), profile_id],
            )?;
            if changed == 0 {
                return Err(CommandError::not_found("画像不存在或已被删除。"));
            }
        }
        self.require_profile(profile_id)
    }

    pub fn delete_profile(&self, profile_id: &str) -> CommandResult<()> {
        let conn = self.lock()?;
        let changed = conn.execute("DELETE FROM profiles WHERE id = ?1", params![profile_id])?;
        if changed == 0 {
            return Err(CommandError::not_found("画像不存在或已被删除。"));
        }
        Ok(())
    }

    pub fn list_books(&self, profile_id: &str) -> CommandResult<Vec<ReferenceBook>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id FROM reference_books WHERE profile_id = ?1 ORDER BY created_at ASC",
        )?;
        let ids = stmt.query_map(params![profile_id], |row| row.get::<_, String>(0))?;
        let mut books = Vec::new();
        for id in ids {
            if let Some(book) = read_book(&conn, &id?)? {
                books.push(book);
            }
        }
        Ok(books)
    }

    pub fn get_book(&self, book_id: &str) -> CommandResult<ReferenceBook> {
        let conn = self.lock()?;
        read_book(&conn, book_id)?
            .ok_or_else(|| CommandError::not_found("参考小说不存在或已被删除。"))
    }

    pub fn add_book(
        &self,
        profile_id: &str,
        title: &str,
        url: &str,
        reference_type: &str,
    ) -> CommandResult<ReferenceBook> {
        if !matches!(reference_type, "positive" | "negative") {
            return Err(CommandError::validation("参考小说类型不正确。"));
        }
        if self.get_profile(profile_id)?.is_none() {
            return Err(CommandError::not_found("画像不存在或已被删除。"));
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        {
            let conn = self.lock()?;
            conn.execute(
                "INSERT INTO reference_books (id, profile_id, title, url, reference_type, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, profile_id, title.trim(), url.trim(), reference_type, now],
            )?;
            conn.execute(
                "UPDATE profiles SET updated_at = ?1 WHERE id = ?2",
                params![now, profile_id],
            )?;
        }
        self.get_book(&id)
    }

    pub fn save_ratings(
        &self,
        book_id: &str,
        ratings: &BTreeMap<String, i64>,
    ) -> CommandResult<ReferenceBook> {
        let book = self.get_book(book_id)?;
        if book.reference_type != "positive" {
            return Err(CommandError::validation("这本参考小说不是正向样本。"));
        }
        for key in DIMENSION_KEYS {
            let value = ratings.get(key).copied().ok_or_else(|| {
                CommandError::validation(format!("请为「{}」选择 1–5 星。", dimension_label(key)))
            })?;
            if !(1..=5).contains(&value) {
                return Err(CommandError::validation(format!(
                    "「{}」的评分需要在 1–5 星之间。",
                    dimension_label(key)
                )));
            }
        }
        if ratings.keys().any(|key| !is_dimension(key)) {
            return Err(CommandError::validation("评分中包含未知维度。"));
        }

        let conn = self.lock()?;
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "DELETE FROM user_ratings WHERE book_id = ?1",
            params![book_id],
        )?;
        for key in DIMENSION_KEYS {
            tx.execute(
                "INSERT INTO user_ratings (id, book_id, dimension, rating, rank, created_at) \
                 VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
                params![
                    Uuid::new_v4().to_string(),
                    book_id,
                    key,
                    ratings.get(key).copied().unwrap_or(0),
                    now_iso()
                ],
            )?;
        }
        tx.execute(
            "UPDATE profiles SET updated_at = ?1 WHERE id = ?2",
            params![now_iso(), book.profile_id],
        )?;
        tx.commit()?;
        drop(conn);

        self.get_book(book_id)
    }

    pub fn save_negatives(
        &self,
        book_id: &str,
        worst: &str,
        second: &str,
    ) -> CommandResult<ReferenceBook> {
        let book = self.get_book(book_id)?;
        if book.reference_type != "negative" {
            return Err(CommandError::validation("这本参考小说不是负向样本。"));
        }
        if !is_dimension(worst) || !is_dimension(second) {
            return Err(CommandError::validation("请选择两个有效的评价维度。"));
        }
        if worst == second {
            return Err(CommandError::validation("第一差和第二差的维度不能重复。"));
        }

        let conn = self.lock()?;
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "DELETE FROM user_ratings WHERE book_id = ?1",
            params![book_id],
        )?;
        tx.execute(
            "INSERT INTO user_ratings (id, book_id, dimension, rating, rank, created_at) \
             VALUES (?1, ?2, ?3, NULL, 1, ?4)",
            params![Uuid::new_v4().to_string(), book_id, worst, now_iso()],
        )?;
        tx.execute(
            "INSERT INTO user_ratings (id, book_id, dimension, rating, rank, created_at) \
             VALUES (?1, ?2, ?3, NULL, 2, ?4)",
            params![Uuid::new_v4().to_string(), book_id, second, now_iso()],
        )?;
        tx.execute(
            "UPDATE profiles SET updated_at = ?1 WHERE id = ?2",
            params![now_iso(), book.profile_id],
        )?;
        tx.commit()?;
        drop(conn);

        self.get_book(book_id)
    }

    pub fn delete_book(&self, book_id: &str) -> CommandResult<()> {
        let book = self.get_book(book_id)?;
        let conn = self.lock()?;
        conn.execute(
            "DELETE FROM reference_books WHERE id = ?1",
            params![book_id],
        )?;
        conn.execute(
            "UPDATE profiles SET updated_at = ?1 WHERE id = ?2",
            params![now_iso(), book.profile_id],
        )?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn save_analysis(
        &self,
        profile_id: Option<&str>,
        book_id: Option<&str>,
        title: &str,
        source_url: &str,
        analysis_type: &str,
        chapter_range: &str,
        analysis_json: &str,
        model_name: &str,
    ) -> CommandResult<()> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO book_analyses \
             (id, profile_id, book_id, title, source_url, analysis_type, chapter_range, analysis_data, model_name, prompt_version, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                Uuid::new_v4().to_string(),
                profile_id,
                book_id,
                title,
                source_url,
                analysis_type,
                chapter_range,
                analysis_json,
                model_name,
                crate::models::PROMPT_VERSION,
                now_iso()
            ],
        )?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn insert_evaluation(
        &self,
        profile_id: &str,
        book_title: &str,
        book_url: &str,
        match_score: f64,
        chapter_range: &str,
        report: &EvaluationReport,
        model_name: &str,
    ) -> CommandResult<EvaluationRecord> {
        let id = Uuid::new_v4().to_string();
        let created_at = now_iso();
        let report_json = serde_json::to_string(report)?;
        {
            let conn = self.lock()?;
            conn.execute(
                "INSERT INTO evaluation_records \
                 (id, profile_id, book_title, book_url, match_score, chapter_range, evaluation_data, status, model_name, prompt_version, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'completed', ?8, ?9, ?10)",
                params![
                    id,
                    profile_id,
                    book_title,
                    book_url,
                    match_score,
                    chapter_range,
                    report_json,
                    model_name,
                    crate::models::PROMPT_VERSION,
                    created_at
                ],
            )?;
            conn.execute(
                "UPDATE profiles SET updated_at = ?1 WHERE id = ?2",
                params![created_at, profile_id],
            )?;
        }
        self.get_evaluation(&id)
    }

    pub fn list_evaluations(&self, profile_id: &str) -> CommandResult<Vec<EvaluationRecord>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, profile_id, book_title, book_url, match_score, chapter_range, \
                    evaluation_data, status, model_name, created_at \
             FROM evaluation_records WHERE profile_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], map_evaluation)?;
        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }
        Ok(records)
    }

    pub fn get_evaluation(&self, evaluation_id: &str) -> CommandResult<EvaluationRecord> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT id, profile_id, book_title, book_url, match_score, chapter_range, \
                    evaluation_data, status, model_name, created_at \
             FROM evaluation_records WHERE id = ?1",
            params![evaluation_id],
            map_evaluation,
        )
        .optional()?
        .ok_or_else(|| CommandError::not_found("评估记录不存在或已被删除。"))
    }

    pub fn delete_evaluation(&self, evaluation_id: &str) -> CommandResult<()> {
        let conn = self.lock()?;
        let changed = conn.execute(
            "DELETE FROM evaluation_records WHERE id = ?1",
            params![evaluation_id],
        )?;
        if changed == 0 {
            return Err(CommandError::not_found("评估记录不存在或已被删除。"));
        }
        Ok(())
    }

    pub fn monthly_evaluations(&self) -> CommandResult<i64> {
        let conn = self.lock()?;
        let count = conn.query_row(
            "SELECT COUNT(*) FROM evaluation_records WHERE substr(created_at, 1, 7) = ?1",
            params![month_prefix()],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_setting(&self, key: &str) -> CommandResult<Option<String>> {
        let conn = self.lock()?;
        let value = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?;
        Ok(value)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> CommandResult<()> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, now_iso()],
        )?;
        Ok(())
    }

    pub fn delete_setting(&self, key: &str) -> CommandResult<()> {
        let conn = self.lock()?;
        conn.execute("DELETE FROM app_settings WHERE key = ?1", params![key])?;
        Ok(())
    }
}
