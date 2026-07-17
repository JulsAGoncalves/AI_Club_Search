import { Router } from 'express';
import { createGroupSchema, updateGroupSchema, setGroupCampaignsSchema } from '@courtreach/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from '../services/activity.service.js';

export const groupRouter = Router();
groupRouter.use(requireAuth);

async function getOwnedGroup(groupId: string, teamId: string) {
  const group = await prisma.campaignGroup.findFirst({ where: { id: groupId, teamId } });
  if (!group) throw notFound('Group not found');
  return group;
}

function toGroupDto(g: { id: string; name: string; createdAt: Date }) {
  return { id: g.id, name: g.name, createdAt: g.createdAt.toISOString() };
}

/** List all groups for the team, each including the campaign IDs that belong to it. */
groupRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const groups = await prisma.campaignGroup.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
      include: { campaigns: { select: { id: true } } },
    });
    res.json(
      groups.map((g) => ({
        ...toGroupDto(g),
        campaignIds: g.campaigns.map((c) => c.id),
      })),
    );
  }),
);

/** Create a new group. */
groupRouter.post(
  '/',
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const group = await prisma.campaignGroup.create({
      data: { teamId, name: req.body.name },
    });
    await logActivity({ teamId, actor: 'A teammate', action: `created group "${group.name}"`, userId });
    res.status(201).json({ ...toGroupDto(group), campaignIds: [] });
  }),
);

/** Rename a group. */
groupRouter.patch(
  '/:id',
  validate(updateGroupSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedGroup(req.params.id, teamId);
    const group = await prisma.campaignGroup.update({
      where: { id: req.params.id },
      data: { name: req.body.name },
      include: { campaigns: { select: { id: true } } },
    });
    res.json({ ...toGroupDto(group), campaignIds: group.campaigns.map((c) => c.id) });
  }),
);

/** Delete a group. Campaigns in this group become ungrouped (groupId → null via SetNull). */
groupRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const group = await getOwnedGroup(req.params.id, teamId);
    await prisma.campaignGroup.delete({ where: { id: group.id } });
    await logActivity({ teamId, actor: 'A teammate', action: `deleted group "${group.name}"`, userId });
    res.status(204).end();
  }),
);

/**
 * Replace the full set of campaigns in a group.
 * Campaigns not in the list are moved to ungrouped; campaigns in the list that
 * belonged to a different group are moved to this one.
 */
groupRouter.put(
  '/:id/campaigns',
  validate(setGroupCampaignsSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedGroup(req.params.id, teamId);
    const { campaignIds }: { campaignIds: string[] } = req.body;

    await prisma.$transaction([
      // Remove this group from any campaign currently in it but not in the new list.
      prisma.campaign.updateMany({
        where: { groupId: req.params.id, id: { notIn: campaignIds } },
        data: { groupId: null },
      }),
      // Assign all listed campaigns to this group (must be owned by the same team).
      prisma.campaign.updateMany({
        where: { id: { in: campaignIds }, teamId },
        data: { groupId: req.params.id },
      }),
    ]);

    const updated = await prisma.campaignGroup.findFirst({
      where: { id: req.params.id },
      include: { campaigns: { select: { id: true } } },
    });
    res.json({ ...toGroupDto(updated!), campaignIds: updated!.campaigns.map((c) => c.id) });
  }),
);
