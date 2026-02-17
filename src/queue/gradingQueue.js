const { Queue } = require('bullmq');
const redis = require('../config/redis');

const gradingQueue = new Queue('grading-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1500
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
});

module.exports = gradingQueue;
