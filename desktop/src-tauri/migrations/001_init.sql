-- NovelMatch V1.0 初始数据库结构

CREATE TABLE IF NOT EXISTS profiles (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    genre           TEXT NOT NULL,
    custom_genre    TEXT,
    summary         TEXT NOT NULL DEFAULT '',
    preference_data TEXT NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reference_books (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    reference_type  TEXT NOT NULL CHECK (reference_type IN ('positive', 'negative')),
    created_at      TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ratings (
    id          TEXT PRIMARY KEY,
    book_id     TEXT NOT NULL,
    dimension   TEXT NOT NULL,
    rating      INTEGER,
    rank        INTEGER,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES reference_books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_analyses (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT,
    book_id         TEXT,
    title           TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    analysis_type   TEXT NOT NULL CHECK (analysis_type IN ('reference', 'target')),
    chapter_range   TEXT NOT NULL,
    analysis_data   TEXT NOT NULL,
    model_name      TEXT NOT NULL,
    prompt_version  TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES reference_books(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evaluation_records (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL,
    book_title      TEXT NOT NULL,
    book_url        TEXT NOT NULL,
    match_score     REAL NOT NULL,
    chapter_range   TEXT NOT NULL,
    evaluation_data TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed',
    model_name      TEXT NOT NULL,
    prompt_version  TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reference_books_profile
    ON reference_books(profile_id, reference_type, created_at);

CREATE INDEX IF NOT EXISTS idx_user_ratings_book
    ON user_ratings(book_id);

CREATE INDEX IF NOT EXISTS idx_book_analyses_profile
    ON book_analyses(profile_id, created_at);

CREATE INDEX IF NOT EXISTS idx_evaluations_profile
    ON evaluation_records(profile_id, created_at DESC);
