import { Queue } from 'bullmq';
import type { JobType } from '@courtreach/shared';
import { connection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';

export const QUEUE_NAMES = {
  discovery: 'discovery',
  verification: 'verification',
  outreach: 'outreach',
  replyPoll: 'reply-poll',
} as const;

export interface CampaignJobData {
  campaignId: string;
  jobId: string;
}

export interface OutreachJobData extends CampaignJobData {
  /** When set, only draft/send for this single club (used by the review queue). */
  clubId?: string;
  /** When true, this run is a follow-up to a previously sent email. */
  followUp?: boolean;
}

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 200,
};

// Discovery jobs are long-running (120 s Overpass timeout per attempt).
// A single attempt surfaces errors immediately rather than making the user wait
// 6+ minutes through 3 retry cycles before the failure banner appears.
const discoveryJobOptions = {
  ...defaultJobOptions,
  attempts: 1,
};

export const discoveryQueue = new Queue<CampaignJobData>(QUEUE_NAMES.discovery, {
  connection,
  defaultJobOptions: discoveryJobOptions,
});
export const verificationQueue = new Queue<CampaignJobData>(QUEUE_NAMES.verification, {
  connection,
  defaultJobOptions,
});
export const outreachQueue = new Queue<OutreachJobData>(QUEUE_NAMES.outreach, {
  connection,
  defaultJobOptions,
});
export const replyPollQueue = new Queue(QUEUE_NAMES.replyPoll, { connection });

/** Create a Job DB row used to surface progress in the UI. */
export async function createJobRecord(campaignId: string, type: JobType) {
  return prisma.job.create({ data: { campaignId, type, status: 'QUEUED' } });
}

/** Enqueue a discovery run for a campaign and return the tracking Job row. */
export async function enqueueDiscovery(campaignId: string) {
  const job = await createJobRecord(campaignId, 'DISCOVERY');
  await discoveryQueue.add('run', { campaignId, jobId: job.id });
  return job;
}

export async function enqueueVerification(campaignId: string) {
  const job = await createJobRecord(campaignId, 'VERIFICATION');
  await verificationQueue.add('run', { campaignId, jobId: job.id });
  return job;
}

export async function enqueueOutreach(campaignId: string, clubId?: string) {
  const job = await createJobRecord(campaignId, 'OUTREACH');
  await outreachQueue.add('run', { campaignId, jobId: job.id, clubId });
  return job;
}

/** Schedule a delayed follow-up email for a single club. */
export async function enqueueFollowUp(campaignId: string, clubId: string, delayMs: number) {
  const job = await createJobRecord(campaignId, 'OUTREACH');
  await outreachQueue.add(
    'follow-up',
    { campaignId, jobId: job.id, clubId, followUp: true },
    { delay: delayMs },
  );
  return job;
}
