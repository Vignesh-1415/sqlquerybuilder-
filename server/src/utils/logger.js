// Minimal structured logger. Kept dependency-free on purpose — morgan
// already covers HTTP access logs; this is for application-level events.
function timestamp() {
  return new Date().toISOString();
}

module.exports = {
  info: (msg, meta = {}) => console.log(`[${timestamp()}] INFO  ${msg}`, meta && Object.keys(meta).length ? meta : ''),
  warn: (msg, meta = {}) => console.warn(`[${timestamp()}] WARN  ${msg}`, meta && Object.keys(meta).length ? meta : ''),
  error: (msg, meta = {}) => console.error(`[${timestamp()}] ERROR ${msg}`, meta && Object.keys(meta).length ? meta : ''),
};
