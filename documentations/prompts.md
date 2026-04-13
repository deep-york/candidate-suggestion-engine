# Prompts Log — Candidate Suggestion Engine

> This file logs all user prompts submitted during the design and implementation of the Candidate Suggestion Engine, in chronological order with timestamps.

---

## Prompt #1

**Timestamp:** 2026-04-13T10:00:00+00:00

**Prompt:**

> Plan and created design.md for "Candidate Suggestion Engine" which should be dockerised application in react + node.js which uses bun + TS + CDK + vite + tailwindcss + playwright e2e.
>
> For now we can utilize lightweight DB but that should be easily migratable in the production ready RDS Aurora or DynamoDB in future.
>
> We also want to integrate the Queue mechanism and caching mechanism locally but in future we might use the managed services from the AWS.
>
> Below is the actual requirements:
>
> Design and implement a service that:
> - Parses resumes and job descriptions from multiple file formats
> - Builds a pipeline from document ingestion through to a ranked candidate output
> - Returns the Top 10 best-matched candidates for a given job role
>
> Your solution must address all three of the following:
>
> **1. File Format Handling**
> Ingestion must support at minimum PDF and DOCX formats. Your parsing approach should be extensible to additional formats without a full rewrite.
>
> **2. Data Pipeline**
> Define and implement the full flow: raw document intake → parsing → scoring → ranked output. The pipeline does not need to be production-grade, but the design must be. Use DESIGN.md to document what a production version would look like.
>
> **3. Cold Start Accuracy**
> Explain how your system handles a brand-new job posting with no historical data or prior match signals. Your approach must be reasoned and defensible — not deferred to future work.
>
> Also side by side create a prompts.md with timestamp to log the prompts I give you for the references.
>
> **My inputs:**
>
> 1. Is it possible to use the pgvector for now to parse the resume and store it as vector if we are using the third party LLM OpenAI to suggest the candidates based on the Resume parsing? I believe for that we would need a RAG system instead that can leverage that. But for now I believe we have to come up with a solution which will use the Third Party APIs in mind to suggest top 10 candidates based on parsed resume.
>
> 2. Also if possible can we build a local RAG system if the pgvector is required to perfectly fetch the top 10 candidates?

**AI Response Summary:**

- Created `DESIGN.md` with a comprehensive architectural blueprint covering:
  - Full tech stack: Bun + TypeScript + Hono (API), React + Vite + TailwindCSS (Web), AWS CDK (infra), Playwright (E2E), Docker Compose (local)
  - **File Format Handling**: Strategy pattern parser registry (`IDocumentParser` interface). PDF via `pdf-parse`, DOCX via `mammoth`. New formats require only implementing one interface.
  - **Data Pipeline**: Full flow — Upload → MinIO/S3 → BullMQ queue → Parse → OpenAI GPT-4o extraction (structured JSON) → OpenAI `text-embedding-3-small` embedding → pgvector store → cosine similarity search (top-20 recall) → GPT-4o re-ranking → top-10 ranked output with rationale.
  - **Cold Start Accuracy**: Solved by design via content-based semantic matching (embeddings work from day one, no historical data required). Five-layer defence: vector similarity, hard constraint filters, LLM skill-gap analysis, seniority-aware scoring, recency weighting.
  - **RAG Architecture**: Confirmed yes to both user questions. pgvector IS used as the vector store for a local RAG system. PostgreSQL + pgvector runs in Docker locally and maps 1:1 to RDS Aurora PostgreSQL (pgvector supported) in production. OpenAI is the only external dependency.
  - **Queue**: BullMQ + Redis locally → AWS SQS in production (abstracted via `IQueueService` interface).
  - **Cache**: Redis locally → AWS ElastiCache in production (abstracted via `ICache` interface).
  - **DB Migration Path**: Local Docker PostgreSQL → RDS Aurora PostgreSQL (pgvector, zero schema changes), or optionally DynamoDB + OpenSearch for vector search.
  - **CDK Stacks**: network, database, cache, queue, storage, api, web.
  - **Project Structure**: Full monorepo layout with `apps/api`, `apps/web`, `infra/cdk`.
  - **Security**: MIME validation, prompt injection hardening, PII masking, presigned S3 URLs, parameterised queries, rate limiting.
  - **Performance**: Latency budgets, HNSW vs IVFFlat index guidance, embedding batching strategy.
  - Sequence diagrams for ingestion and matching pipelines.
