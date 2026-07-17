// The app's own storage — a small SQLite database (separate from any file
// a user uploads) that tracks upload sessions and query history.
// SQLite was chosen deliberately: it's free, needs no external service or
// account, and is thematically exact for a SQLite-focused tool. Swap this
// module out for a Postgres client (e.g. Supabase free tier) if you need
// history to survive a host with an ephemeral filesystem.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('../config/env');

fs.mkdirSync(env.dataDir, { recursive: true });

const dbPath = path.join(env.dataDir, 'statement_meta.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
