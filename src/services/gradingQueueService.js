const { randomUUID } = require('node:crypto');
const gradingQueue = require('../queue/gradingQueue');

async function enqueueGrading({ submissionId, requestId }) {
  return gradingQueue.add(
    'grade-submission',
    {
      submissionId,
      requestId: requestId || randomUUID()
    },
    {
      timeout: 1000 * 60 * 4
    }
  );
}

module.exports = {
  enqueueGrading
};
