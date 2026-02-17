const { fail } = require('../utils/http');

function notFound(_req, res) {
  return fail(res, 404, 'Route not found');
}

function errorHandler(err, _req, res, _next) {
  const status = Number(err.status || 500);
  const message = status >= 500 ? 'Internal server error' : err.message;
  return fail(res, status, message);
}

module.exports = { notFound, errorHandler };
