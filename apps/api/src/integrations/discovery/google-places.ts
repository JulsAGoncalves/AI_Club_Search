import type { Region, SportType } from '@courtreach/shared';
import { logger } from '../../lib/logger.js';
import type { DiscoverySource, RawClub } from './types.js';

/**
 * Search keywords sent to Google Text Search for each sport type.
 * Multiple keywords are tried in sequence; results are de-duplicated by place_id.
 */
const SPORT_KEYWORDS: Record<SportType, string[]> = {
  TENNIS: ['tennis club', 'tennis academy', 'lawn tennis club'],
  BADMINTON: ['badminton club', 'badminton centre', 'badminton center'],
  PICKLEBALL: ['pickleball club', 'pickleball center', 'pickleball centre'],
  SQUASH: ['squash club', 'squash centre', 'squash center', 'racquetball club'],
};

/**
 * Name fragments that strongly suggest a public/municipal venue with no
 * membership structure. Used in the absence of OSM tags to pre-filter obvious
 * public courts before the AI venue classifier runs.
 */
const PUBLIC_COURT_PATTERNS = [
  /\bpark\b/i,
  /\bmunicipal\b/i,
  /\brecreation cent(re|er)\b/i,
  /\bcommunity cent(re|er)\b/i,
  /\bpublic court/i,
  /\bschool\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bcouncil\b/i,
];

function isLikelyPublicVenue(name: string): boolean {
  return PUBLIC_COURT_PATTERNS.some((re) => re.test(name));
}

/** Pause execution — required between paginated Google Places requests. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Google Places API (New) base URL
const BASE_URL = 'https://places.googleapis.com/v1/places';

interface PlacesTextSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

interface GooglePlace {
  id: string; // place_id equivalent in the new API
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
}

/**
 * Club discovery using the Google Places API (New).
 * Implements the same DiscoverySource interface as OverpassDiscoverySource so
 * the two are interchangeable via the DISCOVERY_SOURCE env variable.
 */
export class GooglePlacesDiscoverySource implements DiscoverySource {
  readonly name = 'google_places';

  constructor(private readonly apiKey: string) {}

  /**
   * Perform a single Text Search page request for one keyword within the region.
   * Returns the place list and an optional token for the next page.
   */
  private async fetchPage(
    keyword: string,
    region: Required<Pick<Region, 'lat' | 'lng' | 'radiusKm'>>,
    pageToken?: string,
  ): Promise<PlacesTextSearchResponse> {
    const body: Record<string, unknown> = {
      textQuery: keyword,
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: region.lat, longitude: region.lng },
          radius: Math.min(region.radiusKm * 1000, 50_000), // Google max is 50,000 m
        },
      },
      // Request only the fields we use to minimise billing.
      // websiteUri is a Basic Data field included at no extra charge in Text Search.
    };

    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(`${BASE_URL}:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        // Field mask controls which fields are returned (and billed).
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,nextPageToken',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google Places Text Search failed (${res.status}): ${text.slice(0, 300)}`);
    }

    return (await res.json()) as PlacesTextSearchResponse;
  }

  /**
   * Fetch all pages for a single keyword, respecting the 2-second inter-page
   * delay required by the Google Places API.
   */
  private async fetchAllPages(
    keyword: string,
    region: Required<Pick<Region, 'lat' | 'lng' | 'radiusKm'>>,
  ): Promise<GooglePlace[]> {
    const results: GooglePlace[] = [];
    let pageToken: string | undefined;
    let page = 0;
    const MAX_PAGES = 5; // safety cap: 5 × 20 = 100 results per keyword

    do {
      if (page > 0) await sleep(2_000); // Google requires a short delay before fetching the next page
      const response = await this.fetchPage(keyword, region, pageToken);
      if (response.places) results.push(...response.places);
      pageToken = response.nextPageToken;
      page += 1;
    } while (pageToken && page < MAX_PAGES);

    return results;
  }

  async search(region: Region, sportTypes: SportType[]): Promise<RawClub[]> {
    if (region.lat == null || region.lng == null || region.radiusKm == null) {
      throw new Error(
        'Google Places search requires a geocoded region (lat/lng/radiusKm). ' +
          'Resolve the region label with the geocoder before searching.',
      );
    }

    const geocodedRegion = region as Required<Pick<Region, 'lat' | 'lng' | 'radiusKm'>>;

    // Collect all place_ids we've seen to de-duplicate across keywords and sports.
    const seen = new Set<string>();
    const clubs: RawClub[] = [];

    for (const sportType of sportTypes) {
      const keywords = SPORT_KEYWORDS[sportType];

      for (const keyword of keywords) {
        logger.info('Google Places text search', {
          keyword,
          region: region.label,
          sportType,
        });

        let places: GooglePlace[];
        try {
          places = await this.fetchAllPages(keyword, geocodedRegion);
        } catch (err) {
          logger.warn(`Google Places search failed for keyword "${keyword}"`, err);
          continue;
        }

        for (const place of places) {
          if (!place.id) continue;
          if (seen.has(place.id)) continue;
          seen.add(place.id);

          const name = place.displayName?.text?.trim();
          if (!name) continue;

          // Drop obvious public/municipal venues before the AI classifier runs.
          if (isLikelyPublicVenue(name)) continue;

          const lat = place.location?.latitude ?? null;
          const lng = place.location?.longitude ?? null;

          clubs.push({
            externalId: place.id,
            name,
            lat,
            lng,
            address: place.formattedAddress ?? null,
            website: place.websiteUri ?? null,
            sportType,
            source: this.name,
          });
        }
      }
    }

    logger.info(`Google Places returned ${clubs.length} named clubs`);
    return clubs;
  }
}
