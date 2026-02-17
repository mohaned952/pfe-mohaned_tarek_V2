const { verifySession } = require('../utils/jwt');
const prisma = require('../config/prisma');

async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies.session || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return next(Object.assign(new Error('Authentication required'), { status: 401 }));

    const claims = verifySession(token);
    const user = await prisma.user.findUnique({ where: { id: Number(claims.sub) } });
    if (!user) return next(Object.assign(new Error('User not found'), { status: 401 }));

    req.user = user;
    return next();
  } catch (_error) {
    return next(Object.assign(new Error('Invalid session'), { status: 401 }));
  }
}

module.exports = { requireAuth };
