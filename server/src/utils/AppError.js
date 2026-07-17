// A predictable, operational error. Anything thrown as AppError is safe to
// show to the client (its .message is user-facing by design). Anything
// else that bubbles up to the error handler is treated as a bug and a
// generic message is shown instead, so internals never leak.
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
