const { Worker } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../config/logger');
const WorkflowManager = require('../agents/WorkflowManager');

const workflow = new WorkflowManager();

const worker = new Worker(
  'grading-jobs',
  async (job) => {
    const { submissionId, requestId } = job.data;

    const result = await workflow.runGrading({ submissionId, requestId });

    return result;
  },
  {
    connection: redis,
    concurrency: 1
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Grading job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Grading job failed');
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
