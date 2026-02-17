const { ZodError } = require('zod');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues
      }
    });
  }

  const appError = err instanceof AppError ? err : new AppError(err.message || 'Unexpected error');
  logger.error({ err: appError, requestId: req.requestId }, 'Request failed');
  return res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details
    }
  });
}

module.exports = { notFound, errorHandler };
