const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

function buildSignedState({ roleHint, teacherCodeValid }) {
  return jwt.sign(
    {
      roleHint: String(roleHint || 'student').toLowerCase(),
      teacherCodeValid: Boolean(teacherCodeValid)
    },
    env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function parseSignedState(state) {
  try {
    const payload = jwt.verify(String(state || ''), env.JWT_SECRET);
    return {
      roleHint: String(payload.roleHint || 'student').toLowerCase(),
      teacherCodeValid: Boolean(payload.teacherCodeValid)
    };
  } catch (_error) {
    return null;
  }
}

function buildGithubAuthorizeUrl({ roleHint, inviteCode }) {
  const normalizedRole = String(roleHint || 'student').toLowerCase();
  const teacherCodeValid =
    normalizedRole === 'teacher' && String(inviteCode || '').trim() === String(env.TEACHER_INVITE_CODE).trim();
  const state = buildSignedState({
    roleHint: normalizedRole,
    teacherCodeValid
  });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: env.GITHUB_APP_SCOPE,
    state
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  let tokenResponse;
  try {
    tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_REDIRECT_URI
      },
      { headers: { Accept: 'application/json' }, timeout: 15000 }
    );
  } catch (error) {
    const detail = error?.response?.data?.error_description || error?.response?.data?.error || error.message;
    const wrapped = new Error(`GitHub token exchange failed: ${detail}`);
    wrapped.status = 400;
    throw wrapped;
  }

  const accessToken = tokenResponse.data.access_token;
  if (!accessToken) {
    const reason = tokenResponse.data.error_description || tokenResponse.data.error || 'missing access token';
    const error = new Error(`GitHub token exchange failed: ${reason}`);
    error.status = 400;
    throw error;
  }

  const client = axios.create({
    baseURL: env.GITHUB_API_URL,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json'
    }
  });

  const [profile, emails] = await Promise.all([
    client.get('/user'),
    client.get('/user/emails').catch(() => ({ data: [] }))
  ]);

  const primaryEmail = (emails.data || []).find((item) => item.primary)?.email || profile.data.email || null;

  return {
    githubId: String(profile.data.id),
    username: profile.data.login,
    email: primaryEmail
  };
}

function resolveInitialRole(stateData) {
  if (!stateData) return 'STUDENT';
  return stateData.roleHint === 'teacher' ? 'TEACHER' : 'STUDENT';
}

async function findOrCreateUser({ githubId, username, email, state }) {
  const stateData = parseSignedState(state);
  if (!stateData) {
    const error = new Error('OAuth state is invalid or expired, please retry login');
    error.status = 400;
    throw error;
  }
  const requestedTeacher = stateData?.roleHint === 'teacher';
  const hasValidTeacherCode = Boolean(stateData?.teacherCodeValid);

  const existing = await prisma.user.findUnique({ where: { githubId } });
  if (existing) {
    const nextRole = requestedTeacher && hasValidTeacherCode ? 'TEACHER' : existing.role;
    return prisma.user.update({
      where: { id: existing.id },
      data: { username, ...(email ? { email } : {}), role: nextRole }
    });
  }

  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      const nextRole = requestedTeacher && hasValidTeacherCode ? 'TEACHER' : existingByEmail.role;
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { githubId, username, role: nextRole }
      });
    }
  }
  if (requestedTeacher && !hasValidTeacherCode) {
    const error = new Error('Teacher invitation code is required for first teacher login');
    error.status = 403;
    error.code = 'TEACHER_CODE_REQUIRED';
    throw error;
  }

  return prisma.user.create({
    data: {
      githubId,
      username,
      email,
      role: resolveInitialRole(stateData)
    }
  });
}

module.exports = {
  buildGithubAuthorizeUrl,
  exchangeCode,
  findOrCreateUser
};
