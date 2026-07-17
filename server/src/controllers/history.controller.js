const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../db/metaDb');

const getHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = db.prepare(`SELECT id FROM sessions WHERE id = ?`).get(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  const rows = db
    .prepare(
      `SELECT id, question, sql_text AS sql, row_count AS rowCount, status, error_message AS errorMessage, duration_ms AS durationMs, created_at AS createdAt
       FROM query_history WHERE session_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(sessionId);

  res.json({ success: true, data: rows });
});

module.exports = { getHistory };
