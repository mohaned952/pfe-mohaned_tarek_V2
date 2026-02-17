const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: ['error', 'warn']
});

prisma.$on('error', (event) => {
  logger.error({ prisma: event }, 'Prisma error event');
});

module.exports = prisma;
