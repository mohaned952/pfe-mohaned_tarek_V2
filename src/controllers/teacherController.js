const { ok } = require('../utils/apiResponse');
const { startSingleCorrection, startBulkCorrection } = require('../services/gradingOrchestratorService');

function respond(handler) {
  return async (req, res) => ok(res, await handler(req));
}

const startCorrection = respond((req) =>
  startSingleCorrection({
    submissionId: req.body.submissionId,
    teacherId: req.body.teacherId,
    instructions: req.body.instructions,
    requestId: req.requestId
  })
);

const startBulk = respond((req) =>
  startBulkCorrection({
    teacherId: req.body.teacherId,
    filters: req.body.filters,
    instructions: req.body.instructions,
    requestId: req.requestId
  })
);

module.exports = {
  startCorrection,
  startBulk
};
