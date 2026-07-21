import { env } from '../../config/env.js';
import { GooglePlacesDiscoverySource } from './google-places.js';
import { OverpassDiscoverySource } from './overpass.js';
import type { DiscoverySource } from './types.js';

let cached: DiscoverySource | null = null;

/**
 * Returns the active discovery source, selected by the DISCOVERY_SOURCE env var.
 * Set DISCOVERY_SOURCE=google (with GOOGLE_PLACES_API_KEY) to use Google Places.
 * Set DISCOVERY_SOURCE=overpass (default) to use the free OpenStreetMap Overpass API.
 */
export function getDiscoverySource(): DiscoverySource {
  if (!cached) {
    if (env.DISCOVERY_SOURCE === 'google') {
      if (!env.GOOGLE_PLACES_API_KEY) {
        throw new Error(
          'DISCOVERY_SOURCE is set to "google" but GOOGLE_PLACES_API_KEY is missing. ' +
            'Add it to your .env file.',
        );
      }
      cached = new GooglePlacesDiscoverySource(env.GOOGLE_PLACES_API_KEY);
    } else {
      cached = new OverpassDiscoverySource();
    }
  }
  return cached;
}

export * from './types.js';
