const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../db/metaDb');
const { inspectSchema } = require('../services/sqliteInspector.service');

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file was uploaded. Choose a .db, .sqlite, or .sqlite3 file.', 422, 'NO_FILE');
  }

  const sessionId = req.generatedSessionId;
  const filePath = req.file.path;

  let schema;
  try {
    schema = inspectSchema(filePath);
  } catch (err) {
    fs.unlink(filePath, () => {}); // clean up the bad upload
    throw err;
  }

  db.prepare(
    `INSERT INTO sessions (id, original_name, stored_path, schema_json, size_bytes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, req.file.originalname, filePath, JSON.stringify(schema), req.file.size);

  res.status(201).json({
    success: true,
    message: 'Database uploaded and schema detected.',
    data: {
      sessionId,
      fileName: req.file.originalname,
      sizeBytes: req.file.size,
      schema,
    },
  });
});

module.exports = { uploadFile };
