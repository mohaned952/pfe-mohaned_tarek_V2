const { ok } = require('../utils/apiResponse');
const service = require('../services/studentService');

function respond(handler) {
  return async (req, res) => ok(res, await handler(req));
}

const login = respond((req) =>
  service.loginOrRegisterStudent({
    name: req.body.name,
    studentId: req.body.student_id
  })
);

const submit = respond((req) =>
  service.submitRepository({
    studentId: req.body.studentId,
    teacherId: req.body.teacherId,
    repoUrl: req.body.repoUrl,
    groupName: req.body.group_name,
    year: req.body.year
  })
);

const submissions = respond((req) => service.listStudentSubmissions(req.params.studentId));

const approvedGrades = respond((req) => service.listApprovedStudentGrades(req.params.studentId));

const requirements = respond((req) => service.getStudentRequirements(req.params.studentId));

module.exports = {
  login,
  submit,
  submissions,
  approvedGrades,
  requirements
};
