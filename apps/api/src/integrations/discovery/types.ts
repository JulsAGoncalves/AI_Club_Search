import type { Region, SportType } from '@courtreach/shared';

export interface RawClub {
  /** Stable external identifier for de-duplication, e.g. "node/12345". */
  externalId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  website: string | null;
  sportType: SportType;
  source: string;
}

export interface DiscoverySource {
  readonly name: string;
  search(region: Region, sportTypes: SportType[]): Promise<RawClub[]>;
}
