const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../db/metaDb');

const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = db.prepare(`SELECT id, original_name AS fileName, size_bytes AS sizeBytes, schema_json AS schemaJson, created_at AS createdAt FROM sessions WHERE id = ?`).get(sessionId);

  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  res.json({
    success: true,
    data: { ...session, schema: JSON.parse(session.schemaJson), schemaJson: undefined },
  });
});

const deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = db.prepare(`SELECT stored_path AS storedPath FROM sessions WHERE id = ?`).get(sessionId);

  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  fs.unlink(session.storedPath, () => {}); // best-effort cleanup of the uploaded file
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId); // cascades to query_history

  res.json({ success: true, message: 'Session and uploaded file deleted.' });
});

module.exports = { getSession, deleteSession };
