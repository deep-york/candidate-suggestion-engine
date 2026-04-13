import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { uploadsRouter } from './routes/uploads.js';
import { candidatesRouter } from './routes/candidates.js';
import { jobsRouter } from './routes/jobs.js';
import { startIngestionWorker } from './queues/workers/ingestion.worker.js';
import { db } from './db/index.js';
import { cache } from './cache/redis.cache.js';
import { sql } from 'drizzle-orm';

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────
app.use('*', logger());
app.use(
  '*',
  cors({
    origin:
      env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Routes ───────────────────────────────────────────────────────
app.route('/api/uploads', uploadsRouter);
app.route('/api/candidates', candidatesRouter);
app.route('/api/jobs', jobsRouter);

// ─── Health check ─────────────────────────────────────────────────
app.get('/api/health', async (c) => {
  const [dbOk, redisOk] = await Promise.all([
    db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
    cache.ping(),
  ]);

  const status = dbOk && redisOk ? 'ok' : 'degraded';
  return c.json({ status, db: dbOk, redis: redisOk }, dbOk && redisOk ? 200 : 503);
});

// ─── 404 ──────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ─── Error handler ────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Start BullMQ worker ─────────────────────────────────────────
startIngestionWorker();

// ─── Start server (Bun.serve — compatible with Bun --watch HMR) ──
export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🚀 API running on http://localhost:${env.PORT}`);
