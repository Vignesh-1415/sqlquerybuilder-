const express = require('express');
const { askQuestion } = require('../controllers/query.controller');
const { validateQueryRequest } = require('../validators/query.validator');
const { queryLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/query  { sessionId, question }
router.post('/', queryLimiter, validateQueryRequest, askQuestion);

module.exports = router;
