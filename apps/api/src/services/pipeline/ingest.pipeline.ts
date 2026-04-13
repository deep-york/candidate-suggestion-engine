import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { documents, candidates } from '../../db/schema.js';
import { cache } from '../../cache/redis.cache.js';
import { storageService } from '../storage/minio.storage.js';
import { parserRegistry } from '../parsers/index.js';
import {
  extractCandidateProfile,
  extractJobDescriptionProfile,
} from '../extractor/llm-extractor.js';
import {
  embedder,
  buildCandidateEmbeddingText,
  buildJDEmbeddingText,
} from '../embeddings/openai.embedder.js';
import { jobDescriptions } from '../../db/schema.js';

type Stage =
  | 'parsing'
  | 'parsed'
  | 'extracting'
  | 'extracted'
  | 'embedding'
  | 'ready'
  | 'failed';

async function setStatus(
  documentId: string,
  status: Stage,
  error?: string,
): Promise<void> {
  await db
    .update(documents)
    .set({ status, error: error ?? null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

export async function runIngestPipeline(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) throw new Error(`Document ${documentId} not found`);

  try {
    // ── Step 1: Parse ────────────────────────────────────────────
    await setStatus(documentId, 'parsing');
    const fileBuffer = await storageService.get(doc.storageKey);
    const ext = doc.filename.split('.').pop() ?? '';
    const parser = parserRegistry.getParser(doc.mimeType, `.${ext}`);
    const parsed = await parser.parse(fileBuffer, doc.filename);
    await setStatus(documentId, 'parsed');

    // ── Step 2: LLM Extraction ───────────────────────────────────
    await setStatus(documentId, 'extracting');

    if (doc.docType === 'resume') {
      const profile = await extractCandidateProfile(parsed.rawText);
      await setStatus(documentId, 'extracted');

      // ── Step 3: Embed ──────────────────────────────────────────
      await setStatus(documentId, 'embedding');
      const embeddingText = buildCandidateEmbeddingText(profile);
      const vector = await embedder.embed(embeddingText);

      await db.insert(candidates).values({
        documentId,
        fullName: profile.fullName,
        email: profile.email,
        profile: profile as Record<string, unknown>,
        embedding: vector,
      });

      // Invalidate candidate list cache so the new entry is visible immediately
      await cache.invalidatePattern('candidates:page:*');
    } else {
      const profile = await extractJobDescriptionProfile(parsed.rawText);
      await setStatus(documentId, 'extracted');

      // ── Step 3: Embed ──────────────────────────────────────────
      await setStatus(documentId, 'embedding');
      const embeddingText = buildJDEmbeddingText(profile);
      const vector = await embedder.embed(embeddingText);

      await db.insert(jobDescriptions).values({
        documentId,
        title: profile.jobTitle,
        profile: profile as Record<string, unknown>,
        embedding: vector,
      });

      // Invalidate job list cache so the new JD is visible immediately
      await cache.invalidatePattern('jobs:*');
    }

    await setStatus(documentId, 'ready');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(documentId, 'failed', message);
    throw err;
  }
}
