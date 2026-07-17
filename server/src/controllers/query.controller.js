const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../db/metaDb');
const env = require('../config/env');
const { schemaToPromptText } = require('../services/sqliteInspector.service');
const { generateSql } = require('../services/nlToSql.service');
const { sanitizeGeneratedSql } = require('../services/sqlSafety.service');
const { runQuery } = require('../services/queryRunner.service');

function getSessionOrThrow(sessionId) {
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
  if (!session) {
    throw new AppError('Session not found. Upload a database first.', 404, 'SESSION_NOT_FOUND');
  }
  return session;
}

function saveHistory({ sessionId, question, sql, rowCount, status, errorMessage, durationMs }) {
  db.prepare(
    `INSERT INTO query_history (session_id, question, sql_text, row_count, status, error_message, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, question, sql || '', rowCount || 0, status, errorMessage || null, durationMs);
}

const askQuestion = asyncHandler(async (req, res) => {
  const { sessionId, question } = req.body;
  const startedAt = Date.now();

  const session = getSessionOrThrow(sessionId);
  const schema = JSON.parse(session.schema_json);
  const schemaText = schemaToPromptText(schema);

  db.prepare(`UPDATE sessions SET last_used_at = datetime('now') WHERE id = ?`).run(sessionId);

  let rawSql;
  let safeSql;
  try {
    rawSql = await generateSql(question, schemaText);
    safeSql = sanitizeGeneratedSql(rawSql, { maxRows: env.maxResultRows });

    if (/UNANSWERABLE/i.test(safeSql)) {
      saveHistory({ sessionId, question, sql: rawSql, status: 'error', errorMessage: 'Unanswerable with current schema', durationMs: Date.now() - startedAt });
      return res.status(422).json({
        success: false,
        message: "That question doesn't match this database's schema. Try rephrasing it using the tables and columns shown above.",
        code: 'UNANSWERABLE',
      });
    }

    const { columns, rows } = runQuery(session.stored_path, safeSql);
    const durationMs = Date.now() - startedAt;

    saveHistory({ sessionId, question, sql: safeSql, rowCount: rows.length, status: 'success', durationMs });

    res.json({
      success: true,
      data: {
        question,
        sql: safeSql,
        columns,
        rows,
        rowCount: rows.length,
        durationMs,
      },
    });
  } catch (err) {
    saveHistory({
      sessionId,
      question,
      sql: safeSql || rawSql || '',
      status: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
});

module.exports = { askQuestion };
