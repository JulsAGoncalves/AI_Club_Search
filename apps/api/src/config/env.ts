import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env (monorepo) first, then any local apps/api/.env override.
const rootEnv = resolve(here, '../../../../.env');
// eslint-disable-next-line no-console
console.log('[env] here:', here, '| rootEnv:', rootEnv, '| exists:', existsSync(rootEnv));
// eslint-disable-next-line no-console
console.log('[env] process.env.AI_PROVIDER before dotenv:', process.env.AI_PROVIDER);
// override: true forces .env file values to win over any pre-set process.env values
// (e.g. from pnpm automatic injection or stale system env vars).
if (existsSync(rootEnv)) loadEnv({ path: rootEnv, override: true });
loadEnv({ override: true });
// eslint-disable-next-line no-console
console.log('[env] process.env.AI_PROVIDER after dotenv:', process.env.AI_PROVIDER);

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'google']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),

  HUNTER_API_KEY: z.string().optional(),
  OVERPASS_URL: z.string().default('https://overpass-api.de/api/interpreter'),
  NOMINATIM_URL: z.string().default('https://nominatim.openstreetmap.org/search'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanish.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('CourtReach'),
  SMTP_FROM_EMAIL: z.string().optional(),

  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. See errors above and check your .env file.');
}

export const env = parsed.data;

/** Convenience flags for which integrations are configured. */
export const integrations = {
  ai:
    (env.AI_PROVIDER === 'openai' && !!env.OPENAI_API_KEY) ||
    (env.AI_PROVIDER === 'anthropic' && !!env.ANTHROPIC_API_KEY) ||
    (env.AI_PROVIDER === 'google' && !!env.GOOGLE_AI_API_KEY),
  hunter: !!env.HUNTER_API_KEY,
  smtp: !!env.SMTP_HOST && !!env.SMTP_USER && !!env.SMTP_PASS && !!env.SMTP_FROM_EMAIL,
  imap: !!env.IMAP_HOST && !!env.IMAP_USER && !!env.IMAP_PASS,
};
