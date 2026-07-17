// Centralized environment configuration.
// Every value the app needs from process.env is read here, once, with a
// sane default where a default is safe. Nothing else in the codebase
// should call process.env directly — import this module instead.

require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  // Comma-separated list of allowed origins for CORS.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Free-tier AI provider (Groq's OpenAI-compatible API — free tier available).
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  groqApiUrl: process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',

  // Storage.
  dataDir: process.env.DATA_DIR || require('path').join(__dirname, '..', '..', 'data'),
  uploadsDir: process.env.UPLOADS_DIR || require('path').join(__dirname, '..', '..', 'uploads'),
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '15', 10),

  // Query safety limits.
  maxResultRows: parseInt(process.env.MAX_RESULT_ROWS || '200', 10),
  queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10),

  // Session/file retention (hours) before a cleanup pass may remove them.
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
};

module.exports = env;
