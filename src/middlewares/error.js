const { fail } = require('../utils/http');

function notFound(_req, res) {
  return fail(res, 404, 'Route not found');
}

function errorHandler(err, _req, res, _next) {
  const status = Number(err.status || 500);
  const message = status >= 500 ? 'Internal server error' : err.message;
  if (status >= 500) {
    process.stderr.write(`[error] ${err.message}\n`);
    if (err.stack) process.stderr.write(`${err.stack}\n`);
  }
  return fail(res, status, message);
}

module.exports = { notFound, errorHandler };
