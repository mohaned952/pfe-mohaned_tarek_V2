const { ok } = require('../utils/apiResponse');
const teacherService = require('../services/teacherPortalService');
const orchestrator = require('../services/gradingOrchestratorService');

async function login(req, res) {
  const data = await teacherService.loginTeacher(req.body);
  return ok(res, data);
}

async function list(req, res) {
  const data = await teacherService.listTeachers();
  return ok(res, data);
}

async function students(req, res) {
  const data = await teacherService.listTeacherStudents(req.query.teacherId);
  return ok(res, data);
}

async function submissions(req, res) {
  const data = await teacherService.listTeacherSubmissions(req.query.teacherId);
  return ok(res, data);
}

async function deleteStudent(req, res) {
  const data = await teacherService.deleteTeacherStudent(req.params.id);
  return ok(res, data);
}

async function approve(req, res) {
  const data = await teacherService.approveSubmission(req.body);
  return ok(res, data);
}

async function startCorrection(req, res) {
  const data = await orchestrator.startSingleCorrection({
    submissionId: req.body.submissionId,
    teacherId: req.body.teacherId,
    instructions: req.body.instructions || req.body.barem,
    requestId: req.requestId
  });
  return ok(res, data);
}

async function startCorrectionBulk(req, res) {
  const data = await orchestrator.startBulkCorrection({
    teacherId: req.body.teacherId,
    filters: req.body.filters || {},
    instructions: req.body.instructions || req.body.barem,
    requestId: req.requestId
  });
  return ok(res, data);
}

async function approveBulk(req, res) {
  const data = await teacherService.approveBulkSubmissions(req.body);
  return ok(res, data);
}

async function startCorrectionSelected(req, res) {
  const data = await teacherService.startCorrectionForSelected({
    teacherId: req.body.teacherId,
    submissionIds: req.body.submissionIds,
    instructions: req.body.instructions,
    requestId: req.requestId
  });
  return ok(res, data);
}

async function listTestSuites(req, res) {
  const data = await teacherService.getTeacherTestSuites({
    teacherId: req.query.teacherId
  });
  return ok(res, data);
}

async function saveTestSuite(req, res) {
  const data = await teacherService.saveTeacherTestSuite({
    teacherId: req.body.teacherId,
    groupName: req.body.groupName,
    year: req.body.year,
    name: req.body.name,
    definition: req.body.definition
  });
  return ok(res, data);
}

async function uploadTestSuite(req, res) {
  const data = await teacherService.uploadTeacherTestSuite({
    teacherId: req.body.teacherId,
    groupName: req.body.groupName,
    year: req.body.year,
    name: req.body.name,
    content: req.body.content,
    format: req.body.format,
    language: req.body.language,
    entrypoint: req.body.entrypoint
  });
  return ok(res, data);
}

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
