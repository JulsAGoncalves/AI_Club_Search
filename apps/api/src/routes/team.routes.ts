import { Router } from 'express';
import { inviteMemberSchema } from '@courtreach/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { createInvite } from '../services/auth.service.js';

export const teamRouter = Router();
teamRouter.use(requireAuth);

teamRouter.get(
  '/members',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const memberships = await prisma.membership.findMany({
      where: { teamId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      memberships.map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          createdAt: m.user.createdAt.toISOString(),
        },
      })),
    );
  }),
);

teamRouter.get(
  '/invites',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const invites = await prisma.invite.findMany({
      where: { teamId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  }),
);

teamRouter.post(
  '/invites',
  requireRole('OWNER', 'ADMIN'),
  validate(inviteMemberSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const invite = await createInvite(teamId, req.body);
    res.status(201).json(invite);
  }),
);
