const multer = require('multer');
const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express recognizes this as an error handler purely by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum allowed size is ${env.maxUploadMb}MB.`
        : err.message;
    return res.status(400).json({ success: false, message, code: err.code });
  }

  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Something went wrong on our end. Please try again.',
    code: err.code || 'INTERNAL_ERROR',
  });
}

module.exports = { notFoundHandler, errorHandler };
