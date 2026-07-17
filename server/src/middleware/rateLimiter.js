const rateLimit = require('express-rate-limit');

// Applied to the /api/query route specifically, since each request there
// spends a call against the free AI quota. Kept generous for a student
// project demo while still stopping runaway loops or scripts.
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many questions in a short time. Wait a minute and try again.' },
});

// A looser limiter for the whole API, as a general safety net.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = { queryLimiter, generalLimiter };
