# Candidate Suggestion Engine

A Dockerised AI-powered recruitment tool that parses resumes and job descriptions, builds semantic embeddings, and returns the top 10 best-matched candidates for any given role.

**Stack:** Bun · TypeScript · Hono · React 19 · Vite · TailwindCSS v4 · PostgreSQL + pgvector · Redis · MinIO · BullMQ · OpenAI GPT-4o

---

## How it works

```
Upload resume/JD → MinIO storage → BullMQ queue → Parse (PDF/DOCX)
  → OpenAI extract structured profile → text-embedding-3-small vector
  → pgvector store → cosine similarity recall → domain filter
  → GPT-4o re-rank → Top 10 ranked candidates
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Docker Desktop | ≥ 4.x |
| Docker Compose | ≥ 2.x (bundled with Desktop) |
| OpenAI API key | Any tier (GPT-4o + embeddings) |

No Node, Bun, or Python needed locally — everything runs inside Docker.

---

## Quick start

### 1. Clone and configure

```bash
git clone <repo-url>
cd candidate-suggestion-engine
cp .env.example .env
```

Open `.env` and set your OpenAI key:

```env
OPENAI_API_KEY=sk-...
```

That is the only required change. All other values have working defaults.

### 2. Build and run

```bash
docker compose up --build
```

First build takes 2–4 minutes (downloads base images, installs dependencies). Subsequent starts are much faster.

| Service   | URL                          |
|-----------|------------------------------|
| Web UI    | http://localhost:3000        |
| API       | http://localhost:4000/api    |
| MinIO console | http://localhost:9001    |

Credentials for MinIO console: `minioadmin` / `minioadmin123`

### 3. (Optional) Seed dummy data

Skip OpenAI entirely and load 15 sample candidates + 1 job description with pre-built matches:

```bash
docker compose exec api bun run seed
```

### 4. Use the app

1. Go to **http://localhost:3000**
2. Open the **Jobs** page and upload a job description (PDF or DOCX)
3. Open the **Candidates** page and upload one or more resumes
4. Back on **Jobs**, click **Run Match** to see ranked candidates
5. Click any candidate card to view or edit their profile

---

## Environment variables

All variables are in `.env.example`. The only one you must set is `OPENAI_API_KEY`.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | **Required.** OpenAI secret key |
| `OPENAI_MODEL` | `gpt-4o` | LLM for extraction and re-ranking |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model (1536 dims) |
| `DATABASE_URL` | set by compose | PostgreSQL connection string |
| `REDIS_URL` | set by compose | Redis connection URL |
| `MINIO_ENDPOINT` | `minio` | MinIO host (Docker service name) |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin123` | MinIO secret key |
| `MINIO_BUCKET` | `candidate-engine` | Bucket name |
| `PORT` | `4000` | API listen port |
| `VITE_API_URL` | `http://api:4000` | Used by Vite dev proxy (internal) |

---

## Project structure

```
candidate-suggestion-engine/
├── apps/
│   ├── api/                  Hono API (Bun runtime)
│   │   └── src/
│   │       ├── db/           Drizzle ORM schema + client
│   │       ├── queues/       BullMQ ingestion queue
│   │       ├── routes/       uploads · candidates · jobs
│   │       ├── scripts/      seed.ts
│   │       ├── services/
│   │       │   ├── cache/    Redis cache abstraction
│   │       │   ├── embeddings/ OpenAI embedder
│   │       │   ├── extraction/ GPT-4o profile extractor
│   │       │   ├── parsers/  PDF + DOCX parsers
│   │       │   ├── pipeline/ ingest · match pipelines
│   │       │   ├── ranking/  LLM re-ranker
│   │       │   └── storage/  MinIO abstraction
│   │       └── types/        Shared TypeScript types
│   └── web/                  React + Vite frontend
│       └── src/
│           ├── components/   CandidateCard · CandidateModal · JdModal · RankingList · UploadZone
│           ├── hooks/        useCandidates · useMatches · useUpload
│           ├── lib/          api-client.ts
│           └── pages/        Candidates · Jobs · Dashboard
├── docker/
│   └── postgres/init.sql     Enables pgvector + uuid-ossp
├── documentations/
│   ├── API.md                Full API reference
│   ├── DESIGN.md             Architecture + production design decisions
│   └── prompts.md            Development session log
├── infra/
│   └── cdk/                  AWS CDK production stacks
├── docker-compose.yml
└── .env.example
```

