import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { toActivityDto } from '../utils/serialize.js';

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const activities = await prisma.activity.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(activities.map(toActivityDto));
  }),
);