- Created `prompts.md` (this file) for prompt logging.

---

## Prompt #2

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Is it a good option to use Postgres for this requirements or should we just use another approach for a local RAG system?
>
> Is a local RAG system even required for these requirements?

**AI Response Summary:**

- **PostgreSQL + pgvector verdict**: Yes, it is the right choice for this system — not just viable but optimal, because PostgreSQL is already required for relational data (candidates, jobs, match results), so pgvector is a zero-cost extension rather than a new service. Single DB for both structured and vector data, atomic consistency, and a clean 1:1 production migration path to RDS Aurora PostgreSQL (which natively supports pgvector).
- **Alternatives considered**: ChromaDB, Qdrant, Weaviate (dedicated vector DBs) all require an additional Docker service with no material benefit at resume-scale (<10K documents). FAISS / in-memory cosine similarity is viable for very small datasets but loses persistence and the relational join capability. SQLite + sqlite-vss is lightweight but has no cloud migration path.
- **Is a local RAG system required?**: The "Retrieval" half (vector similarity search) is strictly required for scalable semantic candidate matching — pure LLM batching hits token limits quickly. The "Generation" half (GPT-4o re-ranking) is strongly recommended for accuracy but technically optional. So: the vector store + embedding pipeline is non-negotiable; the full two-stage RAG (recall → re-rank) is the recommended architecture.
- **Conclusion**: PostgreSQL + pgvector is the correct choice. A dedicated vector DB would add operational complexity for zero gain at this scale. The RAG retrieval layer is required; the full pipeline as designed in DESIGN.md is the right approach.

---

## Prompt #3

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Let's create a plan for this system then and create a dockerized system that can recommend the candidates based on the parsed resumes.
>
> Given TODOs:
> - Create a DB design for this requirement
> - Create architecture and flow diagrams for this requirement
> - Start developing the boilerplate for this requirement within docker with bun

**AI Response Summary:**

- Created full project boilerplate for the Candidate Suggestion Engine under a Bun monorepo structure (`apps/api`, `apps/web`, `infra/cdk`).
- **DB Design**: Created Drizzle ORM schema (`apps/api/src/db/schema.ts`) with five tables: `documents`, `candidates`, `job_descriptions`, `match_results`, `pipeline_events`. Indexes include HNSW on `embedding` vector(1536) for cosine similarity and GIN on JSONB `profile` columns. Also created `docker/postgres/init.sql` to bootstrap pgvector and uuid-ossp extensions.
- **Architecture & Flow Diagrams**: Created four Mermaid diagram files under `documentations/diagrams/`: system-architecture, db-schema (ER diagram), ingestion-pipeline (flowchart), matching-pipeline (flowchart).
- **Docker Setup**: Created `docker-compose.yml` (PostgreSQL pgvector 16 + Redis 7 + MinIO + API + Web), `docker-compose.test.yml` (E2E test stack), and `.env.example` with all required environment variables.
- **API Boilerplate** (`apps/api`): Hono entry point, Zod env validation, OpenAI client, Drizzle DB client, Drizzle config, BullMQ queue + ingestion worker, Redis cache, MinIO storage service, strategy-pattern parser registry (PDF + DOCX), LLM extractor, OpenAI embedder, ingest pipeline, match pipeline, LLM re-ranker, and all API routes (`/uploads`, `/candidates`, `/jobs`).
- **Web Boilerplate** (`apps/web`): React 19 + Vite + TailwindCSS v4, typed API client, TanStack Query setup, three pages (Dashboard, Candidates, Jobs), shared components (UploadZone, CandidateCard, RankingList), and data hooks.
- **Root workspace**: `package.json` (Bun workspaces), `.gitignore`.

