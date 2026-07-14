import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Search radius in km derived from the matched area's bounding box. */
  radiusKm: number;
  /** The canonical name Nominatim resolved the query to. */
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
}

const EARTH_RADIUS_KM = 6371;
const MIN_RADIUS_KM = 10;
const MAX_RADIUS_KM = 250;
const FETCH_TIMEOUT_MS = 10_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Derive a search radius from a bounding box: half the diagonal distance from
 * the centre to a corner, clamped to a sensible range.
 */
function radiusFromBoundingBox(
  lat: number,
  lng: number,
  bbox: [string, string, string, string],
): number {
  const [minLat, maxLat, minLon, maxLon] = bbox.map(Number);
  if ([minLat, maxLat, minLon, maxLon].some((n) => Number.isNaN(n))) {
    return MIN_RADIUS_KM;
  }
  const cornerDistance = haversineKm(lat, lng, maxLat, maxLon);
  return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, Math.round(cornerDistance)));
}

/**
 * Resolve a free-text region label (e.g. "London, Ontario, Canada" vs
 * "London, England, UK") into a specific coordinate + radius using the free
 * OpenStreetMap Nominatim geocoding API. This disambiguates places that share
 * a name by letting the user qualify the label with a region/country.
 */
export async function geocodeRegion(label: string): Promise<GeocodeResult> {
  const query = label.trim();
  if (!query) throw new Error('Region label is empty; cannot geocode.');

  const url = new URL(env.NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        // Nominatim usage policy requires an identifying User-Agent.
        'User-Agent': 'CourtReach/1.0 (club discovery)',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Geocoding for "${query}" timed out after ${FETCH_TIMEOUT_MS} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Nominatim request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const results = (await res.json()) as NominatimResult[];
  if (!results.length) {
    throw new Error(
      `Could not geocode region "${query}". Try being more specific, e.g. "London, England, UK".`,
    );
  }

  const [first] = results;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error(`Nominatim returned invalid coordinates for "${query}".`);
  }

  const radiusKm = radiusFromBoundingBox(lat, lng, first.boundingbox);
  logger.info('Geocoded region', {
    query,
    resolved: first.display_name,
    lat,
    lng,
    radiusKm,
  });

  return { lat, lng, radiusKm, displayName: first.display_name };
}

export interface PlaceResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Geocode an arbitrary place query (e.g. "Riverside Badminton Club, Ontario")
 * to a single coordinate. Unlike {@link geocodeRegion}, this returns null
 * instead of throwing when the place cannot be found, so callers can treat a
 * miss as "not locatable" rather than a hard error. Used to verify whether an
 * imported club actually sits inside a campaign's region.
 */
export async function geocodePlace(query: string): Promise<PlaceResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL(env.NOMINATIM_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CourtReach/1.0 (club discovery)',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`Nominatim place lookup failed (${res.status}) for "${trimmed}"`);
      return null;
    }
    const results = (await res.json()) as NominatimResult[];
    if (!results.length) return null;
    const [first] = results;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, displayName: first.display_name };
  } catch (err) {
    logger.warn(`Nominatim place lookup errored for "${trimmed}"`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
