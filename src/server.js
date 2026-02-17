const { createApp, env } = require('./app');
const logger = require('./config/logger');
const prisma = require('./config/prisma');
const redis = require('./config/redis');
const { initSentry } = require('./config/sentry');

initSentry();
const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server started');
});

async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close(async () => {
    await prisma.$disconnect().catch(() => null);
    await redis.quit().catch(() => null);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
