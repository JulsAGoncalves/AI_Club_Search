export interface ContactCandidate {
  name: string | null;
  role: string | null;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  /** 0..1 provider-supplied confidence, if available. */
  confidence: number | null;
  source: string;
}

export interface ContactFinder {
  readonly name: string;
  readonly configured: boolean;
  /** Find likely management contacts for a club by domain. */
  findByDomain(domain: string, clubName: string): Promise<ContactCandidate[]>;
}
