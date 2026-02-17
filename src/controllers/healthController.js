const { register } = require('../utils/metrics');
const { ok } = require('../utils/apiResponse');

async function live(_req, res) {
  return ok(res, { status: 'ok' });
}

async function ready(_req, res) {
  return ok(res, { status: 'ready' });
}

async function metrics(_req, res) {
  const payload = await register.metrics();
  res.set('Content-Type', register.contentType);
  return res.send(payload);
}

module.exports = {
  live,
  ready,
  metrics
};
