// Guards against anything but a single, read-only SELECT (or a read-only
// CTE that ends in one). This runs on every AI-generated query before it
// ever touches the uploaded database, regardless of what the model
// returned. Defense happens here, not by trusting the model's output.

const AppError = require('../utils/AppError');

const WRITE_OR_DDL_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE',
  'TRUNCATE', 'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'PRAGMA',
  'GRANT', 'REVOKE', 'BEGIN', 'COMMIT', 'ROLLBACK',
];

function stripComments(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function assertSingleStatement(sql) {
  // Remove string literals so semicolons inside strings don't confuse the check.
  const withoutStrings = sql.replace(/'([^'\\]|\\.)*'/g, "''");
  const statements = withoutStrings.split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    throw new AppError('Only a single SQL statement is allowed.', 422, 'MULTI_STATEMENT');
  }
}

function assertReadOnly(sql) {
  const upper = sql.toUpperCase();

  const startsWithSelectOrWith = /^\s*(SELECT|WITH)\b/i.test(sql);
  if (!startsWithSelectOrWith) {
    throw new AppError('Only SELECT queries can be run. The generated query was rejected for safety.', 422, 'NOT_READ_ONLY');
  }

  for (const keyword of WRITE_OR_DDL_KEYWORDS) {
    const pattern = new RegExp(`(^|[^A-Z_])${keyword}([^A-Z_]|$)`, 'i');
    if (pattern.test(upper)) {
      throw new AppError(`The generated query contains a disallowed keyword ("${keyword}") and was rejected for safety.`, 422, 'FORBIDDEN_KEYWORD');
    }
  }
}

function ensureRowLimit(sql, maxRows) {
  const hasLimit = /\bLIMIT\s+\d+/i.test(sql);
  if (hasLimit) return sql.trim().replace(/;+\s*$/, '');
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT ${maxRows}`;
}

/**
 * Validates and normalizes a model-generated SQL string.
 * Throws AppError (422) if the query is unsafe.
 * Returns a cleaned, single-statement, row-capped SELECT string.
 */
function sanitizeGeneratedSql(rawSql, { maxRows }) {
  if (!rawSql || typeof rawSql !== 'string') {
    throw new AppError('The model did not return a usable SQL query.', 502, 'EMPTY_SQL');
  }

  let sql = stripComments(rawSql)
    .replace(/^```sql/i, '')
    .replace(/^```/,'')
    .replace(/```$/, '')
    .trim();

  if (!sql) {
    throw new AppError('The model did not return a usable SQL query.', 502, 'EMPTY_SQL');
  }

  assertSingleStatement(sql);
  assertReadOnly(sql);
  sql = ensureRowLimit(sql, maxRows);

  return sql;
}

module.exports = { sanitizeGeneratedSql };
