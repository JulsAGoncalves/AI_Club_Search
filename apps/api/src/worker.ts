// Allow self-signed / corporate-proxy certs in development.
// Must be set before any TLS connections are made.
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { logger } from './lib/logger.js';
import { startDiscoveryWorker } from './workers/discovery.worker.js';
import { startVerificationWorker } from './workers/verification.worker.js';
import { startOutreachWorker } from './workers/outreach.worker.js';
import { startReplyPollWorker, scheduleReplyPolling } from './workers/replyPoll.worker.js';

async function main() {
  logger.info('Starting CourtReach workers...');

  const workers = [
    startDiscoveryWorker(),
    startVerificationWorker(),
    startOutreachWorker(),
    startReplyPollWorker(),
  ];

  await scheduleReplyPolling();
  logger.info('Workers ready: discovery, verification, outreach, reply-poll');

  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Worker bootstrap failed', err);
  process.exit(1);
});