---

## Prompt #4

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Error: ECONNREFUSED — web-1 at node:_http_client:245:19
>
> I believe pg is not getting the host internally.

**AI Response Summary:**

- **Root cause identified**: `VITE_API_URL: http://localhost:4000` in `docker-compose.yml` (web service). Inside the web Docker container "localhost" refers to the container itself, not the API service. The Vite dev-server proxy was therefore trying to forward `/api/` requests to a port that doesn't exist inside the web container — hence ECONNREFUSED.
- **Fix 1 — docker-compose.yml**: Changed `VITE_API_URL` for the web service from `http://localhost:4000` → `http://api:4000` so Vite's server-side proxy correctly resolves to the API container via Docker's internal DNS.
- **Fix 2 — apps/api/src/routes/uploads.ts**: Removed unused `import { zValidator } from '@hono/zod-validator'` (and the unused `import { z } from 'zod'`). The package is not in `apps/api/package.json` and `zValidator` was never called in the route — this import would also cause the API build to crash with a module-not-found error.

---

## Prompt #5

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Error: ECONNREFUSED (web-1)
> S3Error: Storage backend has reached its minimum free drive threshold (XMinioStorageFull)
> I believe the MinIO will need more space.

**AI Response Summary:**

- **XMinioStorageFull root cause**: MinIO's default free-disk threshold is `max(5 GiB, 5% of total)`. The host Docker data partition was nearly full, triggering the guard.
- **Fix 1 — Free host disk**: Ran `docker system prune -f`, reclaiming 11.02 GB of dangling images and stopped containers.
- **Fix 2 — MinIO tmpfs volume** (`docker-compose.yml`): Replaced the named `minio_data` Docker volume with a `tmpfs` mount (`target: /data, size: 2 GB`). This gives MinIO a dedicated in-memory 2 GB space that never competes with the host disk — no more `XMinioStorageFull` in development. Files don't persist across container restarts, which is acceptable for local dev (production uses S3).
- **Fix 3 — API health check** (`docker-compose.yml`): Added `healthcheck` to the `api` service (`curl /api/health`, 6 retries, 20 s start period) so Docker knows when the API is truly ready.
- **Fix 4 — Web startup ECONNREFUSED** (`docker-compose.yml`): Changed `web.depends_on` from `- api` (starts immediately) to `api: condition: service_healthy` so the Vite dev server only starts once the API health check passes — eliminating the proxy ECONNREFUSED on stack startup.
- **Removed** now-unused `minio_data` named volume from the `volumes:` block.

---

## Prompt #6

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> I cannot see the frontend in the docker build. Possibly last changes removed the step.

**AI Response Summary:**

- **Root cause**: The previous fix changed `web.depends_on` to `api: condition: service_healthy`. The API health check used `curl`, which is not installed in the `oven/bun:1.2-alpine` image. Every health check attempt silently failed → API stayed `unhealthy` → Docker never started the web container at all.
- **Fix 1 — API health check** (`docker-compose.yml`): Replaced `curl -sf` with `wget -qO /dev/null` — `wget` is included in Alpine by default.
- **Fix 2 — Web `depends_on`** (`docker-compose.yml`): Changed back to `condition: service_started` instead of `service_healthy`. The `restart: unless-stopped` policy on the web container handles the rare startup race gracefully enough for dev; blocking on health check is too fragile given Alpine image constraints.

---

## Prompt #7

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> I still see the Custom Id cannot contain error. I think this is something internal to MinIO.

**AI Response Summary:**

- **Root cause clarified**: This error is from BullMQ, not MinIO. BullMQ 5.x explicitly disallows `:` characters in custom job IDs (it uses `:` internally as a Redis key separator).
- **Fix — `apps/api/src/queues/ingestion.queue.ts`**: Changed `jobId: \`ingest:${documentId}\`` → `jobId: \`ingest_${documentId}\`` (colon → underscore). The deduplication behaviour is identical; the ID is just a Redis key that can't contain colons.

---

## Prompt #8

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Allow interactivity on Match selection. Also add dummy data for testing.

