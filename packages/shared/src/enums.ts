/**
 * Canonical enums shared between the API (Prisma) and the web app.
 * Keep these values in sync with the Prisma schema string literals.
 */

export const SPORT_TYPES = ['BADMINTON', 'TENNIS', 'PICKLEBALL', 'SQUASH'] as const;
export type SportType = (typeof SPORT_TYPES)[number];

/** The pipeline status a club sits in at any moment (drives the board columns). */
export const CLUB_STATUSES = [
  'IMPORTED',
  'DISCOVERED',
  'CONTACT_FOUND',
  'VERIFIED',
  'UNCERTAIN',
  'INVALID',
  'OUT_OF_AREA',
  'EMAIL_SENT',
  'REPLIED',
  'DEMO_BOOKED',
  'SKIPPED',
] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'UNCERTAIN', 'INVALID'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const OUTREACH_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SCHEDULED',
  'SENT',
  'REPLIED',
  'BOUNCED',
  'FAILED',
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const CAMPAIGN_STATUSES = ['DRAFT', 'DISCOVERING', 'ACTIVE', 'PAUSED', 'COMPLETED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const JOB_TYPES = ['DISCOVERY', 'VERIFICATION', 'OUTREACH', 'REPLY_POLL'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMAIL_DIRECTIONS = ['OUTBOUND', 'INBOUND'] as const;
export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number];
