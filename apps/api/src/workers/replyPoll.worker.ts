import { Worker } from 'bullmq';
import { connection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { QUEUE_NAMES, replyPollQueue } from '../queues/index.js';
import { pollReplies } from '../integrations/imap/poller.js';

/** Worker + repeatable scheduler that polls the IMAP inbox for replies. */
export function startReplyPollWorker() {
  const worker = new Worker(
    QUEUE_NAMES.replyPoll,
    async () => {
      const matched = await pollReplies();
      return { matched };
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (_job, err) => logger.error('Reply poll failed', err));
  return worker;
}

/** Register a repeatable job that polls every 5 minutes. */
export async function scheduleReplyPolling() {
  await replyPollQueue.add(
    'poll',
    {},
    {
      repeat: { every: 1000 * 60 * 5 },
      removeOnComplete: 10,
      removeOnFail: 10,
      jobId: 'reply-poll-repeatable',
    },
  );
}
