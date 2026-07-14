import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

interface LogActivityArgs {
  teamId: string;
  actor: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
}

/** Append an entry to the team activity feed. Never throws (best-effort). */
export async function logActivity({ teamId, actor, action, metadata, userId }: LogActivityArgs) {
  try {
    await prisma.activity.create({
      data: { teamId, actor, action, metadata, userId: userId ?? null },
    });
  } catch (err) {
    logger.warn('Failed to write activity', err);
  }
}
