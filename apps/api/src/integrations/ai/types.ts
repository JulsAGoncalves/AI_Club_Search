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

export interface AiClient {
  readonly name: string;
  readonly configured: boolean;
  verifyContact(input: VerifyContactInput): Promise<VerifyContactResult>;
  draftEmail(input: DraftEmailInput): Promise<DraftEmailResult>;
}
