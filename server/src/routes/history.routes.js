const express = require('express');
const { getHistory } = require('../controllers/history.controller');
const { validateSessionIdParam } = require('../validators/query.validator');

const router = express.Router();

// GET /api/history/:sessionId
router.get('/:sessionId', validateSessionIdParam, getHistory);

module.exports = router;
