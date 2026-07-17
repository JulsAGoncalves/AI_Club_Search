import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { FallbackAiClient } from './fallback.js';
import {
  CLASSIFY_VENUE_SYSTEM_PROMPT,
  DETECT_BOOKING_SYSTEM_PROMPT,
  DRAFT_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  buildClassifyVenueUserPrompt,
  buildDetectBookingSystemUserPrompt,
  buildDraftUserPrompt,
  buildVerifyUserPrompt,
} from './prompts.js';
import type {
  AiClient,
  ClassifyVenueInput,
  DraftEmailInput,
  DraftEmailResult,
  VerifyContactInput,
  VerifyContactResult,
  VenueClassification,
} from './types.js';

export class AnthropicClient implements AiClient {
  readonly name = 'anthropic';
  readonly configured = true;
  private client: Anthropic;
  private fallback = new FallbackAiClient();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async json<T>(system: string, user: string): Promise<T> {
    const res = await this.client.messages.create({
      model: env.AI_MODEL,
      max_tokens: 1024,
      temperature: 0.4,
      system: `${system}\n\nRespond with ONLY valid JSON, no markdown fences.`,
      messages: [{ role: 'user', content: user }],
    });
    const block = res.content.find((b) => b.type === 'text');
    const text = block && 'text' in block ? block.text : '{}';
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
      logger.warn('Anthropic verifyContact failed, using fallback', err);
      return this.fallback.verifyContact(input);
    }
  }

  async draftEmail(input: DraftEmailInput): Promise<DraftEmailResult> {
    try {
      const out = await this.json<DraftEmailResult>(DRAFT_SYSTEM_PROMPT, buildDraftUserPrompt(input));
      if (!out.subject || !out.body) throw new Error('Incomplete draft');
      return out;
    } catch (err) {
      logger.warn('Anthropic draftEmail failed, using fallback', err);
      return this.fallback.draftEmail(input);
    }
  }

  async classifyVenue(input: ClassifyVenueInput): Promise<VenueClassification> {
    try {
      const out = await this.json<VenueClassification>(
        CLASSIFY_VENUE_SYSTEM_PROMPT,
        buildClassifyVenueUserPrompt(input),
      );
      return {
        isClub: out.isClub ?? true,
        confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)),
        reasoning: out.reasoning ?? 'No reasoning provided.',
      };
    } catch (err) {
      logger.warn('Anthropic classifyVenue failed, defaulting to isClub=true', err);
      return { isClub: true, confidence: 0, reasoning: 'Classification unavailable.' };
    }
  }

  async detectBookingSystem(clubName: string, pageText: string): Promise<string | null> {
    try {
      const out = await this.json<{ system: string | null }>(
        DETECT_BOOKING_SYSTEM_PROMPT,
        buildDetectBookingSystemUserPrompt(clubName, pageText),
      );
      return out.system?.trim() || null;
    } catch (err) {
      logger.warn('Anthropic detectBookingSystem failed', err);
      return null;
    }
  }
}
