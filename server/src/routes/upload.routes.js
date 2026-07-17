const express = require('express');
const upload = require('../middleware/upload');
const { uploadFile } = require('../controllers/upload.controller');

const router = express.Router();

// POST /api/upload  (multipart/form-data, field name: "database")
router.post('/', upload.single('database'), uploadFile);

module.exports = router;
