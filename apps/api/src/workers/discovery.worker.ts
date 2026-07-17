import { Worker } from 'bullmq';
import type { SportType } from '@courtreach/shared';
import { connection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { QUEUE_NAMES, type CampaignJobData, enqueueVerification } from '../queues/index.js';
import { getDiscoverySource } from '../integrations/discovery/index.js';
import { geocodeRegion, geocodePlace, haversineKm } from '../integrations/discovery/geocoder.js';
import { getContactFinder } from '../integrations/contacts/index.js';
import { getAiClient } from '../integrations/ai/index.js';
import { scrapeWebsite } from '../integrations/scraper/scraper.js';
import { findClubWebsite } from '../integrations/search/website-finder.js';
import {
  isJobCancelled,
  markJobCompleted,
  markJobFailed,
  markJobRunning,
  setJobProgress,
} from '../services/job.service.js';
import { logActivity } from '../services/activity.service.js';

/** True when Anthropic is configured and its web-search tool can be used. */
function canUseWebsiteFinder(): boolean {
  return env.AI_PROVIDER === 'anthropic' && !!env.ANTHROPIC_API_KEY;
}

function regionFromJson(region: unknown) {
  return region as { label: string; lat?: number; lng?: number; radiusKm?: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check each CSV-imported club (still status IMPORTED) against the campaign
 * region: geocode the club name within the region label and keep it if it falls
 * inside the search radius. In-area clubs become DISCOVERED (so they flow
 * through the normal pipeline); the rest are marked OUT_OF_AREA.
 */
async function verifyImportedClubs(
  campaignId: string,
  teamId: string,
  region: { label: string; lat?: number; lng?: number; radiusKm?: number },
): Promise<{ inArea: number; outOfArea: number }> {
  const imported = await prisma.club.findMany({
    where: { campaignId, source: 'import', status: 'IMPORTED' },
  });
  if (imported.length === 0) return { inArea: 0, outOfArea: 0 };
  if (region.lat == null || region.lng == null || region.radiusKm == null) {
    return { inArea: 0, outOfArea: 0 };
  }

  let inArea = 0;
  let outOfArea = 0;
  for (const club of imported) {
    const geo = await geocodePlace(`${club.name}, ${region.label}`);
    const within =
      geo != null && haversineKm(region.lat, region.lng, geo.lat, geo.lng) <= region.radiusKm;
    if (within && geo) {
      await prisma.club.update({
        where: { id: club.id },
        data: {
          status: 'DISCOVERED',
          lat: geo.lat,
          lng: geo.lng,
          address: club.address ?? geo.displayName,
        },
      });
      inArea += 1;
    } else {
      await prisma.club.update({ where: { id: club.id }, data: { status: 'OUT_OF_AREA' } });
      outOfArea += 1;
    }
    // Respect Nominatim's ~1 req/sec fair-use policy.
    await sleep(1100);
  }

  logActivity({
    teamId,
    actor: 'Discovery Agent',
    action: `verified imported list: ${inArea} in area, ${outOfArea} out of area`,
  });
  return { inArea, outOfArea };
}

/**
 * Discovery worker: find clubs via the discovery source, then enrich each with
 * contact candidates (scraped emails + Hunter), persisting Clubs and Contacts.
 */
export function startDiscoveryWorker() {
  const worker = new Worker<CampaignJobData>(
    QUEUE_NAMES.discovery,
    async (job) => {
      const { campaignId, jobId } = job.data;
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      if (await isJobCancelled(jobId)) return { clubs: 0, cancelled: true };

      await markJobRunning(jobId);
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'DISCOVERING' } });

      const source = getDiscoverySource();
      const finder = getContactFinder();
      const region = regionFromJson(campaign.region);
      const sportTypes = campaign.sportTypes as SportType[];

      // Resolve free-text region labels (e.g. "London, Ontario, Canada") into a
      // specific coordinate + radius so we search the correct place. This also
      // disambiguates places that share a name.
      if (region.lat == null || region.lng == null || region.radiusKm == null) {
        const geo = await geocodeRegion(region.label);
        region.lat = geo.lat;
        region.lng = geo.lng;
        region.radiusKm = geo.radiusKm;
        logActivity({
          teamId: campaign.teamId,
          actor: 'Discovery Agent',
          action: `resolved region "${region.label}" to ${geo.displayName} (~${geo.radiusKm}km radius)`,
        });
      }

      const rawClubs = await source.search(region, sportTypes);
      await markJobRunning(jobId, rawClubs.length);
      logActivity({
        teamId: campaign.teamId,
        actor: 'Discovery Agent',
        action: `found ${rawClubs.length} clubs for "${campaign.name}"`,
      });

      const aiClient = getAiClient();
      const useWebsiteFinder = canUseWebsiteFinder();

      let processed = 0;
      for (const raw of rawClubs) {
        // ── Step 1: Find website if OSM did not provide one ──────────────────
        let website = raw.website;
        if (!website && useWebsiteFinder) {
          website = await findClubWebsite(
            raw.name,
            raw.address,
            raw.sportType,
            env.ANTHROPIC_API_KEY!,
            env.AI_MODEL,
          );
        }

        // ── Step 2: Scrape the website ────────────────────────────────────────
        const scrape = await scrapeWebsite(website);

        // ── Step 3: Filter out non-club venues ────────────────────────────────
        // Only skip if the AI is highly confident (≥ 0.85) to minimise
        // false positives. Errors default to isClub=true.
        const venueClass = await aiClient.classifyVenue({
          name: raw.name,
          address: raw.address,
          sportType: raw.sportType,
          evidence: scrape.evidence,
        });

        if (!venueClass.isClub && venueClass.confidence >= 0.85) {
          logger.info(`Skipping "${raw.name}" — not a club: ${venueClass.reasoning}`);
          logActivity({
            teamId: campaign.teamId,
            actor: 'Discovery Agent',
            action: `skipped "${raw.name}" — not a club: ${venueClass.reasoning}`,
          });
          await prisma.club.upsert({
            where: { campaignId_externalId: { campaignId, externalId: raw.externalId } },
            update: { status: 'SKIPPED' },
            create: {
              campaignId,
              externalId: raw.externalId,
              name: raw.name,
              address: raw.address,
              lat: raw.lat,
              lng: raw.lng,
              sportType: raw.sportType,
              website,
              source: raw.source,
              status: 'SKIPPED',
            },
          });
          processed += 1;
          await setJobProgress(jobId, processed);
          await job.updateProgress(Math.round((processed / rawClubs.length) * 100));
          if (await isJobCancelled(jobId)) {
            logger.info(`Discovery job ${jobId} cancelled after processing ${processed} clubs`);
            return { clubs: processed, cancelled: true };
          }
          continue;
        }

        // ── Step 4: Detect booking/membership platform ────────────────────────
        // Pattern matching runs first (fast, free); fall back to AI when the
        // scrape yielded text but no pattern matched.
        let membershipSystem = scrape.membershipSystem;
        if (!membershipSystem && scrape.evidence) {
          membershipSystem = await aiClient.detectBookingSystem(raw.name, scrape.evidence);
          if (membershipSystem) {
            logger.debug(`AI detected booking system "${membershipSystem}" for "${raw.name}"`);
          }
        }

        // ── Step 5: Upsert club ───────────────────────────────────────────────
        const club = await prisma.club.upsert({
          where: { campaignId_externalId: { campaignId, externalId: raw.externalId } },
          update: {
            name: raw.name,
            address: raw.address,
            website,
            membershipSystem,
          },
          create: {
            campaignId,
            externalId: raw.externalId,
            name: raw.name,
            address: raw.address,
            lat: raw.lat,
            lng: raw.lng,
            sportType: raw.sportType,
            website,
            membershipSystem,
            source: raw.source,
            status: 'DISCOVERED',
          },
        });

        // ── Step 6: Find contacts ─────────────────────────────────────────────
        const candidates = [];

        if (finder && scrape.domain) {
          try {
            const found = await finder.findByDomain(scrape.domain, raw.name);
            candidates.push(...found);
          } catch (err) {
            logger.warn(`Contact finder failed for ${scrape.domain}`, err);
          }
        }

        // Add scraped emails that the finder did not already return.
        const known = new Set(candidates.map((c) => c.email));
        for (const email of scrape.emails) {
          if (!known.has(email)) {
            candidates.push({
              name: null,
              role: null,
              email,
              phone: null,
              linkedinUrl: null,
              confidence: null,
              source: 'scrape',
            });
          }
        }

        if (candidates.length > 0) {
          // Replace existing pending contacts for idempotency on re-runs.
          await prisma.contact.deleteMany({ where: { clubId: club.id } });
          await prisma.contact.createMany({
            data: candidates.slice(0, 8).map((c, i) => ({
              clubId: club.id,
              name: c.name,
              role: c.role,
              email: c.email,
              phone: c.phone,
              linkedinUrl: c.linkedinUrl,
              confidenceScore: c.confidence,
              isPrimary: i === 0,
            })),
          });
          if (club.status === 'DISCOVERED') {
            await prisma.club.update({ where: { id: club.id }, data: { status: 'CONTACT_FOUND' } });
          }
        }

        processed += 1;
        await setJobProgress(jobId, processed);
        await job.updateProgress(Math.round((processed / rawClubs.length) * 100));

        if (await isJobCancelled(jobId)) {
          logger.info(`Discovery job ${jobId} cancelled after processing ${processed} clubs`);
          return { clubs: processed, cancelled: true };
        }
      }

      // Cross-check any CSV-imported clubs against this region.
      await verifyImportedClubs(campaignId, campaign.teamId, region);

      await markJobCompleted(jobId);
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

      // Chain into verification automatically.
      await enqueueVerification(campaignId);
      return { clubs: rawClubs.length };
    },
    { connection, concurrency: 1, lockDuration: 600_000 },
  );

  worker.on('failed', async (job, err) => {
    logger.error('Discovery job failed', err);
    if (job?.data.jobId) {
      const cancelled = await isJobCancelled(job.data.jobId).catch(() => false);
      if (!cancelled) {
        await markJobFailed(job.data.jobId, err.message).catch((e) => logger.warn('markJobFailed skipped (record not found)', e));
        if (job.data.campaignId) {
          await prisma.campaign.update({
            where: { id: job.data.campaignId },
            data: { status: 'DRAFT' },
          }).catch((e) => logger.warn('Failed to reset campaign status after discovery failure', e));
        }
      }
    }
  });

  return worker;
}
