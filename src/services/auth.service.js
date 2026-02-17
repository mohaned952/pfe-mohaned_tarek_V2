const axios = require('axios');
const prisma = require('../config/prisma');
const env = require('../config/env');

const pendingStates = new Map();

function buildGithubAuthorizeUrl({ roleHint, inviteCode }) {
  const state = Math.random().toString(36).slice(2);
  pendingStates.set(state, {
    roleHint: String(roleHint || 'student').toLowerCase(),
    inviteCode: String(inviteCode || ''),
    expiresAt: Date.now() + 10 * 60 * 1000
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
  const stateData = pendingStates.get(state);
  pendingStates.delete(state);

  if (stateData && stateData.expiresAt < Date.now()) {
    throw new Error('OAuth state expired, please retry login');
  }

  const existing = await prisma.user.findUnique({ where: { githubId } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username, ...(email ? { email } : {}) }
    });
  }

  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { githubId, username }
      });
    }
  }

  const requestedTeacher = stateData?.roleHint === 'teacher';
  const hasValidTeacherCode = stateData?.inviteCode === env.TEACHER_INVITE_CODE;
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
