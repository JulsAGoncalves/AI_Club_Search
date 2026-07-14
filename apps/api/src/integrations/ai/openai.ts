import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { FallbackAiClient } from './fallback.js';
import {
  DRAFT_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  buildDraftUserPrompt,
  buildVerifyUserPrompt,
} from './prompts.js';
import type {
  AiClient,
  DraftEmailInput,
  DraftEmailResult,
  VerifyContactInput,
  VerifyContactResult,
} from './types.js';

export class OpenAiClient implements AiClient {
  readonly name = 'openai';
  readonly configured = true;
  private client: OpenAI;
  private fallback = new FallbackAiClient();

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private async json<T>(system: string, user: string): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = res.choices[0]?.message?.content ?? '{}';
    return JSON.parse(content) as T;
  }

  async verifyContact(input: VerifyContactInput): Promise<VerifyContactResult> {
    try {
      const out = await this.json<VerifyContactResult>(
        VERIFY_SYSTEM_PROMPT,
        buildVerifyUserPrompt(input),
      );
      return {
        status: out.status,
        confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)),
        reasoning: out.reasoning ?? 'No reasoning provided.',
      };
    } catch (err) {
      logger.warn('OpenAI verifyContact failed, using fallback', err);
      return this.fallback.verifyContact(input);
    }
  }

  async draftEmail(input: DraftEmailInput): Promise<DraftEmailResult> {
    try {
      const out = await this.json<DraftEmailResult>(DRAFT_SYSTEM_PROMPT, buildDraftUserPrompt(input));
      if (!out.subject || !out.body) throw new Error('Incomplete draft');
      return out;
    } catch (err) {
      logger.warn('OpenAI draftEmail failed, using fallback', err);
      return this.fallback.draftEmail(input);
    }
  }
}