---

## Development workflow

### Rebuild after code changes

The `apps/api/src` and `apps/web/src` directories are volume-mounted read-only into their containers. For source file edits the Vite HMR / Bun file-watcher picks them up without a full rebuild.

Rebuild is required when you change:
- `package.json` (any workspace)
- `Dockerfile`
- `docker-compose.yml`

```bash
docker compose up --build
```

### Run database migrations

Drizzle auto-pushes schema on API startup in development (`drizzle-kit push`). For production use the `migrate` script:

```bash
docker compose exec api bun run migrate
```

### Logs

```bash
# all services
docker compose logs -f

# single service
docker compose logs -f api
docker compose logs -f web
```

### Stop

```bash
docker compose down          # keep volumes (data preserved)
docker compose down -v       # destroy volumes (clean slate)
```

---

## Supported file formats

| Format | Extension | MIME type |
|--------|-----------|-----------|
| PDF    | `.pdf`    | `application/pdf` |
| Word   | `.docx`   | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Word (legacy) | `.doc` | `application/msword` |

Maximum file size: **10 MB**

---

## Architecture decisions

See [documentations/DESIGN.md](documentations/DESIGN.md) for the full ADR-style write-up. Key choices:

- **PostgreSQL + pgvector** over a dedicated vector DB — avoids an extra service; maps 1-to-1 to RDS Aurora in production.
- **BullMQ** for ingestion — decouples HTTP response from the slow parse/embed pipeline (~3–10 s per file).
- **Two-stage matching** — dense vector recall (fast, approximate) followed by GPT-4o re-ranking (accurate, expensive) on a small shortlist.
- **MinIO tmpfs in dev** — dev parity with S3 without consuming host disk space.

---

## Deploying to AWS

The `infra/cdk/` directory contains CDK stacks that provision the full production environment on AWS:

| Stack | Resources |
|-------|-----------|
| `NetworkStack` | VPC, subnets, NAT Gateway, security groups |
| `DatabaseStack` | RDS Aurora PostgreSQL Serverless v2 + pgvector |
| `CacheStack` | ElastiCache Redis (Valkey) cluster |
| `StorageStack` | S3 bucket + IAM policies |
| `ApiStack` | ECS Fargate service + ALB + ECR |
| `WebStack` | S3 static hosting + CloudFront distribution |

See [infra/cdk/README.md](infra/cdk/README.md) for deployment steps.

---

## API reference

See [documentations/API.md](documentations/API.md) for the full endpoint reference.

---

## Troubleshooting

### Vite build errors (duplicate exports)

The Docker image is stale from before source fixes. Rebuild:

```bash
docker compose down && docker compose up --build
```

### MinIO `XMinioStorageFull`

Run `docker system prune -f` to reclaim disk, then restart. MinIO is configured with a 2 GB in-memory tmpfs and should not hit host disk.

### New candidate doesn't appear after upload

The ingestion pipeline invalidates the Redis list cache before setting `status=ready`, so this should not happen. If it does, wait 5 minutes for cache TTL expiry or restart the stack.

### `PUT /candidates/:id` returns 500

The profile was saved but re-embedding failed (OpenAI API error). Check the API logs with `docker compose logs api`. Retry once the OpenAI service recovers — the stored vector is the previous one until a successful re-embed.

### OpenAI rate limits

All OpenAI calls are in the background worker (BullMQ). If a job fails due to rate limiting it is retried automatically up to 3 times with exponential back-off.