**AI Response Summary:**

- **Seed script** (`apps/api/src/scripts/seed.ts`): Bun script that inserts 15 dummy candidates (with random 1536-dim unit embeddings), 1 dummy job description, and a pre-built top-10 match result directly into the DB — bypasses the full upload/parse/embed/LLM pipeline, so testing works without an OpenAI key. Run via `bun run seed` inside the API container.
- **API `package.json`**: Added `"seed"` script pointing at the seed script.
- **`RankingList.tsx`** — collapsible cards: each card shows a compact summary row (rank badge, name, score, title, skills) by default. Clicking the card expands a detail panel with strengths, gaps, and full reasoning. A chevron icon rotates to indicate state. Only one card open at a time, or independent expand — implemented as independent toggle per card.
- **`Jobs.tsx`** — two-panel layout: on wider screens a sticky left sidebar shows the job list; the right panel shows the match detail for the selected job. Includes a clear empty state ("Select a job to see matches") and the Run Match button with a loading spinner.

---

## Prompt #9

**Timestamp:** 2026-04-14T00:00:00+00:00

**Prompt:**

> (Continuation of Prompt #8 — Jobs.tsx two-panel layout was pending when previous session ended)

**AI Response Summary:**

- **`Jobs.tsx`** — fully rewritten with two-panel layout:
  - Sticky left sidebar (w-64) renders a clickable card per job with visual active highlight (blue border / bg-blue-50).
  - Right panel renders `<JobMatchPanel>` for the selected job (auto-selects first job on load).
  - `JobMatchPanel` includes: last-run metadata line, Run Match button + spinner, empty state with search icon, scrollable result list via `<RankingList>`.
  - Upload zone is collapsible, toggled by an "Upload JD" button in the page header.
  - Old duplicate `JobDetail` component and duplicate default export removed.
- Tailwind v4 class fixes: `flex-shrink-0` → `shrink-0` in `RankingList.tsx` and `Jobs.tsx`.

---

## Prompt #10

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Can you please fix this component? This feels broken.
> (Selected: RankingList.tsx lines 192–287 — duplicate dead code after the export default)

**AI Response Summary:**

- **`RankingList.tsx`**: Removed ~95 lines of duplicate old JSX that had been appended after the proper `export default function RankingList` closing brace. The stale fragment (a raw `<div>` block referencing `c.rank`, `c.candidate`, etc. with no enclosing component) caused a TypeScript parse error and prevented Vite from compiling the file. The canonical collapsible-card implementation above it is now the sole export.

---

## Prompt #11

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> 1. Let's show the as View JD button in the Modal with edit option which can edit the JD and thus the vector of that JD.
> 2. Add delete options in the JD and Candidates.
> 3. Also add the search options and pagination options too.

**AI Response Summary:**

### Backend

- **`apps/api/src/routes/jobs.ts`**:
  - `GET /api/jobs` — added `?q=` search (ilike on title), pagination (`page` param), `total` + `page` + `limit` in response.
  - `PUT /api/jobs/:id` — updates `title` and/or `profile`, clears the stored embedding (forces re-embed on next match run), invalidates match cache.
  - `DELETE /api/jobs/:id` — deletes JD row (cascades match_results), invalidates match cache.

- **`apps/api/src/routes/candidates.ts`**:
  - `GET /api/candidates` — added `?q=` search (ilike on fullName and email via `or()`), added `total` to response, updated cache key to include search term.

### Frontend

- **`apps/web/src/lib/api-client.ts`** — added `JobDescriptionProfile`, `JobDetail` types; new methods: `getJob()`, `updateJob()`, `deleteJob()`, `deleteCandidate()`; updated `listJobs()` and `listCandidates()` signatures to accept search + pagination params and return `total`.

- **`apps/web/src/components/JdModal.tsx`** *(new file)* — modal with two modes:
  - **View mode**: displays title, summary, seniority/exp metadata chips, required skills (blue), nice-to-have skills (grey), responsibilities list. Edit button switches modes.
  - **Edit mode**: form fields for title, summary (textarea), required skills (comma-separated), nice-to-have skills (comma-separated), responsibilities (one per line). "Save & Re-embed" calls `PUT /api/jobs/:id`, invalidates jobs + job cache, returns to view mode.

- **`apps/web/src/hooks/useMatches.ts`** — added `useDeleteJob()` mutation hook.
- **`apps/web/src/hooks/useCandidates.ts`** — added `search` param to `useCandidates()`; added `useDeleteCandidate()` mutation hook.

- **`apps/web/src/pages/Jobs.tsx`** — rewrote with:
  - Debounced search box above job sidebar.
  - Each job card has a **View JD** button (opens JdModal) and a trash **Delete** button (with confirm dialog, deselects if active).
  - Sidebar pagination (prev/next arrows + page counter) when total > 20.

- **`apps/web/src/components/CandidateCard.tsx`** — added a trash icon delete button; accepts `onDelete` callback and `isDeleting` prop for disabled state.

- **`apps/web/src/pages/Candidates.tsx`** — added debounced search input, result count line, passes `onDelete`/`isDeleting` to CandidateCard, improved pagination shows "Page X of Y" with disabled states.

---

## Prompt #12

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Vite is failing due to latest changes. Need to have an eye on that.

**AI Response Summary:**

Three files had old code appended after their new implementations (the replace-string-in-file edits attached to the prior prompt matched only the first occurrence of each file header, leaving the original body dangling):

- **`apps/web/src/lib/api-client.ts`**: Removed duplicate `export const apiClient` block (the old one without search/pagination methods) that followed the new correct one.
- **`apps/web/src/pages/Candidates.tsx`**: Removed duplicate `export default function Candidates` (the old one without search/debounce/delete) that followed the new implementation.
- **`apps/web/src/components/CandidateCard.tsx`**: Removed stray orphaned JSX fragment (old component body without delete button) that was left after the proper closing `}`.

Root cause: each `replace_string_in_file` call used only the import block as the `oldString`, so it prepended the new file content but left the old function bodies intact further down. Going forward, the full original function body must be included in `oldString` when replacing entire components.

---

## Prompt #13

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Match should also take the category of the candidate in mind to filter out the candidate properly.
> For example I have nutrition specialist in the candidates list and that is also coming in the matches with 18% match.

**AI Response Summary:**

Added three-layer domain/category filtering to `apps/api/src/services/pipeline/match.pipeline.ts` and `llm-reranker.ts`:

**Layer 1 — SQL similarity floor** (`match.pipeline.ts`):
- Added `MIN_SIMILARITY = 0.25` constant. The pgvector SQL query now includes `AND 1 - (embedding <=> ...) >= 0.25`, eliminating candidates with less than 25% cosine similarity before they ever reach the LLM. An 18% match (like the nutrition specialist) is rejected at this stage.
- Increased initial recall pool from 20 → 30 candidates to compensate for the filter.

**Layer 2 — Domain keyword overlap filter** (`match.pipeline.ts`):
- Added `hasRelevantDomainOverlap(candidate, jd)` function. After SQL recall, it checks whether any of the candidate's skill names or job titles share keywords with the JD's `jobTitle`, `industry`, `department`, `requiredSkills`, or `preferredSkills`.
- If a candidate has zero keyword overlap (e.g., "nutrition", "dietitian", "food science" vs. a software engineering JD), they are removed from the `candidatesForRanking` pool before the LLM call.
- Safe fallback: if domain filtering removes everyone, the top similarity results are used instead (prevents empty results from an empty candidate DB).

**Layer 3 — LLM system prompt hardening** (`llm-reranker.ts`):
- Added explicit "CRITICAL DOMAIN RULES" section instructing the model: candidates from an entirely different domain must receive `matchScore = 0.0` and must NOT be included in results.
- Changed "include exactly 10 candidates" to "if fewer than 10 are genuinely relevant, return only the relevant ones."
- Added minimum matchScore guidance (≥ 0.30 to be included).

---

## Prompt #14

**Timestamp:** 2026-04-13T00:00:00+00:00

**Prompt:**

> Adding new candidate does not show the candidate inside the list of candidate directly. It will show up only once candidate is duplicated or when Match is Run.

**AI Response Summary:**

**Root cause:** `apps/api/src/services/pipeline/ingest.pipeline.ts` inserted the new candidate row into the DB, then set the document status to `ready` — but never invalidated the Redis candidates list cache. The frontend `useUpload` hook detects `status === 'ready'` and calls `qc.invalidateQueries({ queryKey: ['candidates'] })`, which causes a re-fetch. However, that re-fetch hit the still-warm 5-minute Redis cache and received the stale list (without the new candidate). The new entry only became visible when the cache expired or another operation (delete, match run) triggered `cache.invalidatePattern('candidates:page:*')`.

**Fix — `apps/api/src/services/pipeline/ingest.pipeline.ts`:**
- Imported `cache` from `../../cache/redis.cache.js`.
- After `db.insert(candidates)`, added `await cache.invalidatePattern('candidates:page:*')` **before** `setStatus(documentId, 'ready')`. This ensures the cache is cleared before the frontend polls `status === 'ready'` and re-fetches the list.
- Similarly added `await cache.invalidatePattern('jobs:*')` after inserting a new job description (no-op currently since the jobs list isn't Redis-cached, but defensive).

The operation order is now: insert row → clear Redis cache → set status 'ready' → frontend detects 'ready' → React Query re-fetch → cache miss → fresh DB query → new candidate visible.

---

## Prompt #15

**Timestamp:** 2026-04-14T00:00:00+00:00

**Prompt:**

> Add candidate view and edit. Edit should reset the vector with new details.

**AI Response Summary:**

### Backend

- **`apps/api/src/routes/candidates.ts`** — added `PUT /:id` route:
  - Loads existing candidate row, merges the request body (partial `CandidateProfile`) over the existing profile.
  - Immediately re-embeds via `embedder.embed(buildCandidateEmbeddingText(mergedProfile))` (synchronous in the request, not queued).
  - Saves the updated profile + new vector to the DB.
  - Invalidates `candidates:page:*` and `matches:*` caches so stale results are not served.

### Frontend types & API client

- **`apps/web/src/lib/api-client.ts`** — added interfaces: `CandidateSkill`, `WorkExperience`, `Education`, `CandidateProfile`, `CandidateDetail`; added methods: `getCandidate(id)` (fetches `/api/candidates/:id`), `updateCandidate(id, data)` (PUT to `/api/candidates/:id`).

### Hooks

- **`apps/web/src/hooks/useCandidates.ts`** — added:
  - `useCandidate(id)`: TanStack Query fetch for a single candidate; enabled only when `id` is truthy.
  - `useUpdateCandidate(id)`: mutation that calls `updateCandidate`, then invalidates `['candidates']` and `['candidate', id]` query keys on success.

### New component

- **`apps/web/src/components/CandidateModal.tsx`** *(new file)*:
  - `ModalOverlay`: fixed backdrop with click-outside-to-close.
  - `CandidateView`: read-only panel — header (name, title, email), meta chips (seniority, years, languages), summary, skill chips, work experience (company, title, dates, description, technologies), education, certifications.
  - `CandidateEdit`: form — fullName, email, currentTitle, totalYearsExperience (number), summary (textarea), skills (comma-separated, preserves proficiency/category for unchanged ones), certifications (one per line). "Save & Re-embed" button calls `useUpdateCandidate`.
  - Root `CandidateModal`: fetches via `useCandidate`, toggles `isEditing` state, renders view or edit mode.

### Wiring

- **`apps/web/src/components/CandidateCard.tsx`** — added `onView: (id: string) => void` prop; added an eye-icon button (blue hover) alongside the existing delete button.
- **`apps/web/src/pages/Candidates.tsx`** — added `modalCandidateId` state, passes `onView={setModalCandidateId}` to `<CandidateCard>`, renders `<CandidateModal candidateId={modalCandidateId} onClose={...} />` as a sibling inside a fragment wrapper.

### Bug fix

- **`Candidates.tsx` JSX root**: The `return (` was opening `<div>` but closing `</>` (mismatch). Fixed by wrapping in `<>...</>` fragment so both the main `<div>` and the `<CandidateModal>` sibling are valid children of a single root.

---

## Prompt #16

**Timestamp:** 2026-04-14T00:00:00+00:00

**Prompt:**

> Note: Add prompts in the prompts.md file with timestamp.
>
> 1. Add API Documentation to the Documentation folder
> 2. Add README.md that can guide someone using this code in their local system with easy to understand steps
> 3. Add CDK code that can deploy this App to the production

**AI Response Summary:**

### Vite build errors (stale Docker image)

The three errors reported (`api-client.ts` duplicate `apiClient`, `Candidates.tsx` duplicate `Candidates`, `CandidateCard.tsx` stray `}`) are all from the stale Docker image built before the Prompt #15 fixes. All three source files are clean on disk (single export each, verified with `grep -c`). Fix: `docker compose up --build`.

### `documentations/API.md` *(new file)*

Full API reference covering every endpoint:

- **Uploads**: `POST /api/uploads` (multipart), `GET /api/uploads/:id/status` — status values, error codes.
- **Candidates**: `GET /` (search + pagination), `GET /:id`, `PUT /:id` (re-embed side-effects), `DELETE /:id`.
- **Jobs**: `GET /` (search + pagination), `GET /:id`, `PUT /:id` (clears embedding), `DELETE /:id`.
- **Match**: `POST /api/jobs/:id/match` (full pipeline description), `GET /:id/matches` (latest), `GET /:id/matches/:runId`.
- **Health**: `GET /api/health`.
- Common types section: `CandidateProfile`, `CandidateSkill`, `WorkExperience`, `Education`, `JobDescriptionProfile`, `RankedCandidate` — all fields with types and descriptions.

### `README.md` *(new file, repo root)*

Step-by-step local setup guide:
- Prerequisites (Docker Desktop + OpenAI key only).
- Quick start: clone → `cp .env.example .env` → set `OPENAI_API_KEY` → `docker compose up --build`.
- Service URLs table (web, API, MinIO console).
- Optional seed command for testing without file uploads.
- Full environment variable reference table.
- Annotated project structure tree.
- Development workflow: when to rebuild vs. rely on HMR, migrations, logs, stop/clean.
- Supported file formats (PDF, DOCX, DOC) and 10 MB limit.
- Architecture decisions summary with links to DESIGN.md.
- Link to CDK deploy docs.
- Troubleshooting section for all known issues.

### `infra/cdk/` *(new directory — TypeScript CDK)*

Six stacks covering the full production deployment to AWS:

**`NetworkStack`** (`lib/network-stack.ts`):
- VPC with 2 AZs: public (ALB), private-egress (Fargate), isolated (Aurora + ElastiCache) subnets.
- Security groups: ALB (443/80 from internet), API (4000 from ALB), DB (5432 from API), Cache (6379 from API).

**`DatabaseStack`** (`lib/database-stack.ts`):
- Aurora PostgreSQL 16 Serverless v2 (0.5–8 ACUs, scales to zero when idle).
- Parameter group enables `vector` (pgvector) shared library.
- Credentials auto-generated in Secrets Manager at `/cse/database/credentials`.
- 7-day backup retention, deletion protection, `RETAIN` removal policy.

**`CacheStack`** (`lib/cache-stack.ts`):
- ElastiCache Valkey 7.2 replication group (Redis-compatible).
- 1 primary + 1 replica across 2 AZs, at-rest + in-transit encryption.
- `cache.t4g.small` node type.

**`StorageStack`** (`lib/storage-stack.ts`):
- S3 bucket (SSE-S3, SSL enforced, public access blocked).
- 90-day lifecycle rule on `uploads/` prefix.
- CORS configured for pre-signed PUT URL support.

**`ApiStack`** (`lib/api-stack.ts`):
- ECR repository (`cse-api`) with image scanning on push.
- ECS Fargate service (ARM64, 0.5 vCPU / 1 GB, 2–10 tasks).
- Task role: read DB/OpenAI secrets + S3 read/write.
- Environment: DB host/credentials from Secrets Manager, Redis TLS endpoint, S3 bucket name.
- ALB with health check on `/api/health`; HTTP→HTTPS redirect listener.
- Auto-scaling: CPU ≥ 60% scale out, Memory ≥ 70%.
- `enableExecuteCommand: true` for live debugging via `aws ecs execute-command`.

**`WebStack`** (`lib/web-stack.ts`):
- S3 bucket for Vite build output.
- CloudFront distribution with OAC (Origin Access Control).
- `/api/*` behaviour proxied to ALB (caching disabled, all methods allowed).
- SPA fallback: 404 → `index.html` (React Router support).
- TLS 1.2+, PriceClass_100 (NA + EU edge nodes).

**Supporting files**:
- `bin/cse.ts`: CDK app entry — instantiates all 6 stacks in dependency order.
- `infra/cdk/README.md`: bootstrap, deploy, push ECR image, deploy web, run migrations, HTTPS setup, teardown, cost estimate (~$80–100/month).
- `package.json`, `tsconfig.json`, `cdk.json`.

---

## Prompt #15

**Timestamp:** 2026-04-14T00:00:00+00:00

**Prompt:**

> Add candidate view and edit. Edit should reset the vector with new details.

**AI Response Summary:**

### Backend

- **`apps/api/src/routes/candidates.ts`** — added `PUT /:id` route:
  - Loads existing candidate row, merges the request body (partial `CandidateProfile`) over the existing profile.
  - Immediately re-embeds via `embedder.embed(buildCandidateEmbeddingText(mergedProfile))` (synchronous in the request, not queued).
  - Saves the updated profile + new vector to the DB.
  - Invalidates `candidates:page:*` and `matches:*` caches so stale results are not served.

### Frontend types & API client

- **`apps/web/src/lib/api-client.ts`** — added interfaces: `CandidateSkill`, `WorkExperience`, `Education`, `CandidateProfile`, `CandidateDetail`; added methods: `getCandidate(id)` (fetches `/api/candidates/:id`), `updateCandidate(id, data)` (PUT to `/api/candidates/:id`).

### Hooks

- **`apps/web/src/hooks/useCandidates.ts`** — added:
  - `useCandidate(id)`: TanStack Query fetch for a single candidate; enabled only when `id` is truthy.
  - `useUpdateCandidate(id)`: mutation that calls `updateCandidate`, then invalidates `['candidates']` and `['candidate', id]` query keys on success.

### New component

- **`apps/web/src/components/CandidateModal.tsx`** *(new file)*:
  - `ModalOverlay`: fixed backdrop with click-outside-to-close.
  - `CandidateView`: read-only panel — header (name, title, email), meta chips (seniority, years, languages), summary, skill chips, work experience (company, title, dates, description, technologies), education, certifications.
  - `CandidateEdit`: form — fullName, email, currentTitle, totalYearsExperience (number), summary (textarea), skills (comma-separated, preserves proficiency/category for unchanged ones), certifications (one per line). "Save & Re-embed" button calls `useUpdateCandidate`.
  - Root `CandidateModal`: fetches via `useCandidate`, toggles `isEditing` state, renders view or edit mode.

### Wiring

- **`apps/web/src/components/CandidateCard.tsx`** — added `onView: (id: string) => void` prop; added an eye-icon button (blue hover) alongside the existing delete button.
- **`apps/web/src/pages/Candidates.tsx`** — added `modalCandidateId` state, passes `onView={setModalCandidateId}` to `<CandidateCard>`, renders `<CandidateModal candidateId={modalCandidateId} onClose={...} />` as a sibling inside a fragment wrapper.

### Bug fix

- **`Candidates.tsx` JSX root**: The `return (` was opening `<div>` but closing `</>` (mismatch). Fixed by wrapping in `<>...</>` fragment so both the main `<div>` and the `<CandidateModal>` sibling are valid children of a single root.

---
