import { Hono } from 'hono';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { candidates } from '../db/schema.js';
import { cache } from '../cache/redis.cache.js';
import {
  embedder,
  buildCandidateEmbeddingText,
} from '../services/embeddings/openai.embedder.js';
import type { CandidateProfile } from '../types/shared.js';

export const candidatesRouter = new Hono();

candidatesRouter.get('/', async (c) => {
  const page = Number(c.req.query('page') ?? '1');
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;
  const q = c.req.query('q')?.trim() ?? '';

  const whereClause = q
    ? or(
        ilike(candidates.fullName, `%${q}%`),
        ilike(candidates.email, `%${q}%`),
      )
    : undefined;

  const cacheKey = `candidates:page:${page}:limit:${limit}:q:${q}`;
  const cached = await cache.get(cacheKey);
  if (cached) return c.json(cached);

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        email: candidates.email,
        embeddingModel: candidates.embeddingModel,
        createdAt: candidates.createdAt,
        profile: candidates.profile,
      })
      .from(candidates)
      .where(whereClause)
      .orderBy(desc(candidates.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(candidates)
      .where(whereClause),
  ]);

  const response = { data: rows, page, limit, total: countRow?.total ?? 0 };
  await cache.set(cacheKey, response, 5 * 60);
  return c.json(response);
});

candidatesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [candidate] = await db
    .select({
      id: candidates.id,
      documentId: candidates.documentId,
      fullName: candidates.fullName,
      email: candidates.email,
      profile: candidates.profile,
      embeddingModel: candidates.embeddingModel,
      createdAt: candidates.createdAt,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  if (!candidate) return c.json({ error: 'Candidate not found' }, 404);

  return c.json(candidate);
});

candidatesRouter.put('/:id', async (c) => {
  const id = c.req.param('id');

  let body: {
    fullName?: string;
    email?: string;
    profile?: Partial<CandidateProfile>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { fullName, email, profile: profilePatch } = body;

  if (!fullName && !email && !profilePatch) {
    return c.json({ error: 'Provide at least one field to update' }, 400);
  }

  // Load current row
  const [existing] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  if (!existing) return c.json({ error: 'Candidate not found' }, 404);

  // Merge profile patch over existing profile
  const mergedProfile: CandidateProfile = {
    ...(existing.profile as unknown as CandidateProfile),
    ...profilePatch,
    // Allow top-level shortcuts to override the profile fields
    ...(fullName ? { fullName } : {}),
    ...(email ? { email } : {}),
  };

  // Re-generate the embedding from the updated profile
  let newEmbedding: number[];
  try {
    const embeddingText = buildCandidateEmbeddingText(mergedProfile);
    newEmbedding = await embedder.embed(embeddingText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Embedding failed';
    return c.json({ error: `Profile saved but re-embedding failed: ${msg}` }, 500);
  }

  const [updated] = await db
    .update(candidates)
    .set({
      fullName: mergedProfile.fullName ?? existing.fullName,
      email: mergedProfile.email ?? existing.email,
      profile: mergedProfile as unknown as Record<string, unknown>,
      embedding: newEmbedding,
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, id))
    .returning({ id: candidates.id, fullName: candidates.fullName });

  if (!updated) return c.json({ error: 'Candidate not found' }, 404);

  // Invalidate list cache and any match results that included this candidate
  await cache.invalidatePattern('candidates:page:*');
  await cache.invalidatePattern('matches:*');

  return c.json({ id: updated.id, fullName: updated.fullName });
});

candidatesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(candidates)
    .where(eq(candidates.id, id))
    .returning({ id: candidates.id });

  if (!deleted) return c.json({ error: 'Candidate not found' }, 404);

  // Invalidate caches
  await cache.invalidatePattern('candidates:page:*');
  await cache.invalidatePattern('matches:*');

  return c.json({ deleted: deleted.id });
});
