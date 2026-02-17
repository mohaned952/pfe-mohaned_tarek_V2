const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');
const { ok } = require('../utils/http');
const {
  createSubmission,
  listStudentSubmissions,
  getStudentSubmission
} = require('../services/submission.service');

const router = express.Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(requireAuth, requireRole('STUDENT'));

router.get('/submissions', wrap(async (req, res) => {
  const data = await listStudentSubmissions(req.user.id);
  return ok(res, data);
}));

router.get('/submissions/:id', wrap(async (req, res) => {
  const one = await getStudentSubmission({ studentId: req.user.id, submissionId: Number(req.params.id) });
  if (!one) return res.status(404).json({ ok: false, error: 'Submission not found' });
  return ok(res, one);
}));

router.post('/submissions', wrap(async (req, res) => {
  const created = await createSubmission({
    studentId: req.user.id,
    repoUrl: req.body.repoUrl,
    repoBranch: req.body.repoBranch || 'main',
    language: req.body.language
  });
  return ok(res, created, 201);
}));

module.exports = router;
