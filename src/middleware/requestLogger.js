const pinoHttp = require('pino-http');
const logger = require('../config/logger');

const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  customProps: (req) => ({ requestId: req.requestId })
});

module.exports = requestLogger;
