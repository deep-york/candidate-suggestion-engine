import { env } from './env.js';

/**
 * BullMQ requires connection options (host/port), NOT an IORedis instance.
 * When given an IORedis URL-string instance, BullMQ's internal .duplicate()
 * call fails because it can't re-parse the URL from the instance's options.
 */
export function getBullMQConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname.length > 1
      ? { db: Number(url.pathname.slice(1)) }
      : {}),
  };
}
