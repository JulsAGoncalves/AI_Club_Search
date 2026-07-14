import { CLUB_STATUSES, type ClubStatusCounts, type FunnelAnalytics } from '@courtreach/shared';
import { prisma } from '../lib/prisma.js';

function emptyCounts(): ClubStatusCounts {
  return Object.fromEntries(CLUB_STATUSES.map((s) => [s, 0])) as ClubStatusCounts;
}

export async function getStatusCounts(campaignId: string): Promise<ClubStatusCounts> {
  const grouped = await prisma.club.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });
  const counts = emptyCounts();
  for (const g of grouped) counts[g.status] = g._count._all;
  return counts;
}

export async function getAnalytics(campaignId: string): Promise<FunnelAnalytics> {
  const byStatus = await getStatusCounts(campaignId);
  const totalClubs = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const emailsSent =
    byStatus.EMAIL_SENT + byStatus.REPLIED + byStatus.DEMO_BOOKED;
  const replies = byStatus.REPLIED + byStatus.DEMO_BOOKED;
  const demosBooked = byStatus.DEMO_BOOKED;

  return {
    totalClubs,
    byStatus,
    emailsSent,
    replies,
    demosBooked,
    replyRate: emailsSent ? replies / emailsSent : 0,
    demoRate: emailsSent ? demosBooked / emailsSent : 0,
  };
}
