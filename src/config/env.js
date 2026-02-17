const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('file:./backend/db/platform.db'),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default('8h'),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_REDIRECT_URI: z.string().url(),
  GITHUB_APP_SCOPE: z.string().default('read:user user:email'),
  GITHUB_API_URL: z.string().url().default('https://api.github.com'),
  GITHUB_TOKEN: z.string().optional().default(''),
  TEACHER_INVITE_CODE: z.string().default('teacher2026'),
  CORS_ORIGIN: z.string().default('http://localhost:3000')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment: ${issues}`);
}

const env = parsed.data;
if (!env.DATABASE_URL.startsWith('file:')) {
  throw new Error('Only sqlite DATABASE_URL is supported in this project.');
}
process.env.DATABASE_URL = env.DATABASE_URL;

module.exports = env;
