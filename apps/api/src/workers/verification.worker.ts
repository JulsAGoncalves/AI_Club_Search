import { Worker } from 'bullmq';
import type { ClubStatus } from '@courtreach/shared';
import { connection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { QUEUE_NAMES, type CampaignJobData, enqueueOutreach } from '../queues/index.js';
import { getAiClient } from '../integrations/ai/index.js';
import { domainResolves } from '../utils/dns.js';
import {
  markJobCompleted,
  markJobFailed,
  markJobRunning,
  setJobProgress,
} from '../services/job.service.js';
import { logActivity } from '../services/activity.service.js';

const STATUS_RANK: Record<string, number> = { VERIFIED: 3, UNCERTAIN: 2, INVALID: 1, PENDING: 0 };

/** Verification worker: MX/DNS pre-check + AI cross-reference per contact. */
export function startVerificationWorker() {
  const worker = new Worker<CampaignJobData>(
    QUEUE_NAMES.verification,
    async (job) => {
      const { campaignId, jobId } = job.data;
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const clubs = await prisma.club.findMany({
        where: { campaignId, contacts: { some: { verificationStatus: 'PENDING' } } },
        include: { contacts: true },
      });

      await markJobRunning(jobId, clubs.length);
      const ai = getAiClient();
      let processed = 0;

      for (const club of clubs) {
        let bestStatus: ClubStatus = 'INVALID';
        let bestRank = 0;
        let bestContactId: string | null = null;

        for (const contact of club.contacts) {
          if (contact.verificationStatus !== 'PENDING') {
            const rank = STATUS_RANK[contact.verificationStatus] ?? 0;
            if (rank > bestRank) {
              bestRank = rank;
              bestStatus = contact.verificationStatus as ClubStatus;
              bestContactId = contact.id;
            }
            continue;
          }

          const resolves = await domainResolves(contact.email);
          const result = await ai.verifyContact({
            clubName: club.name,
            clubWebsite: club.website,
            sportType: club.sportType,
            contactName: contact.name,
            contactRole: contact.role,
            contactEmail: contact.email,
            domainResolves: resolves,
          });

          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              verificationStatus: result.status,
              confidenceScore: result.confidence,
              reasoning: result.reasoning,
            },
          });

          const rank = STATUS_RANK[result.status] ?? 0;
          if (rank > bestRank) {
            bestRank = rank;
            bestStatus = result.status as ClubStatus;
            bestContactId = contact.id;
          }
        }

        if (bestContactId) {
          await prisma.contact.updateMany({ where: { clubId: club.id }, data: { isPrimary: false } });
          await prisma.contact.update({ where: { id: bestContactId }, data: { isPrimary: true } });
        }

        // Only advance status forward (don't clobber EMAIL_SENT/REPLIED).
        if (['DISCOVERED', 'CONTACT_FOUND'].includes(club.status)) {
          await prisma.club.update({ where: { id: club.id }, data: { status: bestStatus } });
        }

        processed += 1;
        await setJobProgress(jobId, processed);
        await job.updateProgress(Math.round((processed / Math.max(clubs.length, 1)) * 100));
      }

      await markJobCompleted(jobId);
      logActivity({
        teamId: campaign.teamId,
        actor: 'Verification Agent',
        action: `verified contacts for ${clubs.length} clubs`,
      });

      if (campaign.autoSendVerified) await enqueueOutreach(campaignId);
      return { verified: clubs.length };
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', async (job, err) => {
    logger.error('Verification job failed', err);
    if (job?.data.jobId) await markJobFailed(job.data.jobId, err.message);
  });

  return worker;
}
