import { OverpassDiscoverySource } from './overpass.js';
import type { DiscoverySource } from './types.js';

let cached: DiscoverySource | null = null;

/** Returns the active discovery source. Swap here to add Google Places later. */
export function getDiscoverySource(): DiscoverySource {
  if (!cached) cached = new OverpassDiscoverySource();
  return cached;
}

export * from './types.js';
