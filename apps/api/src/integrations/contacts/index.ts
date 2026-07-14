import { env } from '../../config/env.js';
import { HunterContactFinder } from './hunter.js';
import type { ContactFinder } from './types.js';

let cached: ContactFinder | null = null;

/** Returns the configured contact finder, or null if no provider key is set. */
export function getContactFinder(): ContactFinder | null {
  if (cached) return cached;
  if (env.HUNTER_API_KEY) {
    cached = new HunterContactFinder(env.HUNTER_API_KEY);
    return cached;
  }
  return null;
}

export * from './types.js';
