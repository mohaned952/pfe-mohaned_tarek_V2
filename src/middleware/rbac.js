function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const role = String(req.headers['x-role'] || '').toLowerCase();
    if (!allowedRoles.map((r) => r.toLowerCase()).includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role permissions.'
        }
      });
    }
    req.role = role;
    return next();
  };
}

module.exports = { requireRole };
