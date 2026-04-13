import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { storageService } from '../services/storage/minio.storage.js';
import { enqueueIngestion } from '../queues/ingestion.queue.js';
import { DocTypeSchema } from '../types/shared.js';

export const uploadsRouter = new Hono();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

uploadsRouter.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const docTypeRaw = formData.get('type') as string | null;

  if (!file) {
    return c.json({ error: 'Missing file field' }, 400);
  }

  const docTypeResult = DocTypeSchema.safeParse(docTypeRaw);
  if (!docTypeResult.success) {
    return c.json({ error: 'type must be "resume" or "jd"' }, 400);
  }

  console.log(`Received upload: ${file.name} (${file.type}, ${file.size} bytes)`);

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json(
      { error: `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, DOC` },
      415,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return c.json({ error: 'File exceeds 10 MB limit' }, 413);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const storageKey = storageService.buildKey(docTypeResult.data, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  await storageService.put(storageKey, buffer, file.type);

  const [doc] = await db
    .insert(documents)
    .values({
      filename: file.name,
      mimeType: file.type,
      storageKey,
      docType: docTypeResult.data,
      status: 'pending',
    })
    .returning({ id: documents.id });

  await enqueueIngestion(doc!.id);

  return c.json({ documentId: doc!.id, status: 'queued' }, 202);
});

uploadsRouter.get('/:id/status', async (c) => {
  const id = c.req.param('id');

  const [doc] = await db
    .select({
      id: documents.id,
      status: documents.status,
      error: documents.error,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return c.json({ error: 'Document not found' }, 404);

  return c.json(doc);
});
