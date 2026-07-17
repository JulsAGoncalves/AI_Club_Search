import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';

const WEBSITE_FINDER_SYSTEM = `You are a sports club website researcher.
Given a club name, location, and sport type, use your search tool to find the club's official website.

After searching, return ONLY a JSON object with one key:
- "url": the full URL of the club's own official website, or null if you cannot find one with confidence

Rules for the URL you return:
- Must be the club's OWN domain — not an aggregator, directory, or social media profile
- Reject: Yelp, TripAdvisor, Facebook, Instagram, Twitter/X, sport directories, Google Maps
- If the club only has a Facebook/social page and no real website, return null
- Respond with ONLY valid JSON, no markdown fences`;

/**
 * Uses Anthropic's built-in web search tool (web_search_20250305) to find the
 * official website of a club that has no website URL in OSM.
 *
 * Requires AI_PROVIDER=anthropic and a model that supports tool use
 * (claude-3-5-sonnet-20241022 or newer). Returns null on any failure so the
 * rest of the pipeline can continue without a website.
 */
export async function findClubWebsite(
  clubName: string,
  address: string | null,
  sportType: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const client = new Anthropic({ apiKey });

  const locationHint = address ? `, located at ${address}` : '';
  const userMessage = `Find the official website for this sports club: "${clubName}"${locationHint}. Sport: ${sportType.toLowerCase()}.`;

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 512,
      system: WEBSITE_FINDER_SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: [{ role: 'user', content: userMessage }],
    });

    // The model may return multiple content blocks (tool_use + text). We want
    // the final text block which contains the JSON answer.
    const textBlock = [...res.content].reverse().find((b) => b.type === 'text');
    if (!textBlock || !('text' in textBlock)) return null;

    const cleaned = textBlock.text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { url?: string | null };
    const url = parsed.url?.trim() || null;
    if (url) {
      logger.debug(`Website finder: "${clubName}" → ${url}`);
    } else {
      logger.debug(`Website finder: no website found for "${clubName}"`);
    }
    return url;
  } catch (err) {
    logger.warn(`Website finder failed for "${clubName}"`, err);
    return null;
  }
}
