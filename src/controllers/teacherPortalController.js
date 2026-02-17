const { ok } = require('../utils/apiResponse');
const teacherService = require('../services/teacherPortalService');
const orchestrator = require('../services/gradingOrchestratorService');

function respond(handler) {
  return async (req, res) => ok(res, await handler(req));
}

const login = respond((req) => teacherService.loginTeacher(req.body));
const list = respond(() => teacherService.listTeachers());
const students = respond((req) => teacherService.listTeacherStudents(req.query.teacherId));
const submissions = respond((req) => teacherService.listTeacherSubmissions(req.query.teacherId));
const deleteStudent = respond((req) => teacherService.deleteTeacherStudent(req.params.id));
const approve = respond((req) => teacherService.approveSubmission(req.body));

const startCorrection = respond((req) =>
  orchestrator.startSingleCorrection({
    submissionId: req.body.submissionId,
    teacherId: req.body.teacherId,
    instructions: req.body.instructions || req.body.barem,
    requestId: req.requestId
  })
);

const startCorrectionBulk = respond((req) =>
  orchestrator.startBulkCorrection({
    teacherId: req.body.teacherId,
    filters: req.body.filters || {},
    instructions: req.body.instructions || req.body.barem,
    requestId: req.requestId
  })
);

const approveBulk = respond((req) => teacherService.approveBulkSubmissions(req.body));

const startCorrectionSelected = respond((req) =>
  teacherService.startCorrectionForSelected({
    teacherId: req.body.teacherId,
    submissionIds: req.body.submissionIds,
    instructions: req.body.instructions,
    requestId: req.requestId
  })
);

const listTestSuites = respond((req) =>
  teacherService.getTeacherTestSuites({
    teacherId: req.query.teacherId
  })
);

const saveTestSuite = respond((req) =>
  teacherService.saveTeacherTestSuite({
    teacherId: req.body.teacherId,
    groupName: req.body.groupName,
    year: req.body.year,
    name: req.body.name,
    definition: req.body.definition
  })
);

const uploadTestSuite = respond((req) =>
  teacherService.uploadTeacherTestSuite({
    teacherId: req.body.teacherId,
    groupName: req.body.groupName,
    year: req.body.year,
    name: req.body.name,
    content: req.body.content,
    format: req.body.format,
    language: req.body.language,
    entrypoint: req.body.entrypoint
  })
);

module.exports = {
  login,
  list,
  students,
  submissions,
  deleteStudent,
  approve,
  startCorrection,
  startCorrectionBulk,
  approveBulk,
  startCorrectionSelected,
  listTestSuites,
  saveTestSuite,
  uploadTestSuite
};
