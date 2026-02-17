const { ok } = require('../utils/apiResponse');
const service = require('../services/studentService');

async function login(req, res) {
  const data = await service.loginOrRegisterStudent({
    name: req.body.name,
    studentId: req.body.student_id
  });
  return ok(res, data);
}

async function submit(req, res) {
  const data = await service.submitRepository({
    studentId: req.body.studentId,
    teacherId: req.body.teacherId,
    repoUrl: req.body.repoUrl,
    groupName: req.body.group_name,
    year: req.body.year
  });
  return ok(res, data);
}

async function submissions(req, res) {
  const data = await service.listStudentSubmissions(req.params.studentId);
  return ok(res, data);
}

async function approvedGrades(req, res) {
  const data = await service.listApprovedStudentGrades(req.params.studentId);
  return ok(res, data);
}

async function requirements(req, res) {
  const data = await service.getStudentRequirements(req.params.studentId);
  return ok(res, data);
}

module.exports = {
  login,
  submit,
  submissions,
  approvedGrades,
  requirements
};
