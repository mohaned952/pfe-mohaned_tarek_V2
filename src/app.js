const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

function createApp() {
  const app = express();
  const webDir = path.join(__dirname, '../web');
  const legacyFrontendDir = path.join(__dirname, '../frontend');
  const publicDir = fs.existsSync(webDir) ? webDir : legacyFrontendDir;
  const landingPage = fs.existsSync(path.join(publicDir, 'index.html'))
    ? path.join(publicDir, 'index.html')
    : null;

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use('/api', routes);

  app.use(express.static(publicDir));
  app.get('/', (_req, res, next) => {
    if (!landingPage) return next(Object.assign(new Error('Landing page not found'), { status: 500 }));
    return res.sendFile(landingPage);
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
