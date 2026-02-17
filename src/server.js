const { createApp } = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const app = createApp();
const server = app.listen(env.PORT, () => {
  process.stdout.write(`Server running on http://localhost:${env.PORT}\n`);
});

async function shutdown() {
  await prisma.$disconnect().catch(() => null);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
