const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional(),
  DB_PATH: z.string().default('./backend/db/platform.db'),
  GOOGLE_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GITHUB_TOKEN: z.string().optional().default(''),
  TEST_EXECUTION_MODE: z.enum(['local', 'docker']).default('local'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_VERSION: z.string().default('2.0.0')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

const env = parsed.data;
if (!env.DATABASE_URL) {
  const dbPath = String(env.DB_PATH || './backend/db/platform.db');
  const absoluteDbPath = path.resolve(process.cwd(), dbPath);
  const prismaDir = path.resolve(process.cwd(), 'prisma');
  let prismaRelativePath = path.relative(prismaDir, absoluteDbPath).replace(/\\/g, '/');
  if (!prismaRelativePath.startsWith('.')) {
    prismaRelativePath = `./${prismaRelativePath}`;
  }
  env.DATABASE_URL = `file:${prismaRelativePath}`;
}
process.env.DATABASE_URL = env.DATABASE_URL;

module.exports = env;
