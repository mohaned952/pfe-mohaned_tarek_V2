const express = require('express');
const path = require('path');

const env = require('./config/env');
const requestContext = require('./utils/requestContext');
const requestLogger = require('./middleware/requestLogger');
const { helmetMiddleware, corsMiddleware, limiter } = require('./middleware/security');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(requestLogger);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(limiter);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.use('/api', routes);

  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
  env
};
