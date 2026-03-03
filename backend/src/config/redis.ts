import IORedis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/** Plain options object — safe to pass to BullMQ (avoids bundled ioredis type conflict). */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    db: parsed.pathname ? parseInt(parsed.pathname.replace(/^\//, '') || '0', 10) : 0,
  };
}

export const redisConnectionOptions = {
  ...parseRedisUrl(env.REDIS_URL),
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

/** IORedis client for direct Redis access (not for BullMQ). */
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error', { error: err.message }));
