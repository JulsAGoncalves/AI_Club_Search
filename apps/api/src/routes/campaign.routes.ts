import { Router } from 'express';
import { createCampaignSchema, importClubsSchema, updateCampaignSchema } from '@courtreach/shared';
import type { Prisma } from '@prisma/client';
import { validate } from '../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { enqueueDiscovery, enqueueOutreach, enqueueVerification } from '../queues/index.js';
import { getAnalytics, getStatusCounts } from '../services/campaign.service.js';
import { logActivity } from '../services/activity.service.js';
import { markJobCancelled } from '../services/job.service.js';
import { toCampaignDto, toClubDto, toJobDto } from '../utils/serialize.js';

/** Extract the first field of a CSV line, honouring simple double-quoting. */
function firstCsvField(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('"')) {
    let out = '';
    for (let i = 1; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (ch === '"') {
        if (trimmed[i + 1] === '"') {
          out += '"';
          i += 1;
        } else {
          break;
        }
      } else {
        out += ch;
      }
    }
    return out.trim();
  }
  const comma = trimmed.indexOf(',');
  return (comma === -1 ? trimmed : trimmed.slice(0, comma)).trim();
}

const CSV_HEADER_LABELS = new Set(['name', 'club', 'club name', 'clubname', 'clubs']);

/** Parse a CSV of club names (first column), skipping a header row if present. */
function parseClubNames(csv: string): string[] {
  const rows = csv
    .split(/\r?\n/)
    .map(firstCsvField)
    .filter((name) => name.length > 0);
  if (rows.length && CSV_HEADER_LABELS.has(rows[0].toLowerCase())) rows.shift();
  // De-duplicate case-insensitively while preserving first-seen casing.
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of rows) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Escape a single CSV cell (quote when it contains comma, quote, or newline). */
function csvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const campaignRouter = Router();
campaignRouter.use(requireAuth);

/** Load a campaign scoped to the caller's team, or 404. */
async function getOwnedCampaign(campaignId: string, teamId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId } });
  if (!campaign) throw notFound('Campaign not found');
  return campaign;
}

campaignRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaigns = await prisma.campaign.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
    const withCounts = await Promise.all(
      campaigns.map(async (c) => toCampaignDto(c, await getStatusCounts(c.id))),
    );
    res.json(withCounts);
  }),
);

campaignRouter.post(
  '/',
  validate(createCampaignSchema),
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const input = req.body;
    const campaign = await prisma.campaign.create({
      data: {
        teamId,
        name: input.name,
        region: input.region as Prisma.InputJsonValue,
        sportTypes: input.sportTypes,
        autoSendVerified: input.autoSendVerified,
        dailySendLimit: input.dailySendLimit,
        followUpDays: input.followUpDays,
      },
    });
    await logActivity({ teamId, actor: 'A teammate', action: `created campaign "${campaign.name}"`, userId });
    res.status(201).json(toCampaignDto(campaign, await getStatusCounts(campaign.id)));
  }),
);

campaignRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    res.json(toCampaignDto(campaign, await getStatusCounts(campaign.id)));
  }),
);

campaignRouter.patch(
  '/:id',
  validate(updateCampaignSchema),
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedCampaign(req.params.id, teamId);
    const input = req.body;
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.region !== undefined ? { region: input.region as Prisma.InputJsonValue } : {}),
        ...(input.sportTypes !== undefined ? { sportTypes: input.sportTypes } : {}),
        ...(input.autoSendVerified !== undefined ? { autoSendVerified: input.autoSendVerified } : {}),
        ...(input.dailySendLimit !== undefined ? { dailySendLimit: input.dailySendLimit } : {}),
        ...(input.followUpDays !== undefined ? { followUpDays: input.followUpDays } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    res.json(toCampaignDto(campaign, await getStatusCounts(campaign.id)));
  }),
);

campaignRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await logActivity({ teamId, actor: 'A teammate', action: `deleted campaign "${campaign.name}"`, userId });
    res.status(204).end();
  }),
);

/* --- Pipeline actions --- */

campaignRouter.post(
  '/:id/discover',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    const job = await enqueueDiscovery(campaign.id);
    res.status(202).json(toJobDto(job));
  }),
);

campaignRouter.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    const job = await enqueueVerification(campaign.id);
    res.status(202).json(toJobDto(job));
  }),
);

