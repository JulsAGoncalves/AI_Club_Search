import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { AnthropicClient } from './anthropic.js';
import { FallbackAiClient } from './fallback.js';
import { GoogleAiClient } from './google.js';
import { OpenAiClient } from './openai.js';
import type { AiClient } from './types.js';

let cached: AiClient | null = null;

/** Returns the configured AI client, or a heuristic fallback if no key is set. */
export function getAiClient(): AiClient {
  if (cached) return cached;

  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    cached = new OpenAiClient(env.OPENAI_API_KEY);
  } else if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
    cached = new AnthropicClient(env.ANTHROPIC_API_KEY);
  } else if (env.AI_PROVIDER === 'google' && env.GOOGLE_AI_API_KEY) {
    cached = new GoogleAiClient(env.GOOGLE_AI_API_KEY);
  } else {
    logger.warn('No AI provider key configured - using heuristic fallback client');
    cached = new FallbackAiClient();
  }
  return cached;
}

export * from './types.js';
