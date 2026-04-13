# Candidate Suggestion Engine — DESIGN.md

> **Document Version:** 1.0.0  
> **Date:** April 13, 2026  
> **Status:** Architectural Design & Implementation Blueprint

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Answering Key Design Questions](#2-answering-key-design-questions)
3. [Tech Stack & Rationale](#3-tech-stack--rationale)
4. [Project Structure](#4-project-structure)
5. [System Architecture](#5-system-architecture)
6. [File Format Handling](#6-file-format-handling)
7. [Data Pipeline — Full Flow](#7-data-pipeline--full-flow)
8. [RAG System with pgvector](#8-rag-system-with-pgvector)
9. [Cold Start Accuracy Strategy](#9-cold-start-accuracy-strategy)
10. [Queue Mechanism](#10-queue-mechanism)
11. [Caching Strategy](#11-caching-strategy)
12. [Local vs Production Architecture](#12-local-vs-production-architecture)
13. [Database Design & Migration Path](#13-database-design--migration-path)
14. [AWS CDK Infrastructure](#14-aws-cdk-infrastructure)
15. [API Design](#15-api-design)
16. [Frontend Design](#16-frontend-design)
17. [End-to-End Testing Strategy](#17-end-to-end-testing-strategy)
18. [Security Considerations](#18-security-considerations)
19. [Performance & Scalability](#19-performance--scalability)
20. [Sequence Diagrams](#20-sequence-diagrams)

---

## 1. Executive Summary

The **Candidate Suggestion Engine** is a full-stack, Dockerised application that ingests resumes and job descriptions (JDs) in multiple file formats (PDF, DOCX, and extensible to others), processes them through a structured AI pipeline, and returns the **Top 10 best-matched candidates** for any given job role.

### Core Capabilities

| Capability | Local (Dev) | Production |
|---|---|---|
| Document Parsing | pdf-parse, mammoth | Same (container-based) |
| Structured Extraction | OpenAI GPT-4o | OpenAI GPT-4o / self-hosted |
| Vector Embeddings | OpenAI text-embedding-3-small | OpenAI / Bedrock Titan |
| Vector Store | PostgreSQL + pgvector (Docker) | RDS Aurora PostgreSQL (pgvector) |
| Relational Data | PostgreSQL (Docker) | RDS Aurora PostgreSQL |
| Queue | BullMQ + Redis (Docker) | AWS SQS + ECS Workers |
| Cache | Redis (Docker) | AWS ElastiCache (Redis) |
| Object Storage | Local filesystem / MinIO | AWS S3 |
| Infrastructure | Docker Compose | AWS CDK (ECS Fargate, ALB, RDS, SQS) |

### Design Philosophy

- **Semantic-first matching**: No historical training data required. Matches are derived from the semantic meaning of resumes and JDs via LLM embeddings — not keyword frequency or collaborative filtering.
- **RAG-native pipeline**: The system is architecturally a Retrieval-Augmented Generation (RAG) system. pgvector powers retrieval; OpenAI powers generation (scoring rationale and ranked output).
- **Strategy-pattern parsers**: File format handling is fully extensible via a parser registry — adding a new format requires implementing one interface, not changing the pipeline.
- **Swap-friendly infrastructure**: Every local component (Redis, Postgres, MinIO) maps 1:1 to an AWS managed equivalent, ensuring zero-friction promotion to production.

---

## 2. Answering Key Design Questions

### Q1 — Can we use pgvector with OpenAI to suggest top 10 candidates?

**Yes — this is the recommended approach and is exactly what this system implements.**

Here is the reasoning:

1. **Resume parsing** (PDF/DOCX → raw text) happens via local parsers.
2. **Structured extraction** uses OpenAI GPT-4o (via function-calling / structured output) to extract: skills, years of experience, education, certifications, job titles, etc.
3. **Embedding** uses OpenAI `text-embedding-3-small` to produce a 1536-dimensional float vector representing each candidate's semantic profile.
4. **pgvector** stores these vectors in PostgreSQL using the `vector` column type. It supports cosine distance (`<=>`) queries natively.
5. When a **Job Description** is submitted:
   - The JD is similarly parsed and embedded.
   - pgvector performs a nearest-neighbour cosine similarity search across all candidate vectors.
   - Top-K candidates (e.g., top 20) are retrieved.
6. **LLM re-ranking**: The top-K raw vector matches are sent to GPT-4o with the full JD context. GPT-4o re-ranks them to top 10  and provides a scored rationale for each.

> **This is a RAG system**: pgvector = Retrieval, OpenAI GPT-4o = Generation. The JD is the query, candidate profiles are the knowledge base.

---

### Q2 — Can we build a local RAG system using pgvector?

**Yes — we build a fully local RAG system using Docker.**

The local stack runs entirely in Docker Compose:

```
PostgreSQL 16 + pgvector extension  →  vector store + relational data
Redis                               →  BullMQ queue + result cache
MinIO (S3-compatible)               →  raw file storage
API (Bun + Node.js)                 →  pipeline orchestrator
Web (React + Vite)                  →  UI
```

The **only external dependency** is the OpenAI API key for embeddings and re-ranking. Everything else — storage, queuing, caching, the vector database — runs locally in Docker.

> **Future consideration**: For a fully offline/private RAG system, the OpenAI calls can be swapped for a self-hosted model (e.g., Ollama + `nomic-embed-text` for embeddings, `llama3` for extraction/re-ranking). The interfaces are designed with this substitution in mind via an `LLMProvider` abstraction.

---

## 3. Tech Stack & Rationale

### Runtime & Language

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | **Bun** | Fast TypeScript execution, built-in bundler, native file APIs, drop-in Node.js replacement |
| Language | **TypeScript** | Type safety across entire stack; shared types between API and Web |
| Package Manager | **Bun** | Single tool for install, run, test, bundle |

### Backend

| Layer | Technology | Rationale |
|---|---|---|
| HTTP Server | **Hono** (on Bun) | Lightweight, Bun-native, edge-ready, typed routes |
| File Parsing | **pdf-parse**, **mammoth** | Battle-tested PDF/DOCX parsers; easy to invoke in Bun |
| LLM | **OpenAI SDK** | GPT-4o for extraction, `text-embedding-3-small` for vectors |
| Queue | **BullMQ** | Redis-backed job queue; SQS-compatible API boundary |
| ORM/Query Builder | **Drizzle ORM** | Lightweight, TypeScript-native, schema-first, easy migrations |
| Validation | **Zod** | Schema validation at API boundaries; shared with frontend |

### Frontend

| Layer | Technology | Rationale |
|---|---|---|
| UI Framework | **React 19** | Component model, hooks ecosystem |
| Build Tool | **Vite** | Instant HMR, Bun-compatible, optimised production builds |
| Styling | **TailwindCSS v4** | Utility-first, consistent design tokens, zero dead CSS |
| State Management | **TanStack Query** | Server-state, cache invalidation, optimistic updates |
| File Upload | **react-dropzone** | Accessible, drag-and-drop, multi-format |

### Infrastructure & DevOps

| Layer | Technology | Rationale |
|---|---|---|
| Containerisation | **Docker + Docker Compose** | Reproducible local env; maps to ECS in prod |
| IaC | **AWS CDK** (TypeScript) | Type-safe infra; same language as app code |
| E2E Testing | **Playwright** | Cross-browser, headless, robust selector engine |
| CI | **GitHub Actions** | Bun-native, Docker layer caching, Playwright sharding |

---

## 4. Project Structure

```
candidate-suggestion-engine/
│
├── apps/
│   ├── api/                           # Bun + Hono + TypeScript backend
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point (Hono app)
│   │   │   ├── routes/
│   │   │   │   ├── candidates.ts      # POST /candidates, GET /candidates
│   │   │   │   ├── jobs.ts            # POST /jobs, GET /jobs/:id/matches
│   │   │   │   └── uploads.ts         # POST /uploads (multipart)
│   │   │   ├── services/
│   │   │   │   ├── parsers/
│   │   │   │   │   ├── index.ts       # Parser registry (strategy pattern)
│   │   │   │   │   ├── pdf.parser.ts
│   │   │   │   │   ├── docx.parser.ts
│   │   │   │   │   └── base.parser.ts # IDocumentParser interface
│   │   │   │   ├── extractor/
│   │   │   │   │   └── llm-extractor.ts   # OpenAI structured extraction
│   │   │   │   ├── embeddings/
│   │   │   │   │   ├── index.ts           # IEmbeddingProvider interface
│   │   │   │   │   └── openai.embedder.ts # OpenAI embedding implementation
│   │   │   │   ├── pipeline/
│   │   │   │   │   ├── ingest.pipeline.ts # Full ingestion orchestrator
│   │   │   │   │   └── match.pipeline.ts  # JD → top 10 candidates
│   │   │   │   ├── ranking/
│   │   │   │   │   └── llm-reranker.ts    # GPT-4o re-ranking
│   │   │   │   └── storage/
│   │   │   │       ├── index.ts           # IStorageProvider interface
│   │   │   │       └── local.storage.ts   # Local / MinIO implementation
│   │   │   ├── queues/
│   │   │   │   ├── index.ts               # BullMQ setup
│   │   │   │   ├── ingestion.queue.ts     # Resume ingestion jobs
│   │   │   │   └── workers/
│   │   │   │       └── ingestion.worker.ts
│   │   │   ├── cache/
│   │   │   │   └── redis.cache.ts         # Redis cache wrapper
│   │   │   ├── db/
│   │   │   │   ├── index.ts               # Drizzle client
│   │   │   │   ├── schema.ts              # Table definitions
│   │   │   │   └── migrations/            # Drizzle migration files
│   │   │   ├── lib/
│   │   │   │   ├── openai.ts              # OpenAI client singleton
│   │   │   │   └── env.ts                 # Zod env validation
│   │   │   └── types/
│   │   │       └── shared.ts              # Shared types (also used by web)
│   │   ├── Dockerfile
│   │   ├── bunfig.toml
│   │   └── package.json
│   │
│   └── web/                           # React + Vite + TailwindCSS frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── ui/                # Base UI primitives
│       │   │   ├── CandidateCard.tsx
│       │   │   ├── JobForm.tsx
│       │   │   ├── UploadZone.tsx
│       │   │   ├── RankingList.tsx
│       │   │   └── PipelineStatus.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Candidates.tsx
│       │   │   └── Jobs.tsx
│       │   ├── hooks/
│       │   │   ├── useCandidates.ts
│       │   │   ├── useMatches.ts
│       │   │   └── useUpload.ts
│       │   └── lib/
│       │       ├── api-client.ts      # Typed fetch wrapper
│       │       └── query-client.ts    # TanStack Query setup
│       ├── e2e/                       # Playwright tests
│       │   ├── fixtures/
│       │   │   ├── sample.pdf
│       │   │   └── sample.docx
│       │   ├── upload.spec.ts
│       │   ├── matching.spec.ts
│       │   └── top10.spec.ts
│       ├── Dockerfile
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── playwright.config.ts
│       └── package.json
│
├── infra/
│   └── cdk/                           # AWS CDK TypeScript stacks
│       ├── bin/
│       │   └── app.ts
│       ├── lib/
│       │   ├── network-stack.ts       # VPC, subnets, security groups
│       │   ├── database-stack.ts      # RDS Aurora PostgreSQL + pgvector
│       │   ├── cache-stack.ts         # ElastiCache Redis
│       │   ├── queue-stack.ts         # SQS queues + DLQ
│       │   ├── storage-stack.ts       # S3 bucket + lifecycle
│       │   ├── api-stack.ts           # ECS Fargate service (API)
│       │   └── web-stack.ts           # CloudFront + S3 (Web) or ECS
│       ├── cdk.json
│       └── package.json
│
├── docker/
│   └── postgres/
│       └── init.sql                   # pgvector extension + seed schema
│
├── docker-compose.yml                 # Full local dev stack
├── docker-compose.test.yml            # E2E test stack
├── .env.example
├── DESIGN.md                          # This document
├── prompts.md
└── package.json                       # Workspace root (bun workspaces)
```

---

## 5. System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Docker Compose (Local)                      │
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────────────┐ │
│  │  Web (React) │─────▶│  API (Hono)  │─────▶│  PostgreSQL 16     │ │
│  │  :3000       │  HTTP│  :4000       │  SQL  │  + pgvector        │ │
│  └──────────────┘      └──────┬───────┘      │  :5432             │ │
│                               │              └────────────────────┘ │
│                               │                                      │
│                    ┌──────────┼──────────┐                          │
│                    │          │          │                           │
│                    ▼          ▼          ▼                           │
│             ┌────────────┐ ┌──────┐ ┌────────┐                      │
│             │   BullMQ   │ │Redis │ │ MinIO  │                      │
│             │   Workers  │ │Cache │ │ :9000  │                      │
│             │            │ │:6379 │ │        │                      │
│             └────────────┘ └──────┘ └────────┘                      │
│                                                                      │
│                    ┌─────────────────────┐                          │
│                    │   OpenAI API        │  (External)              │
│                    │  • GPT-4o           │                          │
│                    │  • text-embedding-  │                          │
│                    │    3-small          │                          │
│                    └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Production Architecture (AWS)

```
Internet
   │
   ▼
CloudFront CDN
   │
   ├──▶ S3 (Static Web Assets)
   │
   └──▶ Application Load Balancer
              │
              ▼
         ECS Fargate (API)
         Auto Scaling Group
              │
    ┌─────────┼────────────┐
    │         │            │
    ▼         ▼            ▼
RDS Aurora  ElastiCache  S3 Bucket
PostgreSQL  Redis         (Raw Files)
(pgvector)  Cluster
    │
    │    SQS Queue
    │    (Ingestion)
    │         │
    │         ▼
    │    ECS Fargate
    │    (Workers)
    │         │
    └─────────┘
              │
              ▼
         OpenAI API
         (Embeddings + GPT-4o)
```

---

## 6. File Format Handling

### Parser Strategy Pattern

The parser layer uses the **Strategy pattern** with a central **Parser Registry**. Adding a new format requires implementing one interface — the pipeline is never touched.

```typescript
// apps/api/src/services/parsers/base.parser.ts

export interface ParsedDocument {
  rawText: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    format: string;
    filename: string;
    extractedAt: Date;
  };
}

export interface IDocumentParser {
  /**  The MIME types and extensions this parser supports */
  readonly supportedTypes: string[];
  parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument>;
}
```

```typescript
// apps/api/src/services/parsers/index.ts  — Parser Registry

import { PdfParser } from './pdf.parser';
import { DocxParser } from './docx.parser';

class ParserRegistry {
  private parsers: Map<string, IDocumentParser> = new Map();

  register(parser: IDocumentParser) {
    for (const type of parser.supportedTypes) {
      this.parsers.set(type.toLowerCase(), parser);
    }
  }

  getParser(mimeType: string, extension: string): IDocumentParser {
    const parser = this.parsers.get(mimeType) ?? this.parsers.get(extension);
    if (!parser) throw new UnsupportedFormatError(`No parser for: ${mimeType}`);
    return parser;
  }
}

export const parserRegistry = new ParserRegistry();
parserRegistry.register(new PdfParser());
parserRegistry.register(new DocxParser());
// Future: parserRegistry.register(new HtmlParser());
// Future: parserRegistry.register(new TxtParser());
// Future: parserRegistry.register(new OdtParser());
```

### PDF Parser Implementation

```typescript
// apps/api/src/services/parsers/pdf.parser.ts
import pdfParse from 'pdf-parse';

export class PdfParser implements IDocumentParser {
  readonly supportedTypes = ['application/pdf', '.pdf'];

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await pdfParse(fileBuffer);
    return {
      rawText: result.text.trim(),
      metadata: {
        pageCount: result.numpages,
        wordCount: result.text.split(/\s+/).length,
        format: 'pdf',
        filename,
        extractedAt: new Date(),
      },
    };
  }
}
```

### DOCX Parser Implementation

```typescript
// apps/api/src/services/parsers/docx.parser.ts
import mammoth from 'mammoth';

export class DocxParser implements IDocumentParser {
  readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.docx',
  ];

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = result.value.trim();
    return {
      rawText: text,
      metadata: {
        wordCount: text.split(/\s+/).length,
        format: 'docx',
        filename,
        extractedAt: new Date(),
      },
    };
  }
}
```

### Format Extensibility Matrix

| Format | MIME Type | Parser Class | Status |
|---|---|---|---|
| PDF | `application/pdf` | `PdfParser` | ✅ Implemented |
| DOCX | `application/vnd.openxmlformats-officedocument...` | `DocxParser` | ✅ Implemented |
| TXT | `text/plain` | `TxtParser` | 🔲 Stub ready |
| HTML | `text/html` | `HtmlParser` | 🔲 Stub ready |
| ODT | `application/vnd.oasis.opendocument.text` | `OdtParser` | 🔲 Planned |
| RTF | `application/rtf` | `RtfParser` | 🔲 Planned |
| Image (OCR) | `image/png`, `image/jpeg` | `OcrParser` (Tesseract) | 🔲 Future |

> Adding OCR support (for scanned PDFs) is handled by implementing `OcrParser` — the pipeline is unaffected.

---

## 7. Data Pipeline — Full Flow

### Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INGESTION PIPELINE                              │
│                                                                         │
│  [1] Upload      [2] Store      [3] Parse     [4] Extract              │
│  ─────────────   ─────────────  ──────────    ────────────────          │
│  Multipart form  MinIO / S3     Strategy      OpenAI GPT-4o            │
│  PDF / DOCX  ──▶ Raw file   ──▶ parser    ──▶ Structured JSON          │
│                  key stored     Raw text       (skills, exp,            │
│                  in DB          output         education, etc.)         │
│                                                                         │
│  [5] Embed       [6] Store Vector    [7] Index                         │
│  ─────────────   ──────────────────  ──────────                        │
│  OpenAI          pgvector column     IVFFlat /                         │
│  text-embed- ──▶ in candidates   ──▶ HNSW index                       │
│  3-small         table              (cosine)                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         MATCHING PIPELINE                               │
│                                                                         │
│  [1] JD Input    [2] Parse JD    [3] Extract JD   [4] Embed JD        │
│  ─────────────   ────────────    ─────────────    ────────────         │
│  Text / File  ──▶ (same parser ──▶ OpenAI GPT- ──▶ OpenAI vector      │
│  upload          chain)          4o structured    (1536-dim)           │
│                                  output                                │
│                                                                         │
│  [5] Vector Search  [6] LLM Re-rank    [7] Return Top 10              │
│  ──────────────────  ───────────────   ───────────────────             │
│  pgvector cosine ──▶ GPT-4o with   ──▶ Ranked JSON with               │
│  similarity         full context      scores + rationale               │
│  (top-20 recall)    → top 10                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step: Ingestion Pipeline

#### Step 1 — Upload & Validate

```
POST /api/uploads
Content-Type: multipart/form-data

Fields:
  - file: <binary>         (PDF or DOCX, max 10MB)
  - type: "resume" | "jd"  (document type)
```

- File is validated (size, MIME type, extension)
- Zod schema enforces constraints at API boundary
- File is stored to MinIO (locally) / S3 (prod) with a deterministic key: `{type}/{year}/{month}/{uuid}.{ext}`
- A `document` record is inserted into PostgreSQL with status `pending`
- A job is added to the **BullMQ ingestion queue**
- API returns `{ documentId, status: "queued" }` immediately (async)

#### Step 2 — Queue Processing (BullMQ Worker)

```typescript
// apps/api/src/queues/workers/ingestion.worker.ts
worker.process('ingestion', async (job) => {
  const { documentId } = job.data;
  await ingestPipeline.run(documentId);
});
```

#### Step 3 — Parse Raw Text

```typescript
const file = await storageService.get(document.storageKey);
const parser = parserRegistry.getParser(document.mimeType, document.extension);
const parsed = await parser.parse(file.buffer, document.filename);
await db.update(documents).set({ rawText: parsed.rawText, status: 'parsed' });
```

#### Step 4 — Structured Extraction via LLM

GPT-4o extracts a normalised JSON structure using **structured output** (JSON mode with schema):

```typescript
// Extraction schema (Zod → OpenAI JSON schema)
const ResumeProfile = z.object({
  fullName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  currentTitle: z.string().optional(),
  totalYearsExperience: z.number(),
  skills: z.array(z.object({
    name: z.string(),
    category: z.enum(['technical', 'soft', 'domain', 'tool', 'language']),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  })),
  workExperience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    description: z.string(),
    technologies: z.array(z.string()),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    graduationYear: z.number().optional(),
  })),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  summary: z.string(),  // LLM-synthesised professional summary
});
```

The `summary` field is a synthesised, rich-text concatenation of the entire profile — this is what gets embedded.

#### Step 5 — Generate Embedding

```typescript
// apps/api/src/services/embeddings/openai.embedder.ts
const embeddingText = buildEmbeddingText(profile);
// e.g.: "Software Engineer with 7 years experience in TypeScript, React, Node.js.
//        Led microservices architecture at Acme Corp. B.S. Computer Science MIT.
//        Skills: TypeScript (expert), React (advanced), PostgreSQL (intermediate)..."

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: embeddingText,
});
const vector = response.data[0].embedding; // float[1536]
```

**Embedding text construction strategy:**  
Rather than embedding raw resume text (which is noisy), we embed the **LLM-synthesised structured summary**. This produces cleaner, more semantically consistent vectors because:
- Irrelevant formatting noise is removed
- Skills are normalised (e.g., "JS" → "JavaScript")
- Experience is weighted by recency in the text ordering

#### Step 6 — Store Vector in pgvector

```sql
-- Schema
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  profile     JSONB NOT NULL,        -- structured extraction output
  embedding   vector(1536),          -- pgvector column
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cosine similarity search
CREATE INDEX ON candidates USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
-- Note: HNSW index preferred for production (better recall/speed tradeoff)
-- CREATE INDEX ON candidates USING hnsw (embedding vector_cosine_ops);
```

```typescript
// Drizzle ORM insert with vector
await db.insert(candidates).values({
  documentId,
  profile: extractedProfile,
  embedding: sql`${JSON.stringify(vector)}::vector`,
});
```

---

### Step-by-Step: Matching Pipeline

#### Step 1–4 — Process Job Description

The JD goes through the **same ingestion pipeline** with `type: "jd"`. The extraction schema differs:

```typescript
const JobDescriptionProfile = z.object({
  jobTitle: z.string(),
  department: z.string().optional(),
  requiredSkills: z.array(z.object({ name: z.string(), required: z.boolean() })),
  preferredSkills: z.array(z.string()),
  minYearsExperience: z.number(),
  maxYearsExperience: z.number().optional(),
  educationRequirement: z.string().optional(),
  responsibilities: z.array(z.string()),
  industry: z.string().optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal', 'c-level']),
  summary: z.string(), // synthesised for embedding
});
```

#### Step 5 — pgvector Cosine Similarity Search (Top-20 Recall)

```sql
-- Get top 20 candidates by vector similarity
SELECT
  c.id,
  c.profile,
  1 - (c.embedding <=> $1::vector) AS similarity_score
FROM candidates c
ORDER BY c.embedding <=> $1::vector
LIMIT 20;
```

This retrieves 20 candidates (over-fetch for re-ranking). The cosine distance operator `<=>` is O(log n) with the IVFFlat/HNSW index.

#### Step 6 — LLM Re-ranking (Top 10)

The top-20 vector matches are **not** the final answer — they are the recall set. GPT-4o re-ranks them with full context:

```typescript
const prompt = `
You are an expert technical recruiter. Given the following job description and 
${candidates.length} candidate profiles retrieved by semantic similarity, 
re-rank and return the TOP 10 best candidates.

For each selected candidate provide:
- rank (1-10)
- candidateId
- matchScore (0.0 - 1.0)
- strengths: string[]      (why this candidate fits)
- gaps: string[]           (what they're missing)
- reasoning: string        (one paragraph explanation)

Job Description:
${JSON.stringify(jdProfile, null, 2)}

Candidates (ordered by vector similarity, not final rank):
${candidates.map((c, i) => `[${i + 1}] ${JSON.stringify(c.profile)}`).join('\n\n')}

Return valid JSON matching the provided schema.
`;
```

This step adds **qualitative intelligence** that vector similarity cannot provide:
- Skill gap analysis
- Seniority fit (over/under-qualified)
- Domain relevance (e.g., fintech experience for a fintech role)
- Cultural / role-specific signals in job description language

---

## 8. RAG System with pgvector

### Architecture

```
                    ┌─────────────────────┐
   Job Description  │   Query Encoder     │
   (text / file) ──▶│  OpenAI             │──▶ query_vector [1536]
                    │  text-embedding-    │
                    │  3-small            │
                    └─────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   pgvector          │   Retrieval (R)
                    │   Nearest Neighbour │
                    │   (cosine, top-20)  │──▶ Candidate profiles
                    └─────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   GPT-4o            │   Generation (G)
                    │   Re-ranker +       │
                    │   Explainer         │──▶ Top 10 + rationale
                    └─────────────────────┘
```

### Why RAG (not pure LLM)?

| Approach | Problem | Our Solution |
|---|---|---|
| Send all resumes to GPT-4o | Context window limits (e.g., 1000 resumes = millions of tokens); extremely expensive | RAG: only top-20 candidates enter the LLM |
| Pure keyword search (Elasticsearch) | Misses semantic equivalence: "Node.js" ≠ "server-side JavaScript" in keyword search | Vector embeddings capture semantic meaning |
| Pure vector search | No qualitative reasoning; can't explain WHY a candidate fits | LLM re-ranking adds explainability |
| **Our hybrid RAG** | Best of all worlds: scale via vector recall, quality via LLM | ✅ |

### pgvector Index Strategy

| Use Case | Index Type | Configuration |
|---|---|---|
| **Local Dev** (< 10k candidates) | No index (exact search is fine) | — |
| **Staging** (10k – 500k candidates) | IVFFlat | `lists = sqrt(n_rows)` |
| **Production** (500k+ candidates) | HNSW | `m=16, ef_construction=64` |

HNSW is preferred for production because it has better recall and doesn't require rebuilding when the table grows (unlike IVFFlat which needs periodic `VACUUM` + rebuild).

### Embedding Model Selection

| Model | Dimensions | Cost | Quality |
|---|---|---|---|
| `text-embedding-3-small` | 1536 | $0.02/1M tokens | ✅ Recommended |
| `text-embedding-3-large` | 3072 | $0.13/1M tokens | Higher quality, 6.5× cost |
| `text-embedding-ada-002` | 1536 | $0.10/1M tokens | Legacy, worse quality |

> **Recommendation**: `text-embedding-3-small` provides the best cost/quality ratio for this use case. Supports **Matryoshka Representation Learning (MRL)** — dimensions can be reduced to 256 or 512 with minor quality loss if storage becomes a constraint.

### Future: Self-Hosted Embeddings (Fully Private)

```typescript
// IEmbeddingProvider interface allows swapping the embedding backend:
export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// OpenAI implementation (current)
class OpenAIEmbedder implements IEmbeddingProvider { ... }

// Ollama (future — fully local, no API key)
class OllamaEmbedder implements IEmbeddingProvider {
  // Uses: nomic-embed-text (768-dim) or mxbai-embed-large (1024-dim)
}

// AWS Bedrock Titan (future — managed, private)
class BedrockEmbedder implements IEmbeddingProvider { ... }
```

---

## 9. Cold Start Accuracy Strategy

> **The cold start problem**: A brand-new job posting has zero historical match data, zero prior hiring decisions, and zero feedback signals. How does the system still produce accurate top-10 recommendations?

### Why Cold Start Is Not a Problem for This System

Many recommendation systems rely on **collaborative filtering** (users who hired X also hired Y) or **historical signal** (click-through rates, conversion events). Those systems fail at cold start because they have no data to learn from.

**This system uses content-based semantic matching from day zero.** No historical data is ever required because:

1. **Embeddings capture semantic meaning intrinsically.** When you embed the sentence "Looking for a senior TypeScript engineer with React and cloud experience", the resulting vector is geometrically close to vectors for resumes that describe exactly that experience — *even if neither document has ever been seen by the system before*.

2. **LLM extraction normalises vocabulary.** GPT-4o converts "10 years of JS experience" and "decade of full-stack web dev with JavaScript" into the same structured representation, eliminating the synonym problem that breaks keyword systems at cold start.

3. **The JD itself is the query.** We embed the job description and perform similarity search. There is no reliance on past signals. A JD added at 9:00 AM with zero candidates ever hired for it can immediately return top-10 results at 9:01 AM.

### Cold Start Accuracy — Layered Defence

#### Layer 1: Vector Similarity (Semantic Baseline)

- As described above: cosine similarity between JD embedding and candidate embeddings.
- This works from the *very first candidate and JD in the system*.

#### Layer 2: Structured Constraint Filtering (Hard Rules)

Before vector search, **hard filters** narrow the candidate pool:

```sql
WITH filtered AS (
  SELECT c.id, c.embedding, c.profile
  FROM candidates c
  WHERE
    -- Hard filter: experience bands
    (c.profile->>'totalYearsExperience')::int BETWEEN $min_exp AND $max_exp
    -- Hard filter: seniority
    AND c.profile->>'seniorityLevel' = ANY($required_seniority)
)
SELECT id, 1 - (embedding <=> $jd_vector::vector) AS score
FROM filtered
ORDER BY embedding <=> $jd_vector::vector
LIMIT 20;
```

Even at cold start, structured extraction ensures the top-10 are at least within the correct experience bands and seniority tier.

#### Layer 3: LLM Re-ranking with Skill Gap Analysis

GPT-4o performs a structured skills overlap analysis:

```
For each of the top-20 candidates:
  required_skills_met    = intersection(candidate.skills, jd.requiredSkills)
  preferred_skills_met   = intersection(candidate.skills, jd.preferredSkills)
  skills_coverage_score  = required_skills_met / jd.requiredSkills * 0.7
                         + preferred_skills_met / jd.preferredSkills * 0.3
  
  Final score = 0.5 * vector_similarity + 0.3 * skills_coverage + 0.2 * experience_fit
```

This deterministic scoring component acts as a correctness anchor — even if the LLM has a bad day, the structured skill coverage score provides a numerically grounded signal.

#### Layer 4: Seniority-Aware Scoring

The JD extraction always produces a `seniority` field. Candidates are penalised (not filtered) if they are significantly over/under-qualified:

```typescript
// Over-qualified penalty: principal applying for junior role
const seniorityGap = getSeniorityScore(candidate.seniority) - getSeniorityScore(jd.seniority);
const seniorityPenalty = Math.max(0, seniorityGap - 1) * 0.15; // 15% penalty per level over
```

#### Layer 5: Recency Weighting

Recent experience is weighted more heavily than older experience:

```typescript
// Experience recency scoring
const recencyScore = workExperience.reduce((score, exp) => {
  const yearsAgo = currentYear - exp.endYear ?? currentYear;
  const recencyWeight = Math.exp(-0.1 * yearsAgo); // exponential decay
  return score + (relevanceScore * recencyWeight);
}, 0);
```

### Cold Start Summary

| Signal | Available at Cold Start? | How Used |
|---|---|---|
| Historical hiring decisions | ❌ No | Not needed |
| Click/view signals | ❌ No | Not needed |
| JD text (required) | ✅ Always | Embedded, structured extraction |
| Candidate resume (required) | ✅ Always | Embedded, structured extraction |
| Skill overlap | ✅ Derived | Skills coverage formula |
| Experience match | ✅ Derived | Hard filters + scoring |
| Semantic similarity | ✅ From embeddings | Primary ranking signal |
| LLM reasoning | ✅ Always | Re-ranking + explanation |

> **Conclusion**: Cold start is solved by design. The system produces defensible, accurate top-10 results from the moment the first resume and JD are uploaded, with no warm-up period, no historical data, and no pre-training required.

---

## 10. Queue Mechanism

### Local: BullMQ + Redis

```
API Server
    │
    │  addJob('ingestion', { documentId })
    ▼
┌─────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  BullMQ     │────▶│  Redis (Queue)     │────▶│  BullMQ Worker   │
│  Queue      │     │  bull:ingestion    │     │  (processes job) │
└─────────────┘     └────────────────────┘     └──────────────────┘
                                                        │
                          ┌─────────────────────────────┤
                          │                             │
                    ┌─────▼─────┐               ┌──────▼──────┐
                    │  Success  │               │   Failure   │
                    │  update   │               │  retry (3x) │
                    │  DB row   │               │  then DLQ   │
                    └───────────┘               └─────────────┘
```

**Queue Configuration:**

```typescript
export const ingestionQueue = new Queue('ingestion', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
```

### Production: AWS SQS

The BullMQ interface is abstracted behind an `IQueueService` interface:

```typescript
export interface IQueueService {
  enqueue<T>(queueName: string, payload: T): Promise<string>;
  onProcess<T>(queueName: string, handler: (job: T) => Promise<void>): void;
}

// Local: BullMQQueueService
// Production: SQSQueueService (AWS SDK v3)
```

**SQS Configuration (Production):**
- Standard queue for ingestion jobs (at-least-once delivery, deduplication by `documentId`)
- Dead-letter queue (DLQ) after 3 failed delivery attempts
- Visibility timeout: 5 minutes (enough for parse + extract + embed cycle)
- Workers run as ECS Fargate tasks, scaling based on `ApproximateNumberOfMessagesVisible`

---

## 11. Caching Strategy

### What Gets Cached

| Data | Cache Key | TTL | Rationale |
|---|---|---|---|
| Top-10 results for a JD | `matches:{jobId}` | 30 min | LLM re-ranking is expensive; JD rarely changes |
| Candidate embedding | `embedding:{candidateId}` | 24 hrs | OpenAI call per candidate; reused for multiple JDs |
| Parsed JD profile | `jd-profile:{jobId}` | 1 hr | Extraction is idempotent |
| Candidate list (paginated) | `candidates:page:{n}` | 5 min | Read-heavy dashboard |

### Cache Invalidation Rules

| Event | Invalidates |
|---|---|
| New candidate added | `candidates:page:*` (wildcard flush) |
| Candidate profile updated | `embedding:{candidateId}`, `matches:*` (all match caches) |
| JD updated | `jd-profile:{jobId}`, `matches:{jobId}` |
| Explicit re-run requested | `matches:{jobId}` |

### Local: Redis Cache Wrapper

```typescript
// apps/api/src/cache/redis.cache.ts
export class RedisCache {
  async get<T>(key: string): Promise<T | null> {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  }
}
```

### Production: AWS ElastiCache (Redis)

Same `ICache` interface, replacing the Redis connection string:
- ElastiCache Redis 7.x (cluster mode disabled for simplicity; cluster mode for scale)
- TLS in-transit encryption enabled
- Auth token via AWS Secrets Manager

---

## 12. Local vs Production Architecture

### Component Mapping

| Component | Local (Docker Compose) | Production (AWS) | Migration Effort |
|---|---|---|---|
| PostgreSQL + pgvector | `postgres:16` container | RDS Aurora PostgreSQL 15.5 (supports pgvector) | Connection string change + Drizzle migration run |
| Redis (Queue + Cache) | `redis:7-alpine` container | ElastiCache Redis 7.x | Connection string + auth token |
| Object Storage | MinIO container | S3 | Storage adapter swap (`S3StorageService`) |
| API Server | Docker container on `:4000` | ECS Fargate (behind ALB) | Push image to ECR, update CDK stack |
| Frontend | Docker container / Vite dev | S3 + CloudFront | `bun run build` → `aws s3 sync` |
| Queue workers | BullMQ in same process | ECS Fargate tasks (separate service) | Worker service split |
| Secrets | `.env` file | AWS Secrets Manager + Parameter Store | CDK secret injection |
| DNS / TLS | localhost | Route 53 + ACM certificate | CDK configuration |

### docker-compose.yml (Local Stack)

```yaml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: cse
      POSTGRES_PASSWORD: cse_local
      POSTGRES_DB: candidate_engine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cse"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://cse:cse_local@postgres:5432/candidate_engine
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NODE_ENV: development
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api/src:/app/src  # hot reload

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:4000
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### docker/postgres/init.sql

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 13. Database Design & Migration Path

### Schema

```sql
-- documents: Raw uploaded files
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  storage_key  TEXT NOT NULL UNIQUE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('resume', 'jd')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'parsing', 'parsed', 'extracting',
                                   'extracted', 'embedding', 'ready', 'failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- candidates: Parsed + embedded resumes
CREATE TABLE candidates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id            UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  full_name              TEXT,
  email                  TEXT,
  profile                JSONB NOT NULL,   -- full structured extraction
  embedding              vector(1536),     -- pgvector column
  embedding_model        TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for candidate search
CREATE INDEX idx_candidates_embedding ON candidates
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_candidates_profile ON candidates
  USING gin (profile jsonb_path_ops);

-- job_descriptions: Parsed JDs
CREATE TABLE job_descriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  profile       JSONB NOT NULL,   -- structured JD extraction
  embedding     vector(1536),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- match_results: Cached top-10 results per JD run
CREATE TABLE match_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  run_at        TIMESTAMPTZ DEFAULT NOW(),
  results       JSONB NOT NULL,   -- array of ranked candidates with scores/rationale
  model_used    TEXT NOT NULL DEFAULT 'gpt-4o',
  UNIQUE (job_id, run_at)
);

-- Audit / event log
CREATE TABLE pipeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  event         TEXT NOT NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration to RDS Aurora PostgreSQL

Aurora PostgreSQL 15.x supports the `pgvector` extension natively. Migration steps:

1. Run `pg_dump` from local Docker PostgreSQL
2. Restore to RDS Aurora via `pg_restore`
3. Verify pgvector extension installed: `CREATE EXTENSION IF NOT EXISTS vector;`
4. Update `DATABASE_URL` in AWS Secrets Manager
5. Rebuild HNSW indexes (Aurora auto-optimises)
6. Run `bun run db:migrate` via Drizzle (migrations are idempotent)

> Zero schema changes required — the schema is designed for Aurora compatibility from day one.

### Migration to DynamoDB (Optional — NoSQL path)

If DynamoDB is preferred for candidates, the **vector search must move** to a dedicated vector store:
- **Option A**: Amazon OpenSearch Service (with k-NN plugin) — embeddings stored in OpenSearch, metadata in DynamoDB
- **Option B**: pgvector remains in Aurora for embeddings only, DynamoDB for profile metadata
- **Option C**: Pinecone or Weaviate (managed vector DB) for embeddings, DynamoDB for everything else

The `IEmbeddingProvider` and `IVectorStore` interfaces in the codebase make this swap surgical — only the infrastructure adapters change.

---

## 14. AWS CDK Infrastructure

### Stack Organisation

```
infra/cdk/lib/
├── network-stack.ts       VPC, public/private subnets, NAT gateway
├── database-stack.ts      RDS Aurora PostgreSQL (serverless v2), pgvector
├── cache-stack.ts         ElastiCache Redis 7.x
├── queue-stack.ts         SQS ingestion queue + DLQ
├── storage-stack.ts       S3 bucket (raw files), lifecycle rules
├── api-stack.ts           ECS Fargate (API + Worker), ALB, auto-scaling
└── web-stack.ts           S3 static hosting + CloudFront distribution
```

### Key CDK Constructs

```typescript
// infra/cdk/lib/database-stack.ts (excerpt)
const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_5,
  }),
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 16,
  writer: rds.ClusterInstance.serverlessV2('Writer'),
  readers: [rds.ClusterInstance.serverlessV2('Reader')],
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  credentials: rds.Credentials.fromGeneratedSecret('cse_admin'),
  storageEncrypted: true,
  deletionProtection: true,
  parameterGroup: new rds.ParameterGroup(this, 'PgParams', {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_5
    }),
    parameters: { 'shared_preload_libraries': 'vector' }, // pgvector
  }),
});
```

### Cost Estimate (AWS, moderate load)

| Service | Configuration | Est. Monthly |
|---|---|---|
| RDS Aurora Serverless v2 | 0.5–4 ACU writer | $50–200 |
| ElastiCache Redis | cache.t4g.micro | $15 |
| ECS Fargate (API) | 0.5 vCPU, 1GB, 2 tasks | $30 |
| ECS Fargate (Workers) | 0.25 vCPU, 0.5GB, scale 0–3 | $0–20 |
| ALB | — | $20 |
| S3 + CloudFront | < 100GB | $5 |
| SQS | < 1M messages | $0.40 |
| **Total** | | **~$120–290/mo** |

---

## 15. API Design

### Endpoints

```
POST   /api/uploads                      Upload a resume or JD file
GET    /api/uploads/:id/status           Polling endpoint for ingestion status

POST   /api/candidates                   Create candidate from upload
GET    /api/candidates                   List all candidates (paginated)
GET    /api/candidates/:id               Get single candidate with profile
DELETE /api/candidates/:id               Delete candidate + vectors

POST   /api/jobs                         Create job description from upload or text
GET    /api/jobs                         List all job descriptions
GET    /api/jobs/:id                     Get single JD
POST   /api/jobs/:id/match               Trigger top-10 matching run
GET    /api/jobs/:id/matches             Get latest match results (cached)
GET    /api/jobs/:id/matches/:runId      Get specific match run results

GET    /api/health                       Health check (DB + Redis + OpenAI)
```

### Response Format: Top-10 Match

```json
{
  "jobId": "uuid",
  "runId": "uuid",
  "ranAt": "2026-04-13T10:00:00Z",
  "modelUsed": "gpt-4o",
  "candidates": [
    {
      "rank": 1,
      "candidateId": "uuid",
      "matchScore": 0.94,
      "vectorSimilarity": 0.88,
      "candidate": {
        "fullName": "Jane Smith",
        "currentTitle": "Senior Software Engineer",
        "totalYearsExperience": 8,
        "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"]
      },
      "strengths": [
        "8 years TypeScript experience matching seniority requirement",
        "Led cloud migration at previous employer (aligns with JD focus)",
        "PostgreSQL expertise critical for this data-heavy role"
      ],
      "gaps": [
        "No Kubernetes experience listed (preferred in JD)",
        "Mobile development not in background"
      ],
      "reasoning": "Jane's deep TypeScript and cloud background closely aligns with the Principal Engineer role. Her experience leading teams of 5–8 engineers matches the people management expectation. The absence of Kubernetes is a minor gap given her strong infrastructure background."
    }
    // ... candidates 2-10
  ]
}
```

---

## 16. Frontend Design

### Pages & Components

```
Dashboard (/)
├── Stats cards: total candidates, active jobs, matches run today
├── Recent activity feed
└── Quick upload zone

Candidates (/candidates)
├── Upload zone (drag-and-drop PDF/DOCX)
├── Candidate list (paginated, searchable)
│   └── CandidateCard: name, title, skills chips, match score (if in active search)
└── Candidate detail modal: full profile, extracted skills, work history

Jobs (/jobs)
├── Create JD (text input or file upload)
├── Job list
└── Job detail (/jobs/:id)
    ├── JD summary
    ├── [Run Match] button
    ├── Pipeline status indicator (queued → processing → ready)
    └── Top-10 results (/jobs/:id/matches)
        └── RankingList: ranked candidate cards with scores, strengths, gaps, reasoning
```

### Pipeline Status (Real-time)

Server-Sent Events (SSE) stream pipeline status updates:

```typescript
// GET /api/uploads/:id/status (SSE)
app.get('/api/uploads/:id/status', (c) => {
  return streamSSE(c, async (stream) => {
    while (true) {
      const status = await getDocumentStatus(c.req.param('id'));
      await stream.writeSSE({ data: JSON.stringify(status) });
      if (['ready', 'failed'].includes(status.status)) break;
      await new Promise(r => setTimeout(r, 1500));
    }
  });
});
```

---

## 17. End-to-End Testing Strategy

### Playwright Test Coverage

```typescript
// e2e/upload.spec.ts
test('uploads a PDF resume and shows queued status', async ({ page }) => {
  await page.goto('/candidates');
  await page.setInputFiles('[data-testid="resume-upload"]', 'e2e/fixtures/sample.pdf');
  await expect(page.getByText('Processing...')).toBeVisible();
});

// e2e/matching.spec.ts
test('creates a JD and triggers matching', async ({ page }) => {
  await page.goto('/jobs/new');
  await page.fill('[data-testid="jd-text"]', seniorEngineerJD);
  await page.click('[data-testid="create-job"]');
  await page.click('[data-testid="run-match"]');
  await expect(page.getByText('Matching in progress...')).toBeVisible();
});

// e2e/top10.spec.ts
test('displays exactly 10 ranked candidates', async ({ page }) => {
  // Uses pre-seeded database (docker-compose.test.yml)
  await page.goto(`/jobs/${SEEDED_JOB_ID}/matches`);
  const cards = page.locator('[data-testid="candidate-rank-card"]');
  await expect(cards).toHaveCount(10);
  // Verify ranks are 1-10
  for (let i = 1; i <= 10; i++) {
    await expect(cards.nth(i - 1).locator('[data-testid="rank"]')).toHaveText(`${i}`);
  }
});
```

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['github']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'docker compose -f docker-compose.test.yml up --wait',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 18. Security Considerations

| Risk | Mitigation |
|---|---|
| File upload abuse (malicious files) | MIME type + magic bytes validation; sandbox parsing in worker process; max file size (10MB) |
| Prompt injection via resume content | System prompt hardening; structured output mode (JSON schema); no free-form tool calling |
| OpenAI key exposure | Never logged; stored in env / Secrets Manager; rotated quarterly |
| SQL injection | Drizzle ORM with parameterised queries; no raw SQL with user input |
| Overly permissive S3 bucket | Bucket policy: deny public access; presigned URLs for downloads (15-min expiry) |
| PII in logs | Structured logging with PII field masking (email, phone, name) |
| CORS | Strict origin whitelist; credentials not included for cross-origin |
| Rate limiting | API rate limit: 100 req/min per IP; upload rate limit: 10 uploads/min per IP |
| Vector poisoning | Embedding content is derived from LLM-extracted structured data (not raw user text), reducing injection surface |

---

## 19. Performance & Scalability

### Latency Budget (p95 targets)

| Operation | Target | Bottleneck |
|---|---|---|
| File upload + queue | < 500ms | Network |
| Parse (PDF, 10 pages) | < 2s | pdf-parse |
| LLM extraction (GPT-4o) | < 8s | OpenAI API |
| Embedding generation | < 2s | OpenAI API |
| pgvector similarity search (10k candidates) | < 50ms | HNSW index |
| LLM re-ranking (top-20 → top-10) | < 6s | OpenAI API |
| **Total ingestion pipeline** | **< 15s** | LLM calls |
| **Total matching pipeline** | **< 10s (uncached)** | LLM re-rank |
| **Total matching (cached)** | **< 100ms** | Redis + pgvector |

### Scaling Strategies

- **Horizontal scaling**: API and worker services are stateless; scale ECS tasks on CPU/queue depth
- **Embedding batching**: Batch up to 100 candidates per OpenAI embedding call to reduce API overhead by ~50x
- **Async ingestion**: Upload API returns immediately; processing is fully async via queue
- **Vector index tuning**: HNSW `efSearch=40` at query time trades minor recall (<1%) for 3× speed improvement at 1M+ rows
- **Read replicas**: ElastiCache and Aurora read replicas for match result reads

---

## 20. Sequence Diagrams

### Resume Ingestion Sequence

```
Browser          API Server         Queue        Worker         OpenAI          PostgreSQL
   │                 │                │              │              │                │
   │  POST /uploads  │                │              │              │                │
   │────────────────▶│                │              │              │                │
   │                 │ store to MinIO │              │              │                │
   │                 │──────────────────────────────────────────────────────────────▶│
   │                 │ INSERT document (pending)                                      │
   │                 │──────────────────────────────────────────────────────────────▶│
   │                 │ enqueue job    │              │              │                │
   │                 │───────────────▶│              │              │                │
   │  { documentId } │                │              │              │                │
   │◀────────────────│                │              │              │                │
   │                 │                │ dequeue job  │              │                │
   │                 │                │─────────────▶│              │                │
   │                 │                │              │ parse file   │                │
   │                 │                │              │──────────────────────────────▸│
   │                 │                │              │ extract (GPT-4o)               │
   │                 │                │              │─────────────▶│                │
   │                 │                │              │◀─────────────│                │
   │                 │                │              │ embed (text-embedding-3-small) │
   │                 │                │              │─────────────▶│                │
   │                 │                │              │◀─────────────│                │
   │                 │                │              │ INSERT candidate + vector      │
   │                 │                │              │──────────────────────────────▶│
   │                 │                │              │ UPDATE document (ready)        │
   │                 │                │              │──────────────────────────────▶│
```

### Top-10 Matching Sequence

```
Browser          API Server         Redis Cache    PostgreSQL       OpenAI
   │                 │                   │              │              │
   │ POST /jobs/:id/match                │              │              │
   │────────────────▶│                   │              │              │
   │                 │ GET matches:{id}  │              │              │
   │                 │──────────────────▶│              │              │
   │                 │   MISS            │              │              │
   │                 │◀──────────────────│              │              │
   │                 │ SELECT jd embedding              │              │
   │                 │─────────────────────────────────▶│              │
   │                 │ vector cosine search (top-20)    │              │
   │                 │─────────────────────────────────▶│              │
   │                 │ 20 candidates ◀──────────────────│              │
   │                 │ re-rank top-20 → top-10          │─────────────▶│
   │                 │                                  │              │
   │                 │ top 10 ranked ◀──────────────────────────────────│
   │                 │ SET matches:{id} (TTL 30min)     │              │
   │                 │──────────────────▶│              │              │
   │                 │ INSERT match_results             │              │
   │                 │─────────────────────────────────▶│              │
   │  { top 10 }     │                   │              │              │
   │◀────────────────│                   │              │              │
```

---

## Appendix: Environment Variables

```bash
# .env.example

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EXTRACTION_MODEL=gpt-4o
OPENAI_RERANK_MODEL=gpt-4o

# Database
DATABASE_URL=postgresql://cse:cse_local@localhost:5432/candidate_engine

# Redis
REDIS_URL=redis://localhost:6379

# Storage (MinIO locally, S3 in prod)
STORAGE_PROVIDER=minio          # minio | s3
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cse-documents

# Queue
QUEUE_PROVIDER=bullmq           # bullmq | sqs
AWS_SQS_QUEUE_URL=              # only needed for SQS

# App
API_PORT=4000
NODE_ENV=development
LOG_LEVEL=debug
MAX_UPLOAD_SIZE_MB=10
VECTOR_SEARCH_RECALL_K=20       # candidates retrieved before re-ranking
FINAL_TOP_K=10                  # final ranked output count
```

---

*This design document covers the full system from local development to production-grade AWS deployment. The architecture is intentionally layered so each component can evolve independently — local Docker services are replaced with managed AWS equivalents without changing application code, only infrastructure configuration.*
