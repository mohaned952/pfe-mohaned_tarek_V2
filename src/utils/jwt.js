const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
}

function verifySession(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signSession, verifySession };
