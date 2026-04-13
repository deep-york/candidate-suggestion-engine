import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  check,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Custom pgvector type ─────────────────────────────────────────
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(Number);
    },
  })(name);

// ─── documents ───────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    storageKey: text('storage_key').notNull(),
    docType: text('doc_type').notNull(),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('documents_storage_key_unique').on(table.storageKey),
    index('idx_documents_status').on(table.status),
    index('idx_documents_doc_type').on(table.docType),
    check(
      'documents_doc_type_check',
      sql`${table.docType} IN ('resume', 'jd')`,
    ),
    check(
      'documents_status_check',
      sql`${table.status} IN ('pending','parsing','parsed','extracting','extracted','embedding','ready','failed')`,
    ),
  ],
);

// ─── candidates ──────────────────────────────────────────────────
export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    fullName: text('full_name'),
    email: text('email'),
    profile: jsonb('profile').notNull().default({}),
    embedding: vector('embedding', 1536),
    embeddingModel: text('embedding_model')
      .notNull()
      .default('text-embedding-3-small'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_candidates_email').on(table.email),
    // HNSW index is created in init.sql (not expressible in Drizzle DSL)
  ],
);

// ─── job_descriptions ────────────────────────────────────────────
export const jobDescriptions = pgTable(
  'job_descriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    profile: jsonb('profile').notNull().default({}),
    embedding: vector('embedding', 1536),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    // HNSW index created in init.sql
  ],
);

// ─── match_results ───────────────────────────────────────────────
export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobDescriptions.id, { onDelete: 'cascade' }),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    results: jsonb('results').notNull().default([]),
    modelUsed: text('model_used').notNull().default('gpt-4o'),
  },
  (table) => [
    uniqueIndex('match_results_job_run_unique').on(table.jobId, table.runAt),
    index('idx_match_results_job_id').on(table.jobId),
  ],
);

// ─── pipeline_events ─────────────────────────────────────────────
export const pipelineEvents = pgTable(
  'pipeline_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    event: text('event').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_pipeline_events_entity').on(
      table.entityType,
      table.entityId,
    ),
  ],
);

// ─── Inferred types ───────────────────────────────────────────────
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type JobDescription = typeof jobDescriptions.$inferSelect;
export type NewJobDescription = typeof jobDescriptions.$inferInsert;
export type MatchResult = typeof matchResults.$inferSelect;
export type NewMatchResult = typeof matchResults.$inferInsert;
export type PipelineEvent = typeof pipelineEvents.$inferSelect;
