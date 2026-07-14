import type { Region, SportType } from '@courtreach/shared';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { DiscoverySource, RawClub } from './types.js';

/**
 * OSM `sport=*` tag values we accept for each racquet sport. Real-world tagging
 * is inconsistent, so we include common aliases/spellings. Matching is done on
 * exact tokens (the sport tag is `;`-separated), which prevents false positives
 * such as classifying `table_tennis` as TENNIS.
 */
const OSM_SPORTS_BY_TYPE: Record<SportType, string[]> = {
  BADMINTON: ['badminton'],
  TENNIS: ['tennis', 'lawn_tennis', 'real_tennis'],
  PICKLEBALL: ['pickleball', 'pickle_ball', 'pickle-ball'],
  SQUASH: ['squash', 'racquetball', 'racketball'],
};

/**
 * Generic "racquet sports" tag values that flag a racquet club without naming a
 * specific sport (e.g. `sport=racquet`). Many real clubs — like the
 * "London Squash and Racket Club" (tagged `sport=racquet`) — only carry these,
 * so we keep them and then infer the concrete sport from the club name.
 */
const GENERIC_RACQUET_TOKENS = [
  'racquet',
  'racket',
  'racquet_sports',
  'racket_sports',
  'racquetsports',
];

/** Keywords used to infer a concrete sport from a club's name for generic venues. */
const NAME_KEYWORDS: Record<SportType, string[]> = {
  BADMINTON: ['badminton'],
  TENNIS: ['tennis'],
  PICKLEBALL: ['pickleball', 'pickle ball'],
  SQUASH: ['squash'],
};

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:state'] ?? tags['addr:province'],
    tags['addr:postcode'],
  ].filter((p) => p && p.trim().length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Split the `sport=*` tag into normalized, lower-case tokens. */
function sportTokens(tags: Record<string, string>): string[] {
  return (tags.sport ?? '')
    .toLowerCase()
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function pickSportType(
  tags: Record<string, string>,
  name: string,
  requested: SportType[],
): SportType | null {
  const tokens = sportTokens(tags);

  // 1. Exact match on a specific sport token, preferring the requested order.
  for (const s of requested) {
    if (tokens.some((t) => OSM_SPORTS_BY_TYPE[s].includes(t))) return s;
  }

  // 2. Generic racquet venue (e.g. sport=racquet): infer the concrete sport from
  //    the club name, falling back to the first requested sport when the name is
  //    unhelpful. This catches inconsistently tagged but relevant clubs.
  if (tokens.some((t) => GENERIC_RACQUET_TOKENS.includes(t))) {
    const lname = name.toLowerCase();
    for (const s of requested) {
      if (NAME_KEYWORDS[s].some((kw) => lname.includes(kw))) return s;
    }
    return requested[0];
  }

  return null;
}

/** All OSM sport tokens (specific + generic) to search for the requested sports. */
function sportRegexTokens(sportTypes: SportType[]): string[] {
  const tokens = new Set<string>();
  for (const s of sportTypes) OSM_SPORTS_BY_TYPE[s].forEach((t) => tokens.add(t));
  GENERIC_RACQUET_TOKENS.forEach((t) => tokens.add(t));
  return [...tokens];
}

/**
 * Free club discovery using the OpenStreetMap Overpass API.
 * Designed to be swapped for a Google Places source later (same interface).
 */
export class OverpassDiscoverySource implements DiscoverySource {
  readonly name = 'overpass';

  private buildQuery(region: Region, sportTypes: SportType[]): string {
    if (region.lat == null || region.lng == null || region.radiusKm == null) {
      throw new Error(
        'Overpass search requires a geocoded region (lat/lng/radiusKm). ' +
          'Resolve the region label with the geocoder before searching.',
      );
    }

    // Match elements whose sport tag contains any accepted token for the
    // requested sports, plus generic racquet tokens. We still scope to the
    // `sport` tag (no broad leisure=sports_centre clause) to avoid pulling in
    // yoga, martial arts and other unrelated venues; generic racquet matches are
    // narrowed further by pickSportType.
    const sportRegex = sportRegexTokens(sportTypes).join('|');
    const radius = Math.round(region.radiusKm * 1000);
    const around = `(around:${radius},${region.lat},${region.lng})`;
    const filters = `nwr["sport"~"${sportRegex}"]${around};`;
    return `[out:json][timeout:90];(${filters});out center tags 400;`;
  }

  async search(region: Region, sportTypes: SportType[]): Promise<RawClub[]> {
    const query = this.buildQuery(region, sportTypes);
    logger.info('Overpass query', { region: region.label, sportTypes });

    const body = new URLSearchParams({ data: query }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(env.OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'CourtReach/1.0',
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Overpass request timed out after 120 s');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Overpass request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as OverpassResponse;
    const seen = new Set<string>();
    const clubs: RawClub[] = [];

    for (const el of data.elements) {
      const tags = el.tags ?? {};
      const name = tags.name?.trim();
      if (!name) continue; // unnamed courts are not useful for outreach

      // Require a matching racquet sport tag (or a name-inferred generic one).
      const sportType = pickSportType(tags, name, sportTypes);
      if (!sportType) continue;

      const externalId = `${el.type}/${el.id}`;
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const lat = el.lat ?? el.center?.lat ?? null;
      const lng = el.lon ?? el.center?.lon ?? null;
      const website = tags.website ?? tags['contact:website'] ?? tags.url ?? null;

      clubs.push({
        externalId,
        name,
        lat,
        lng,
        address: buildAddress(tags),
        website,
        sportType,
        source: this.name,
      });
    }

    logger.info(`Overpass returned ${clubs.length} named clubs`);
    return clubs;
  }
}
