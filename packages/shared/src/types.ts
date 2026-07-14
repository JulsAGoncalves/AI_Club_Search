import type {
  CampaignStatus,
  ClubStatus,
  EmailDirection,
  JobStatus,
  JobType,
  MembershipRole,
  OutreachStatus,
  SportType,
  VerificationStatus,
} from './enums.js';
import type { Region } from './schemas.js';

/**
 * Serialized API DTOs. Dates are ISO strings over the wire.
 * These intentionally mirror (a subset of) the Prisma models.
 */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  createdAt: string;
}

export interface MembershipDto {
  id: string;
  role: MembershipRole;
  user: UserDto;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  team: TeamDto;
  role: MembershipRole;
}

export interface CampaignDto {
  id: string;
  name: string;
  region: Region;
  sportTypes: SportType[];
  autoSendVerified: boolean;
  dailySendLimit: number;
  followUpDays: number;
  status: CampaignStatus;
  createdAt: string;
  counts?: ClubStatusCounts;
}

export type ClubStatusCounts = Record<ClubStatus, number>;

export interface ContactDto {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidenceScore: number | null;
  verificationStatus: VerificationStatus;
  reasoning: string | null;
  createdAt: string;
}

export interface ClubDto {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sportType: SportType;
  website: string | null;
  membershipSystem: string | null;
  source: string;
  status: ClubStatus;
  contacts: ContactDto[];
  outreach?: OutreachDto | null;
  createdAt: string;
}

export interface EmailMessageDto {
  id: string;
  direction: EmailDirection;
  subject: string | null;
  body: string;
  createdAt: string;
}

export interface OutreachDto {
  id: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  sentAt: string | null;
  messages: EmailMessageDto[];
}

export interface JobDto {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  total: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDto {
  id: string;
  actor: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface FunnelAnalytics {
  totalClubs: number;
  byStatus: ClubStatusCounts;
  emailsSent: number;
  replies: number;
  demosBooked: number;
  replyRate: number;
  demoRate: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
