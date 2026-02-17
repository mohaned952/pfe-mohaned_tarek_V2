const express = require('express');
const { buildGithubAuthorizeUrl, exchangeCode, findOrCreateUser } = require('../services/auth.service');
const { requireAuth } = require('../middlewares/auth');
const { signSession } = require('../utils/jwt');
const { ok } = require('../utils/http');

const router = express.Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/github', (req, res) => {
  const url = buildGithubAuthorizeUrl({
    roleHint: req.query.role || 'student',
    inviteCode: req.query.inviteCode || ''
  });
  res.redirect(url);
});

router.get('/github/callback', async (req, res, next) => {
  try {
    const profile = await exchangeCode(req.query.code);
    const user = await findOrCreateUser({ ...profile, state: req.query.state });
    const token = signSession(user);

    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    });

    const target = user.role === 'TEACHER' ? '/teacher.html' : '/student.html';
    return res.redirect(target);
  } catch (error) {
    if (String(error.message || '').includes('code passed is incorrect or expired')) {
      return res.redirect('/?oauthRetry=1');
    }
    if (error.code === 'TEACHER_CODE_REQUIRED') {
      return res.redirect('/?teacherCodeRequired=1');
    }
    return next(error);
  }
});

router.get('/me', requireAuth, wrap(async (req, res) => ok(res, req.user)));

router.post('/logout', (_req, res) => {
  res.clearCookie('session');
  return ok(res, { loggedOut: true });
});

module.exports = router;
