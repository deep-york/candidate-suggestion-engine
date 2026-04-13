-- ─────────────────────────────────────────────────────────────────
-- PostgreSQL Initialisation — Candidate Suggestion Engine
-- Runs once on first container start via docker-entrypoint-initdb.d
-- ─────────────────────────────────────────────────────────────────

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- trigram text search

-- ─── documents ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  storage_key  TEXT NOT NULL,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('resume', 'jd')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN (
                   'pending', 'parsing', 'parsed',
                   'extracting', 'extracted',
                   'embedding', 'ready', 'failed'
                 )),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_storage_key_unique UNIQUE (storage_key)
);

CREATE INDEX IF NOT EXISTS idx_documents_status     ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type   ON documents (doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);

-- ─── candidates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  full_name        TEXT,
  email            TEXT,
  profile          JSONB NOT NULL DEFAULT '{}',
  embedding        vector(1536),
  embedding_model  TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbour cosine similarity
CREATE INDEX IF NOT EXISTS idx_candidates_embedding
  ON candidates USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for JSONB profile queries (skills, seniority filters)
CREATE INDEX IF NOT EXISTS idx_candidates_profile
  ON candidates USING gin (profile jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates (email);

-- ─── job_descriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_descriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents (id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  profile      JSONB NOT NULL DEFAULT '{}',
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_descriptions_embedding
  ON job_descriptions USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_job_descriptions_title
  ON job_descriptions USING gin (to_tsvector('english', title));

-- ─── match_results ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES job_descriptions (id) ON DELETE CASCADE,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  results     JSONB NOT NULL DEFAULT '[]',
  model_used  TEXT NOT NULL DEFAULT 'gpt-4o',
  CONSTRAINT match_results_job_run_unique UNIQUE (job_id, run_at)
);

CREATE INDEX IF NOT EXISTS idx_match_results_job_id ON match_results (job_id, run_at DESC);

-- ─── pipeline_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  event        TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_entity
  ON pipeline_events (entity_type, entity_id, created_at DESC);

-- ─── updated_at auto-update trigger ─────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
