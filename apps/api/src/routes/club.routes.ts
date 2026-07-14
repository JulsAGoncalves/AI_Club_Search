import { Router } from 'express';
import {
  reviewDecisionSchema,
  updateClubStatusSchema,
  updateContactSchema,
  upsertDraftSchema,
} from '@courtreach/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { enqueueOutreach } from '../queues/index.js';
import { logActivity } from '../services/activity.service.js';
import { toClubDto } from '../utils/serialize.js';

export const clubRouter = Router();
clubRouter.use(requireAuth);

/** Load a club and assert it belongs to the caller's team. */
async function getOwnedClub(clubId: string, teamId: string) {
  const club = await prisma.club.findFirst({
    where: { id: clubId, campaign: { teamId } },
    include: {
      contacts: { orderBy: { isPrimary: 'desc' } },
      outreach: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!club) throw notFound('Club not found');
  return club;
}

clubRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const club = await getOwnedClub(req.params.id, teamId);
    res.json(toClubDto(club));
  }),
);

clubRouter.patch(
  '/:id/status',
  validate(updateClubStatusSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedClub(req.params.id, teamId);
    const club = await prisma.club.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        outreach: { include: { messages: true } },
      },
    });
    res.json(toClubDto(club));
  }),
);

clubRouter.patch(
  '/contacts/:contactId',
  validate(updateContactSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.contactId, club: { campaign: { teamId } } },
    });
    if (!contact) throw notFound('Contact not found');
    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: req.body,
    });
    res.json(updated);
  }),
);

/** Save / edit the AI-generated draft for a club before sending. */
clubRouter.put(
  '/:id/draft',
  validate(upsertDraftSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const club = await getOwnedClub(req.params.id, teamId);
    const outreach = await prisma.outreach.upsert({
      where: { clubId: club.id },
      update: { subject: req.body.subject, body: req.body.body, ...(req.body.status ? { status: req.body.status } : {}) },
      create: {
        clubId: club.id,
        subject: req.body.subject,
        body: req.body.body,
        status: req.body.status ?? 'DRAFT',
      },
    });
    res.json(outreach);
  }),
);

/** Decision from the Uncertain review queue: approve & send, or skip. */
clubRouter.post(
  '/:id/review',
  validate(reviewDecisionSchema),
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const club = await getOwnedClub(req.params.id, teamId);

    if (req.body.decision === 'SKIP') {
      const updated = await prisma.club.update({ where: { id: club.id }, data: { status: 'SKIPPED' } });
      await logActivity({ teamId, actor: 'A teammate', action: `skipped ${club.name}`, userId });
      return res.json(toClubDto({ ...club, status: updated.status }));
    }

    // APPROVE_SEND: enqueue a targeted outreach job for this single club.
    const job = await enqueueOutreach(club.campaignId, club.id);
    await logActivity({ teamId, actor: 'A teammate', action: `approved sending to ${club.name}`, userId });
    res.status(202).json({ jobId: job.id });
  }),
);
