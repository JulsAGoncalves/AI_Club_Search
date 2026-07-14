import { z } from 'zod';
import {
  CAMPAIGN_STATUSES,
  CLUB_STATUSES,
  MEMBERSHIP_ROLES,
  OUTREACH_STATUSES,
  SPORT_TYPES,
  VERIFICATION_STATUSES,
} from './enums.js';

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  teamName: z.string().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBERSHIP_ROLES).default('MEMBER'),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export const regionSchema = z.object({
  /** Free text region label, e.g. "Ontario" or "Toronto 50km". */
  label: z.string().min(1).max(160),
  /** Optional centre point + radius for a "radius drop" search. */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(500).optional(),
});
export type Region = z.infer<typeof regionSchema>;

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(160),
  region: regionSchema,
  sportTypes: z.array(z.enum(SPORT_TYPES)).min(1),
  autoSendVerified: z.boolean().default(false),
  dailySendLimit: z.number().int().min(1).max(500).default(30),
  followUpDays: z.number().int().min(1).max(60).default(5),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/* ------------------------------------------------------------------ */
/* Clubs / contacts / outreach                                         */
/* ------------------------------------------------------------------ */

export const updateClubStatusSchema = z.object({
  status: z.enum(CLUB_STATUSES),
});
export type UpdateClubStatusInput = z.infer<typeof updateClubStatusSchema>;

/**
 * Seed a campaign with known club names from a CSV file. The raw CSV text is
 * sent in the body; the API parses the first column as the club name. These
 * clubs start as IMPORTED and are verified against the region on next discovery.
 */
export const importClubsSchema = z.object({
  csv: z.string().min(1).max(500_000),
});
export type ImportClubsInput = z.infer<typeof importClubsSchema>;

export const updateContactSchema = z.object({
  name: z.string().max(160).optional(),
  role: z.string().max(160).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(60).optional(),
  linkedinUrl: z.string().url().optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/** Decision taken from the "Uncertain" review queue. */
export const reviewDecisionSchema = z.object({
  decision: z.enum(['APPROVE_SEND', 'SKIP']),
});
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export const upsertDraftSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10000),
  status: z.enum(OUTREACH_STATUSES).optional(),
});
export type UpsertDraftInput = z.infer<typeof upsertDraftSchema>;

/* ------------------------------------------------------------------ */
/* Email template                                                      */
/* ------------------------------------------------------------------ */

export const emailTemplateSchema = z.object({
  subject: z.string().min(1).max(300),
  /** Body may contain variables like [Club name], [Manager name], [Sport type]. */
  body: z.string().min(1).max(10000),
  demoLink: z.string().url().optional(),
  signOff: z.string().max(500).optional(),
});
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
