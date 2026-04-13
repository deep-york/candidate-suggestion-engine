import { Hono } from 'hono';
import { eq, desc, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jobDescriptions, matchResults } from '../db/schema.js';
import { runMatchPipeline } from '../services/pipeline/match.pipeline.js';
import { cache } from '../cache/redis.cache.js';

export const jobsRouter = new Hono();

jobsRouter.get('/', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const page = Math.max(1, Number(c.req.query('page') ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const whereClause = q ? ilike(jobDescriptions.title, `%${q}%`) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: jobDescriptions.id,
        title: jobDescriptions.title,
        createdAt: jobDescriptions.createdAt,
      })
      .from(jobDescriptions)
      .where(whereClause)
      .orderBy(desc(jobDescriptions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(jobDescriptions)
      .where(whereClause),
  ]);

  return c.json({ data: rows, total: countRow?.total ?? 0, page, limit });
});

jobsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [jd] = await db
    .select()
    .from(jobDescriptions)
    .where(eq(jobDescriptions.id, id))
    .limit(1);

  if (!jd) return c.json({ error: 'Job not found' }, 404);

  const { embedding: _embedding, ...rest } = jd;
  return c.json(rest);
});

jobsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');

  let body: { title?: string; profile?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : undefined;
  const profile =
    body.profile && typeof body.profile === 'object' ? body.profile : undefined;

  if (!title && !profile) {
    return c.json({ error: 'Provide title or profile to update' }, 400);
  }

  // Clear embedding so it is re-generated on the next match run
  const [updated] = await db
    .update(jobDescriptions)
    .set({
      ...(title ? { title } : {}),
      ...(profile ? { profile } : {}),
      embedding: null as unknown as number[],
    })
    .where(eq(jobDescriptions.id, id))
    .returning({ id: jobDescriptions.id, title: jobDescriptions.title });

  if (!updated) return c.json({ error: 'Job not found' }, 404);

  await cache.invalidatePattern(`matches:${id}`);
  return c.json(updated);
});

jobsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(jobDescriptions)
    .where(eq(jobDescriptions.id, id))
    .returning({ id: jobDescriptions.id });

  if (!deleted) return c.json({ error: 'Job not found' }, 404);

  await cache.invalidatePattern(`matches:${id}`);
  return c.json({ deleted: deleted.id });
});

jobsRouter.post('/:id/match', async (c) => {
  const id = c.req.param('id');

  try {
    const result = await runMatchPipeline(id);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Match pipeline failed';
    return c.json({ error: message }, 500);
  }
});

jobsRouter.get('/:id/matches', async (c) => {
  const id = c.req.param('id');

  const cacheKey = `matches:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return c.json(cached);

  const [latest] = await db
    .select()
    .from(matchResults)
    .where(eq(matchResults.jobId, id))
    .orderBy(desc(matchResults.runAt))
    .limit(1);

  if (!latest) return c.json({ error: 'No match results found for this job' }, 404);

  return c.json(latest);
});

jobsRouter.get('/:id/matches/:runId', async (c) => {
  const { id, runId } = c.req.param();

  const [run] = await db
    .select()
    .from(matchResults)
    .where(eq(matchResults.id, runId))
    .limit(1);

  if (!run || run.jobId !== id) {
    return c.json({ error: 'Match run not found' }, 404);
  }

  return c.json(run);
});
