const bcrypt = require('bcrypt');

async function verifyPassword(plainPassword, storedPassword) {
  const input = String(plainPassword || '').trim();
  const stored = String(storedPassword || '');
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored);
  }
  return input === stored;
}

function hashPassword(password) {
  const value = String(password || '').trim();
  if (!value) return value;
  return bcrypt.hashSync(value, 10);
}

module.exports = {
  verifyPassword,
  hashPassword
};