campaignRouter.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    const job = await enqueueOutreach(campaign.id);
    res.status(202).json(toJobDto(job));
  }),
);

campaignRouter.delete(
  '/:id/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedCampaign(req.params.id, teamId);
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, campaignId: req.params.id },
    });
    if (!job) throw notFound('Job not found');
    if (job.status !== 'RUNNING' && job.status !== 'QUEUED') {
      res.status(409).json({ error: 'Job is not active and cannot be cancelled' });
      return;
    }
    await markJobCancelled(req.params.jobId);
    if (job.status === 'RUNNING') {
      await prisma.campaign.update({
        where: { id: req.params.id },
        data: { status: 'ACTIVE' },
      });
    }
    res.status(204).end();
  }),
);

/* --- Reads --- */

campaignRouter.get(
  '/:id/jobs',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedCampaign(req.params.id, teamId);
    const jobs = await prisma.job.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(jobs.map(toJobDto));
  }),
);

campaignRouter.get(
  '/:id/analytics',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedCampaign(req.params.id, teamId);
    res.json(await getAnalytics(req.params.id));
  }),
);

campaignRouter.get(
  '/:id/clubs',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    await getOwnedCampaign(req.params.id, teamId);
    const { status } = req.query as { status?: string };
    const clubs = await prisma.club.findMany({
      where: { campaignId: req.params.id, ...(status ? { status: status as never } : {}) },
      include: { contacts: { orderBy: { isPrimary: 'desc' } }, outreach: true },
      orderBy: { name: 'asc' },
    });
    res.json(clubs.map((c) => toClubDto(c)));
  }),
);

/**
 * Seed the campaign with a list of known club names from a CSV. Imported clubs
 * start as IMPORTED and get cross-checked against the region on next discovery.
 */
campaignRouter.post(
  '/:id/clubs/import',
  validate(importClubsSchema),
  asyncHandler(async (req, res) => {
    const { teamId, userId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);

    const names = parseClubNames(req.body.csv);
    if (names.length === 0) {
      res.status(400).json({ error: 'No club names found in the CSV. Put one club name per row.' });
      return;
    }

    // Imported clubs have no known sport yet; default to the campaign's first.
    const defaultSport = (campaign.sportTypes as string[])[0] ?? 'BADMINTON';

    let imported = 0;
    for (const name of names) {
      const externalId = `import/${slugify(name) || name}`;
      await prisma.club.upsert({
        where: { campaignId_externalId: { campaignId: campaign.id, externalId } },
        update: { name },
        create: {
          campaignId: campaign.id,
          externalId,
          name,
          sportType: defaultSport as never,
          source: 'import',
          status: 'IMPORTED',
        },
      });
      imported += 1;
    }

    await logActivity({
      teamId,
      actor: 'A teammate',
      action: `imported ${imported} clubs into "${campaign.name}"`,
      userId,
    });
    res.status(201).json({ imported });
  }),
);

/** Export all clubs (with primary contact) for a campaign as a CSV download. */
campaignRouter.get(
  '/:id/clubs/export',
  asyncHandler(async (req, res) => {
    const { teamId } = (req as AuthedRequest).auth;
    const campaign = await getOwnedCampaign(req.params.id, teamId);
    const clubs = await prisma.club.findMany({
      where: { campaignId: campaign.id },
      include: { contacts: { orderBy: { isPrimary: 'desc' } } },
      orderBy: { name: 'asc' },
    });

    const header = [
      'name',
      'address',
      'sport',
      'status',
      'website',
      'membershipSystem',
      'source',
      'primaryContactName',
      'primaryContactEmail',
      'primaryContactRole',
      'lat',
      'lng',
    ];
    const lines = [header.join(',')];
    for (const club of clubs) {
      const primary = club.contacts[0];
      lines.push(
        [
          club.name,
          club.address,
          club.sportType,
          club.status,
          club.website,
          club.membershipSystem,
          club.source,
          primary?.name,
          primary?.email,
          primary?.role,
          club.lat,
          club.lng,
        ]
          .map(csvCell)
          .join(','),
      );
    }

    const filename = `clubs-${slugify(campaign.name) || campaign.id}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Prefix a BOM so Excel opens UTF-8 correctly.
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  }),
);
