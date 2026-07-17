const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const env = require('../config/env');
const AppError = require('../utils/AppError');

fs.mkdirSync(env.uploadsDir, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = uuid();
    req.generatedSessionId = id;
    cb(null, `${id}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new AppError('Only .db, .sqlite, or .sqlite3 files are accepted.', 422, 'INVALID_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
});

module.exports = upload;
