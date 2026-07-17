import type { VerificationStatus } from '@courtreach/shared';

export interface VerifyContactInput {
  clubName: string;
  clubWebsite?: string | null;
  sportType: string;
  contactName?: string | null;
  contactRole?: string | null;
  contactEmail?: string | null;
  /** Extra evidence gathered during discovery (scraped text, search snippets). */
  evidence?: string;
  /** Result of the cheap MX/DNS pre-check. */
  domainResolves: boolean;
}

export interface VerifyContactResult {
  status: Exclude<VerificationStatus, 'PENDING'>;
  /** 0..1 */
  confidence: number;
  reasoning: string;
}

export interface DraftEmailInput {
  clubName: string;
  sportType: string;
  contactName?: string | null;
  contactRole?: string | null;
  templateSubject?: string;
  templateBody?: string;
  demoLink?: string;
  signOff?: string;
  senderName: string;
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

export interface ClassifyVenueInput {
  name: string;
  address: string | null;
  sportType: string;
  /** Scraped page text used as evidence. May be empty if no website was found. */
  evidence: string;
}

export interface VenueClassification {
  /** True if this appears to be an actual sports club/facility (not a store, brand, etc.). */
  isClub: boolean;
  /** 0..1 — how confident the model is in the isClub verdict. */
  confidence: number;
  reasoning: string;
}

export interface AiClient {
  readonly name: string;
  readonly configured: boolean;
  verifyContact(input: VerifyContactInput): Promise<VerifyContactResult>;
  draftEmail(input: DraftEmailInput): Promise<DraftEmailResult>;
  /**
   * Classify whether a discovered venue is a real sports club/facility or a false
   * positive (e.g. equipment retailer, governing body, online-only brand).
   * Returns a safe default (isClub: true) when no AI is configured.
   */
  classifyVenue(input: ClassifyVenueInput): Promise<VenueClassification>;
  /**
   * Attempt to identify the membership/booking platform from page text when the
   * pattern-based detector found nothing. Returns null when not identifiable.
   */
  detectBookingSystem(clubName: string, pageText: string): Promise<string | null>;
}
