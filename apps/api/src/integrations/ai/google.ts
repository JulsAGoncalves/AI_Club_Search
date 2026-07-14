import { GoogleGenAI } from '@google/genai';
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

export class GoogleAiClient implements AiClient {
  readonly name = 'google';
  readonly configured = true;
  private client: GoogleGenAI;
  private fallback = new FallbackAiClient();

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async json<T>(system: string, user: string): Promise<T> {
    const res = await this.client.models.generateContent({
      model: env.AI_MODEL,
      config: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        systemInstruction: system,
      },
      contents: user,
    });
    const text = res.text ?? '{}';
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned) as T;
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
      logger.warn('Google AI verifyContact failed, using fallback', err);
      return this.fallback.verifyContact(input);
    }
  }

  async draftEmail(input: DraftEmailInput): Promise<DraftEmailResult> {
    try {
      const out = await this.json<DraftEmailResult>(DRAFT_SYSTEM_PROMPT, buildDraftUserPrompt(input));
      if (!out.subject || !out.body) throw new Error('Incomplete draft');
      return out;
    } catch (err) {
      logger.warn('Google AI draftEmail failed, using fallback', err);
      return this.fallback.draftEmail(input);
    }
  }
}
