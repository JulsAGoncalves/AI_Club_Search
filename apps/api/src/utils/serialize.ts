import type {
  Activity,
  Campaign,
  Club,
  Contact,
  EmailMessage,
  Job,
  Outreach,
} from '@prisma/client';
import type {
  ActivityDto,
  CampaignDto,
  ClubDto,
  ContactDto,
  EmailMessageDto,
  JobDto,
  OutreachDto,
  Region,
  SportType,
} from '@courtreach/shared';

export function toCampaignDto(c: Campaign, counts?: CampaignDto['counts']): CampaignDto {
  return {
    id: c.id,
    name: c.name,
    region: c.region as Region,
    sportTypes: c.sportTypes as SportType[],
    autoSendVerified: c.autoSendVerified,
    dailySendLimit: c.dailySendLimit,
    followUpDays: c.followUpDays,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    counts,
  };
}

export function toContactDto(c: Contact): ContactDto {
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    confidenceScore: c.confidenceScore,
    verificationStatus: c.verificationStatus,
    reasoning: c.reasoning,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toEmailMessageDto(m: EmailMessage): EmailMessageDto {
  return {
    id: m.id,
    direction: m.direction,
    subject: m.subject,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toOutreachDto(o: Outreach & { messages?: EmailMessage[] }): OutreachDto {
  return {
    id: o.id,
    subject: o.subject,
    body: o.body,
    status: o.status,
    sentAt: o.sentAt ? o.sentAt.toISOString() : null,
    messages: (o.messages ?? []).map(toEmailMessageDto),
  };
}

export function toClubDto(
  c: Club & { contacts?: Contact[]; outreach?: (Outreach & { messages?: EmailMessage[] }) | null },
): ClubDto {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    sportType: c.sportType,
    website: c.website,
    membershipSystem: c.membershipSystem,
    source: c.source,
    status: c.status,
    contacts: (c.contacts ?? []).map(toContactDto),
    outreach: c.outreach ? toOutreachDto(c.outreach) : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toJobDto(j: Job): JobDto {
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    progress: j.progress,
    total: j.total,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toActivityDto(a: Activity): ActivityDto {
  return {
    id: a.id,
    actor: a.actor,
    action: a.action,
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}
