const { ok } = require('../utils/apiResponse');
const service = require('../services/adminService');

async function login(req, res) {
  const data = await service.adminLogin(req.body);
  return ok(res, data);
}

async function deleteAllStudents(req, res) {
  const data = await service.deleteAllStudents({ adminPassword: req.headers['x-admin-password'] });
  return ok(res, data);
}

async function createTeacher(req, res) {
  const data = await service.createTeacher(req.body);
  return ok(res, data);
}

async function revealPassword(req, res) {
  const data = await service.revealTeacherPassword({
    adminPassword: req.body.adminPassword,
    teacherId: req.params.id
  });
  return ok(res, data);
}

async function changePassword(req, res) {
  const data = await service.changeTeacherPassword({
    adminPassword: req.body.adminPassword,
    teacherId: req.params.id,
    newPassword: req.body.newPassword
  });
  return ok(res, data);
}

async function deleteTeacher(req, res) {
  const data = await service.deleteTeacher({
    adminPassword: req.headers['x-admin-password'],
    teacherId: req.params.id
  });
  return ok(res, data);
}

async function analyticsSubmissions(req, res) {
  const data = await service.getSubmissionTrends({
    adminPassword: req.headers['x-admin-password'],
    interval: req.query.interval
  });
  return ok(res, data);
}

async function analyticsGrades(req, res) {
  const data = await service.getGradeDistribution({
    adminPassword: req.headers['x-admin-password']
  });
  return ok(res, data);
}

async function analyticsAgents(req, res) {
  const data = await service.getAgentMetrics({
    adminPassword: req.headers['x-admin-password']
  });
  return ok(res, data);
}

module.exports = {
  login,
  deleteAllStudents,
  createTeacher,
  revealPassword,
  changePassword,
  deleteTeacher,
  analyticsSubmissions,
  analyticsGrades,
  analyticsAgents
};
