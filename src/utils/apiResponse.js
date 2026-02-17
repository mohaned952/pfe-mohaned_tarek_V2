function ok(res, data, meta = {}) {
  return res.json({ success: true, data, meta });
}

function fail(res, statusCode, code, message, details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details
    }
  });
}

module.exports = { ok, fail };
