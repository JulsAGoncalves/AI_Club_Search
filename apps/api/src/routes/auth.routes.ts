import { Router } from 'express';
import { acceptInviteSchema, loginSchema, registerSchema } from '@courtreach/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { acceptInvite, login, register } from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await login(req.body);
    res.json(result);
  }),
);

authRouter.post(
  '/accept-invite',
  validate(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const result = await acceptInvite(req.body);
    res.status(201).json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId, teamId, role } = (req as AuthedRequest).auth;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
      team: { id: team.id, name: team.name, createdAt: team.createdAt.toISOString() },
      role,
    });
  }),
);
