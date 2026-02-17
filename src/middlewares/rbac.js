function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(Object.assign(new Error('Forbidden'), { status: 403 }));
    }
    return next();
  };
}

module.exports = { requireRole };
