const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startCleanupJob } = require('./utils/cleanupJob');

const server = app.listen(env.port, () => {
  logger.info(`Statement API listening on port ${env.port} (${env.nodeEnv})`);
  startCleanupJob();
});

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
