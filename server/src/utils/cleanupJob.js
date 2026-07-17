// Periodically removes upload sessions (and their files) older than
// SESSION_TTL_HOURS, so a free-tier host's small disk doesn't fill up
// with abandoned uploads.

const fs = require('fs');
const db = require('../db/metaDb');
const env = require('../config/env');
const logger = require('./logger');

function cleanupOldSessions() {
  const cutoff = `-${env.sessionTtlHours} hours`;
  const stale = db
    .prepare(`SELECT id, stored_path AS storedPath FROM sessions WHERE last_used_at < datetime('now', ?)`)
    .all(cutoff);

  if (stale.length === 0) return;

  const del = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  for (const session of stale) {
    fs.unlink(session.storedPath, () => {});
    del.run(session.id);
  }
  logger.info(`Cleaned up ${stale.length} expired session(s).`);
}

function startCleanupJob() {
  cleanupOldSessions();
  const oneHourMs = 60 * 60 * 1000;
  setInterval(cleanupOldSessions, oneHourMs).unref();
}

module.exports = { startCleanupJob, cleanupOldSessions };
