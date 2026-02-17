const http = require('http');

const req = http.request(
  {
    host: '127.0.0.1',
    port: process.env.PORT || 3000,
    path: '/api/health/live',
    method: 'GET'
  },
  (res) => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      process.exit(0);
    }
    process.exit(1);
  }
);

req.on('error', () => process.exit(1));
req.end();
