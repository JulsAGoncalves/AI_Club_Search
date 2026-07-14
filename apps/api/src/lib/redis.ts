import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Shared Redis connection factory for BullMQ.
 * BullMQ requires `maxRetriesPerRequest: null` on its connections.
 */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const connection = createRedisConnection();
