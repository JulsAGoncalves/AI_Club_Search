import { Worker } from 'bullmq';
import type { Club, Contact, EmailTemplate } from '@prisma/client';
import { connection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import {
  QUEUE_NAMES,
  type OutreachJobData,
  enqueueFollowUp,
} from '../queues/index.js';
import { getAiClient } from '../integrations/ai/index.js';
import { getMailer } from '../integrations/mailer/index.js';
import {
  markJobCompleted,
  markJobFailed,
  markJobRunning,
  setJobProgress,
} from '../services/job.service.js';
import { logActivity } from '../services/activity.service.js';

const DAY_MS = 1000 * 60 * 60 * 24;

function primaryContact(contacts: Contact[]): Contact | undefined {
  return contacts.find((c) => c.isPrimary && c.email) ?? contacts.find((c) => c.email);
}

/** Count emails actually sent for a campaign in the trailing 24h window. */
async function sentInLast24h(campaignId: string): Promise<number> {
  return prisma.outreach.count({
    where: {
      club: { campaignId },
      sentAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });
}

async function draftAndSend(
  club: Club & { contacts: Contact[] },
  template: EmailTemplate | null,
  senderName: string,
  teamId: string,
  followUpDays: number,
  isFollowUp: boolean,
) {
  const contact = primaryContact(club.contacts);
  if (!contact?.email) return false;

  const ai = getAiClient();
  const mailer = getMailer();

  const draft = await ai.draftEmail({
    clubName: club.name,
    sportType: club.sportType,
    contactName: contact.name,
    contactRole: contact.role,
    templateSubject: template?.subject,
    templateBody: template?.body,
    demoLink: template?.demoLink ?? undefined,
    signOff: template?.signOff ?? undefined,
    senderName,
  });

  const subject = isFollowUp ? `Re: ${draft.subject}` : draft.subject;
  const result = await mailer.send({ to: contact.email, subject, body: draft.body });

  const outreach = await prisma.outreach.upsert({
    where: { clubId: club.id },
    update: {
      subject,
      body: draft.body,
      status: 'SENT',
      sentAt: new Date(),
      messageId: result.messageId,
    },
    create: {
      clubId: club.id,
      subject,
      body: draft.body,
      status: 'SENT',
      sentAt: new Date(),
      messageId: result.messageId,
    },
  });

  await prisma.emailMessage.create({
    data: {
      outreachId: outreach.id,
      direction: 'OUTBOUND',
      subject,
      body: draft.body,
      messageId: result.messageId,
    },
  });

  await prisma.club.update({ where: { id: club.id }, data: { status: 'EMAIL_SENT' } });

  logActivity({
    teamId,
    actor: 'Outreach Agent',
    action: `${isFollowUp ? 'sent a follow-up to' : 'emailed'} ${club.name}`,
    metadata: { clubId: club.id, delivered: result.delivered },
  });

  if (!isFollowUp) {
    await enqueueFollowUp(club.campaignId, club.id, followUpDays * DAY_MS);
  }
  return true;
}

/**
 * Outreach worker: drafts and sends emails.
 * - With clubId: send that single club (review-queue approval).
 * - With followUp: only send if the club has not replied.
 * - Otherwise: send VERIFIED clubs up to the campaign's daily limit.
 */
export function startOutreachWorker() {
  const worker = new Worker<OutreachJobData>(
    QUEUE_NAMES.outreach,
    async (job) => {
      const { campaignId, jobId, clubId, followUp } = job.data;
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const template = await prisma.emailTemplate.findUnique({ where: { teamId: campaign.teamId } });
      const owner = await prisma.membership.findFirst({
        where: { teamId: campaign.teamId, role: 'OWNER' },
        include: { user: true },
      });
      const senderName = owner?.user.name ?? 'The CourtReach Team';

      // Handle a delayed follow-up for a single club.
      if (followUp && clubId) {
        await markJobRunning(jobId, 1);
        const club = await prisma.club.findUnique({ where: { id: clubId }, include: { contacts: true } });
        if (club && club.status === 'EMAIL_SENT') {
          await draftAndSend(club, template, senderName, campaign.teamId, campaign.followUpDays, true);
        }
        await setJobProgress(jobId, 1);
        await markJobCompleted(jobId);
        return { followUp: true };
      }

      // Determine the set of clubs to send to.
      const targets = await prisma.club.findMany({
        where: clubId ? { id: clubId } : { campaignId, status: 'VERIFIED' },
        include: { contacts: true },
      });

      const alreadySent = await sentInLast24h(campaignId);
      const remaining = Math.max(0, campaign.dailySendLimit - alreadySent);
      const batch = clubId ? targets : targets.slice(0, remaining);

      await markJobRunning(jobId, batch.length);
      let processed = 0;
      let sent = 0;

      for (const club of batch) {
        const ok = await draftAndSend(
          club,
          template,
          senderName,
          campaign.teamId,
          campaign.followUpDays,
          false,
        );
        if (ok) sent += 1;
        processed += 1;
        await setJobProgress(jobId, processed);
        await job.updateProgress(Math.round((processed / Math.max(batch.length, 1)) * 100));
      }

      await markJobCompleted(jobId);
      if (!clubId && targets.length > remaining) {
        logActivity({
          teamId: campaign.teamId,
          actor: 'Outreach Agent',
          action: `hit the daily send limit (${campaign.dailySendLimit}); ${targets.length - remaining} clubs queued for tomorrow`,
        });
      }
      return { sent };
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', async (job, err) => {
    logger.error('Outreach job failed', err);
    if (job?.data.jobId) await markJobFailed(job.data.jobId, err.message);
  });

  return worker;
}
