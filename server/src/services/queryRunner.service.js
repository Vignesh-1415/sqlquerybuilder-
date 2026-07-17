// Executes an already-sanitized SELECT against the uploaded SQLite file.
// Defense in depth: the connection itself is opened read-only AND
// query_only is set, so even a query that slipped past the regex checks
// in sqlSafety.service.js physically cannot write to the file.

const Database = require('better-sqlite3');
const AppError = require('../utils/AppError');

function runQuery(filePath, sql) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');

  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all();
    const columns = stmt.columns().map((c) => c.name);
    return { columns, rows };
  } catch (err) {
    throw new AppError(`The database rejected the query: ${err.message}`, 422, 'QUERY_EXECUTION_FAILED');
  } finally {
    db.close();
  }
}

module.exports = { runQuery };
