const express = require('express');
const { getSession, deleteSession } = require('../controllers/session.controller');
const { validateSessionIdParam } = require('../validators/query.validator');

const router = express.Router();

// GET    /api/session/:sessionId
// DELETE /api/session/:sessionId
router.get('/:sessionId', validateSessionIdParam, getSession);
router.delete('/:sessionId', validateSessionIdParam, deleteSession);

module.exports = router;
