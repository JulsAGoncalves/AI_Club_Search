import { Router } from 'express';
import { emailTemplateSchema } from '@courtreach/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { integrations } from '../config/env.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const DEFAULT_TEMPLATE = {
  subject: 'Helping [Club name] run [Sport type] more smoothly',
  body: `Hi [Manager name],

I came across [Club name] while researching [Sport type] clubs in your area. I build software that handles member management and billing for racquet-sport clubs, and I think it could save your team a lot of admin time.

Would you be open to a short live demo this week?

[Sender name]`,
  demoLink: '',
  signOff: '',
};

settingsRouter.get(
  '/template',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const template = await prisma.emailTemplate.findUnique({ where: { teamId } });
    res.json(template ?? DEFAULT_TEMPLATE);
  }),
);

settingsRouter.put(
  '/template',
  requireRole('OWNER', 'ADMIN'),
  validate(emailTemplateSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const template = await prisma.emailTemplate.upsert({
      where: { teamId },
      update: req.body,
      create: { teamId, ...req.body },
    });
    res.json(template);
  }),
);

/** Report which external integrations are configured (no secrets returned). */
settingsRouter.get(
  '/integrations',
  asyncHandler(async (_req, res) => {
    res.json(integrations);
  }),
);
