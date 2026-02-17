const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const gradingDuration = new client.Histogram({
  name: 'grading_duration_seconds',
  help: 'Time spent grading a submission',
  labelNames: ['status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 40]
});

const gradingFailures = new client.Counter({
  name: 'grading_failures_total',
  help: 'Total number of grading failures',
  labelNames: ['reason']
});

register.registerMetric(gradingDuration);
register.registerMetric(gradingFailures);

module.exports = {
  register,
  gradingDuration,
  gradingFailures
};
