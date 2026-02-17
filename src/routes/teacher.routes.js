const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');
const { ok } = require('../utils/http');
const { listTeacherSubmissions, gradeOne } = require('../services/submission.service');
const { saveSuite, listSuites } = require('../services/suite.service');
const { teacherAnalytics } = require('../services/analytics.service');

const router = express.Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(requireAuth, requireRole('TEACHER'));

router.get('/submissions', wrap(async (req, res) => ok(res, await listTeacherSubmissions(req.user.id))));

router.post('/submissions/:id/grade', wrap(async (req, res) => {
  const graded = await gradeOne({ teacherId: req.user.id, submissionId: Number(req.params.id) });
  return ok(res, graded);
}));

router.get('/suites', wrap(async (req, res) => ok(res, await listSuites(req.user.id))));

router.post('/suites', wrap(async (req, res) => {
  const suite = await saveSuite({
    teacherId: req.user.id,
    title: req.body.title,
    language: req.body.language,
    groupName: req.body.groupName,
    year: req.body.year,
    definition: req.body.definition
  });
  return ok(res, suite, 201);
}));

router.get('/analytics', wrap(async (req, res) => ok(res, await teacherAnalytics())));

module.exports = router;
