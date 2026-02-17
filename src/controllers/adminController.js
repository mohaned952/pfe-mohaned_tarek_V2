const { ok } = require('../utils/apiResponse');
const service = require('../services/adminService');

function respond(handler) {
  return async (req, res) => ok(res, await handler(req));
}

const login = respond((req) => service.adminLogin(req.body));

const deleteAllStudents = respond((req) =>
  service.deleteAllStudents({ adminPassword: req.headers['x-admin-password'] })
);

const createTeacher = respond((req) => service.createTeacher(req.body));

const revealPassword = respond((req) =>
  service.revealTeacherPassword({
    adminPassword: req.body.adminPassword,
    teacherId: req.params.id
  })
);

const changePassword = respond((req) =>
  service.changeTeacherPassword({
    adminPassword: req.body.adminPassword,
    teacherId: req.params.id,
    newPassword: req.body.newPassword
  })
);

const deleteTeacher = respond((req) =>
  service.deleteTeacher({
    adminPassword: req.headers['x-admin-password'],
    teacherId: req.params.id
  })
);

const analyticsSubmissions = respond((req) =>
  service.getSubmissionTrends({
    adminPassword: req.headers['x-admin-password'],
    interval: req.query.interval
  })
);

const analyticsGrades = respond((req) =>
  service.getGradeDistribution({
    adminPassword: req.headers['x-admin-password']
  })
);

const analyticsAgents = respond((req) =>
  service.getAgentMetrics({
    adminPassword: req.headers['x-admin-password']
  })
);

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
