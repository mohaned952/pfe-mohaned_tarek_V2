const { ok } = require('../utils/apiResponse');
const { startSingleCorrection, startBulkCorrection } = require('../services/gradingOrchestratorService');

async function startCorrection(req, res) {
  const result = await startSingleCorrection({
    submissionId: req.body.submissionId,
    teacherId: req.body.teacherId,
    instructions: req.body.instructions,
    requestId: req.requestId
  });
  return ok(res, result);
}

async function startBulk(req, res) {
  const result = await startBulkCorrection({
    teacherId: req.body.teacherId,
    filters: req.body.filters,
    instructions: req.body.instructions,
    requestId: req.requestId
  });
  return ok(res, result);
}

module.exports = {
  startCorrection,
  startBulk
};
