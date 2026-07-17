const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(' ');
    return next(new AppError(message, 422, 'VALIDATION_ERROR'));
  }
  next();
}

const validateQueryRequest = [
  body('sessionId')
    .trim()
    .notEmpty().withMessage('sessionId is required.')
    .isUUID().withMessage('sessionId must be a valid session identifier.'),
  body('question')
    .trim()
    .notEmpty().withMessage('Enter a question before asking Statement.')
    .isLength({ min: 4, max: 500 }).withMessage('Questions must be between 4 and 500 characters.'),
  handleValidation,
];

const validateSessionIdParam = [
  param('sessionId').trim().isUUID().withMessage('Invalid session id.'),
  handleValidation,
];

module.exports = { validateQueryRequest, validateSessionIdParam };
