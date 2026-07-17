// Opens an uploaded SQLite file READ-ONLY and extracts a structured
// description of its schema: tables, columns, types, and foreign keys.
// This schema is what gets shown to the AI model and to the user — the
// uploaded file itself is never sent anywhere.

const Database = require('better-sqlite3');
const AppError = require('../utils/AppError');

function inspectSchema(filePath) {
  let db;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch (err) {
    throw new AppError('The uploaded file is not a valid SQLite database.', 422, 'INVALID_SQLITE_FILE');
  }

  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all();

    if (tables.length === 0) {
      throw new AppError('The uploaded database has no user tables.', 422, 'EMPTY_DATABASE');
    }

    const schema = tables.map(({ name }) => {
      const columns = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all().map((col) => ({
        name: col.name,
        type: col.type || 'TEXT',
        notNull: !!col.notnull,
        primaryKey: !!col.pk,
      }));

      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quoteIdent(name)})`).all().map((fk) => ({
        column: fk.from,
        referencesTable: fk.table,
        referencesColumn: fk.to,
      }));

      const rowCount = db.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(name)}`).get().c;

      return { table: name, rowCount, columns, foreignKeys };
    });

    return schema;
  } finally {
    db.close();
  }
}

function quoteIdent(identifier) {
  // Defends against odd table names; identifiers come from sqlite_master itself, not user input.
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

/** Renders the schema as compact text for the model prompt. */
function schemaToPromptText(schema) {
  return schema
    .map((t) => {
      const cols = t.columns
        .map((c) => `${c.name} ${c.type}${c.primaryKey ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}`)
        .join(', ');
      const fks = t.foreignKeys.length
        ? ' -- FKs: ' + t.foreignKeys.map((fk) => `${fk.column} -> ${fk.referencesTable}.${fk.referencesColumn}`).join(', ')
        : '';
      return `TABLE ${t.table} (${cols})${fks}`;
    })
    .join('\n');
}

module.exports = { inspectSchema, schemaToPromptText, quoteIdent };
