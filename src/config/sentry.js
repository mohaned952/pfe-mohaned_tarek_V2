let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_error) {
  Sentry = null;
}

const env = require('./env');

function initSentry() {
  if (!Sentry) return null;
  if (!process.env.SENTRY_DSN) return null;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.APP_VERSION,
    tracesSampleRate: 0.1
  });

  return Sentry;
}

module.exports = {
  initSentry
};
