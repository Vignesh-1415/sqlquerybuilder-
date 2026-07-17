-- Statement metadata database schema.
-- This is a SEPARATE SQLite database from any file a user uploads.
-- It only stores bookkeeping: which uploaded files exist, their schema
-- summary, and the history of questions/queries run against them.

CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_path   TEXT NOT NULL,
    schema_json   TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS query_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    sql_text    TEXT NOT NULL,
    row_count   INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_session ON query_history(session_id, created_at DESC);
