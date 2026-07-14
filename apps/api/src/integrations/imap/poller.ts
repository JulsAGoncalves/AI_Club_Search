import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { integrations, env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { logActivity } from '../../services/activity.service.js';

/** Normalize a Message-ID header for comparison. */
function normalizeId(id?: string | null): string | null {
  if (!id) return null;
  return id.trim().replace(/^<|>$/g, '').toLowerCase();
}

/**
 * Poll the configured IMAP inbox for replies and correlate them to outreach
 * records via the In-Reply-To / References headers. Marks clubs as REPLIED.
 * No-op when IMAP is not configured.
 */
export async function pollReplies(): Promise<number> {
  if (!integrations.imap) {
    logger.debug('IMAP not configured - skipping reply poll');
    return 0;
  }

  const client = new ImapFlow({
    host: env.IMAP_HOST!,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: env.IMAP_USER!, pass: env.IMAP_PASS! },
    logger: false,
  });

  let matched = 0;
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    // Only look at recent unseen messages to keep it light.
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    for await (const msg of client.fetch({ seen: false, since }, { envelope: true, source: true })) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const refs = [
        ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []),
        parsed.inReplyTo ?? '',
      ]
        .map(normalizeId)
        .filter((x): x is string => !!x);

      if (refs.length === 0) continue;

      const outreach = await prisma.outreach.findFirst({
        where: { messageId: { in: refs.map((r) => `<${r}>`) } },
        include: { club: true },
      });
      // messageId may be stored with or without angle brackets; try a looser match too.
      const found =
        outreach ??
        (await prisma.outreach.findFirst({
          where: { OR: refs.map((r) => ({ messageId: { contains: r } })) },
          include: { club: true },
        }));

      if (!found) continue;

      await prisma.$transaction([
        prisma.emailMessage.create({
          data: {
            outreachId: found.id,
            direction: 'INBOUND',
            subject: parsed.subject ?? null,
            body: parsed.text ?? parsed.html?.toString() ?? '',
            messageId: normalizeId(parsed.messageId),
          },
        }),
        prisma.outreach.update({ where: { id: found.id }, data: { status: 'REPLIED' } }),
        prisma.club.update({ where: { id: found.clubId }, data: { status: 'REPLIED' } }),
      ]);

      const campaign = await prisma.campaign.findUnique({ where: { id: found.club.campaignId } });
      if (campaign) {
        await logActivity({
          teamId: campaign.teamId,
          actor: 'Reply Poller',
          action: `received a reply from ${found.club.name}`,
          metadata: { clubId: found.clubId },
        });
      }
      matched += 1;
    }
  } finally {
    lock.release();
    await client.logout();
  }

  if (matched > 0) logger.info(`IMAP poll matched ${matched} replies`);
  return matched;
}
