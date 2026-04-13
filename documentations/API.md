# API Reference — Candidate Suggestion Engine

Base URL (local): `http://localhost:4000/api`

All request bodies are JSON (`Content-Type: application/json`) unless noted. All timestamps are ISO 8601 UTC strings. UUIDs are v4.

---

## Table of Contents

- [Uploads](#uploads)
- [Candidates](#candidates)
- [Jobs](#jobs)
- [Match](#match)
- [Health](#health)
- [Error format](#error-format)
- [Common types](#common-types)

---

## Uploads

### POST `/api/uploads`

Upload a resume or job description file for asynchronous processing.

**Content-Type:** `multipart/form-data`

| Field | Type   | Required | Description                          |
|-------|--------|----------|--------------------------------------|
| file  | File   | ✓        | PDF, DOCX, or DOC. Max 10 MB.        |
| type  | string | ✓        | `"resume"` or `"jd"`                 |

**Response `202 Accepted`**

```json
{
  "documentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "queued"
}
```

**Error responses**

| Status | Condition                                |
|--------|------------------------------------------|
| 400    | Missing `file` or invalid `type`         |
| 413    | File exceeds 10 MB                       |
| 415    | Unsupported MIME type                    |

---

### GET `/api/uploads/:documentId/status`

Poll processing status for an uploaded document.

**Path params**

| Param      | Description      |
|------------|------------------|
| documentId | UUID from upload |

**Response `200 OK`**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "ready",
  "error": null,
  "updatedAt": "2026-04-14T10:23:45.000Z"
}
```

**`status` values**

| Value      | Meaning                                     |
|------------|---------------------------------------------|
| `pending`  | Received, not yet queued                    |
| `queued`   | Waiting in BullMQ for a worker              |
| `parsing`  | File is being parsed                        |
| `embedding`| Profile extracted, computing vector         |
| `ready`    | Ingestion complete; candidate/JD is live    |
| `error`    | Pipeline failed; see `error` field          |

**Error responses**

| Status | Condition           |
|--------|---------------------|
| 404    | Document not found  |

---

## Candidates

### GET `/api/candidates`

List candidates with optional full-text search and pagination.

**Query params**

| Param | Type   | Default | Description                              |
|-------|--------|---------|------------------------------------------|
| page  | number | 1       | 1-based page number                      |
| limit | number | 20      | Results per page (max 100)               |
| q     | string | —       | Case-insensitive search on name or email |

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "abc123...",
      "fullName": "Ada Lovelace",
      "email": "ada@example.com",
      "createdAt": "2026-04-13T09:00:00.000Z",
      "profile": { "...": "..." }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

---

### GET `/api/candidates/:id`

Fetch full profile for a single candidate.

**Response `200 OK`**

```json
{
  "id": "abc123...",
  "documentId": "3fa85f64...",
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "embeddingModel": "text-embedding-3-small",
  "createdAt": "2026-04-13T09:00:00.000Z",
  "updatedAt": "2026-04-13T09:00:00.000Z",
  "profile": {
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "currentTitle": "Senior Software Engineer",
    "totalYearsExperience": 8,
    "seniorityLevel": "senior",
    "summary": "...",
    "skills": [
      { "name": "TypeScript", "category": "languages", "proficiency": "expert" }
    ],
    "workExperience": [
      {
        "company": "Acme Corp",
        "title": "Software Engineer",
        "startDate": "2018-01",
        "endDate": "2022-06",
        "description": "...",
        "technologies": ["Node.js", "PostgreSQL"]
      }
    ],
    "education": [
      {
        "institution": "MIT",
        "degree": "BSc",
        "field": "Computer Science",
        "graduationYear": 2016
      }
    ],
    "certifications": ["AWS Certified Developer"],
    "languages": ["English", "French"]
  }
}
```

**Error responses**

| Status | Condition            |
|--------|----------------------|
| 404    | Candidate not found  |

---

### PUT `/api/candidates/:id`

Update a candidate's profile and immediately regenerate their embedding vector. Use this to correct parsed data or add details.

**Request body** *(all fields optional; provide at least one)*

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "profile": {
    "currentTitle": "Staff Engineer",
    "totalYearsExperience": 10,
    "summary": "Updated summary...",
    "skills": [
      { "name": "Rust", "category": "languages", "proficiency": "proficient" }
    ],
    "certifications": ["AWS Solutions Architect"]
  }
}
```

The `profile` object is merged (shallow) over the existing profile. To clear a field pass `null` for it.

**Response `200 OK`**

```json
{
  "id": "abc123...",
  "fullName": "Ada Lovelace"
}
```

**Side effects**

- Embedding vector is recalculated immediately using `text-embedding-3-small`.
- `candidates:page:*` cache keys are invalidated.
- `matches:*` cache keys are invalidated (previous match results may no longer be accurate).

**Error responses**

| Status | Condition                              |
|--------|----------------------------------------|
| 400    | No fields provided / invalid JSON      |
| 404    | Candidate not found                    |
| 500    | Re-embedding failed (profile saved with old vector) |

---

### DELETE `/api/candidates/:id`

Permanently delete a candidate and their embedding.

**Response `200 OK`**

```json
{ "deleted": "abc123..." }
```

**Error responses**

| Status | Condition            |
|--------|----------------------|
| 404    | Candidate not found  |

---

## Jobs

### GET `/api/jobs`

List job descriptions with optional search and pagination.

**Query params**

| Param | Type   | Default | Description                     |
|-------|--------|---------|---------------------------------|
| page  | number | 1       | 1-based page number             |
| limit | number | 20      | Fixed at 20 (not configurable)  |
| q     | string | —       | Case-insensitive search on title|

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "def456...",
      "title": "Senior Software Engineer",
      "createdAt": "2026-04-13T10:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

---

### GET `/api/jobs/:id`

Fetch full profile for a single job description (embedding excluded).

**Response `200 OK`**

```json
{
  "id": "def456...",
  "title": "Senior Software Engineer",
  "createdAt": "2026-04-13T10:00:00.000Z",
  "updatedAt": "2026-04-13T10:00:00.000Z",
  "profile": {
    "jobTitle": "Senior Software Engineer",
    "department": "Engineering",
    "industry": "SaaS",
    "seniority": "senior",
    "summary": "...",
    "minYearsExperience": 5,
    "maxYearsExperience": 10,
    "educationRequirement": "BSc Computer Science or equivalent",
    "requiredSkills": [
      { "name": "TypeScript", "required": true }
    ],
    "preferredSkills": ["Rust", "Go"],
    "responsibilities": ["Design and ship features", "Code review"]
  }
}
```

**Error responses**

| Status | Condition       |
|--------|-----------------|
| 404    | Job not found   |

---

### PUT `/api/jobs/:id`

Update a job description's title and/or profile. Clears the stored embedding so it is regenerated on the next match run.

**Request body** *(at least one field required)*

```json
{
  "title": "Staff Software Engineer",
  "profile": {
    "seniority": "staff",
    "minYearsExperience": 7
  }
}
```

**Response `200 OK`**

```json
{
  "id": "def456...",
  "title": "Staff Software Engineer"
}
```

**Side effects**

- Embedding cleared; will be recomputed on the next `POST /match`.
- `matches:{id}` cache key is invalidated.

**Error responses**

| Status | Condition                           |
|--------|-------------------------------------|
| 400    | Nothing to update / invalid JSON    |
| 404    | Job not found                       |

---

### DELETE `/api/jobs/:id`

Delete a job description and all associated match results (cascade).

**Response `200 OK`**

```json
{ "deleted": "def456..." }
```

**Error responses**

| Status | Condition     |
|--------|---------------|
| 404    | Job not found |

---

## Match

### POST `/api/jobs/:id/match`

Run the full matching pipeline for a job description against all indexed candidates.

**Pipeline steps**

1. Embed JD (if no embedding stored or after an edit).
2. pgvector cosine similarity recall — top 30, filtered by `MIN_SIMILARITY ≥ 0.25`.
3. Domain keyword overlap filter (removes structurally unrelated candidates).
4. GPT-4o re-ranking of up to 20 candidates.
5. Returns top 10 ranked results.

**Response `200 OK`**

```json
{
  "jobId": "def456...",
  "runId": "run789...",
  "ranAt": "2026-04-14T11:00:00.000Z",
  "modelUsed": "gpt-4o",
  "candidates": [
    {
      "rank": 1,
      "candidateId": "abc123...",
      "matchScore": 0.92,
      "vectorSimilarity": 0.87,
      "candidate": {
        "fullName": "Ada Lovelace",
        "currentTitle": "Senior Software Engineer",
        "totalYearsExperience": 8,
        "skills": ["TypeScript", "Node.js", "PostgreSQL"]
      },
      "strengths": ["Strong TypeScript background", "Led distributed systems work"],
      "gaps": ["No Rust experience"],
      "reasoning": "Ada closely matches the role requirements..."
    }
  ]
}
```

**Error responses**

| Status | Condition                                  |
|--------|--------------------------------------------|
| 404    | Job not found                              |
| 500    | Pipeline error (embedding or LLM failure)  |

---

### GET `/api/jobs/:id/matches`

Return the most recent match result for a job. Results are cached for 30 minutes.

**Response `200 OK`** — same shape as `POST /match`.

**Error responses**

| Status | Condition                         |
|--------|-----------------------------------|
| 404    | No match results found for job    |

---

### GET `/api/jobs/:id/matches/:runId`

Fetch a specific match run by its ID.

**Error responses**

| Status | Condition                         |
|--------|-----------------------------------|
| 404    | Run not found or belongs to different job |

---

## Health

### GET `/api/health`

Liveness check used by Docker healthcheck and load balancer target group.

**Response `200 OK`**

```json
{ "status": "ok" }
```

---

## Error format

All error responses follow a consistent envelope:

```json
{
  "error": "Human-readable description"
}
```

---

## Common types

### `CandidateProfile`

| Field                 | Type                | Description                               |
|-----------------------|---------------------|-------------------------------------------|
| fullName              | string              |                                           |
| email                 | string?             |                                           |
| phone                 | string?             |                                           |
| currentTitle          | string?             |                                           |
| totalYearsExperience  | number              | Total years across all roles              |
| seniorityLevel        | string?             | `junior` / `mid` / `senior` / `lead` / `staff` / `principal` |
| skills                | CandidateSkill[]    |                                           |
| workExperience        | WorkExperience[]    |                                           |
| education             | Education[]         |                                           |
| certifications        | string[]            |                                           |
| languages             | string[]            |                                           |
| summary               | string              | LLM-generated or manually written bio     |

### `CandidateSkill`

| Field       | Type    | Description                                   |
|-------------|---------|-----------------------------------------------|
| name        | string  | Skill name                                    |
| category    | string  | `languages` / `frameworks` / `databases` / `cloud` / `tools` / `soft-skills` |
| proficiency | string? | `beginner` / `proficient` / `expert`          |

### `WorkExperience`

| Field        | Type     | Description                   |
|--------------|----------|-------------------------------|
| company      | string   |                               |
| title        | string   | Job title held                |
| startDate    | string   | `YYYY-MM` format              |
| endDate      | string?  | `YYYY-MM` or omitted if current |
| description  | string   | Responsibilities summary      |
| technologies | string[] | Tools / languages used        |

### `Education`

| Field          | Type    |
|----------------|---------|
| institution    | string  |
| degree         | string  |
| field          | string  |
| graduationYear | number? |

### `JobDescriptionProfile`

| Field                 | Type                          | Description                              |
|-----------------------|-------------------------------|------------------------------------------|
| jobTitle              | string                        |                                          |
| department            | string?                       |                                          |
| industry              | string?                       |                                          |
| seniority             | string?                       |                                          |
| summary               | string                        |                                          |
| minYearsExperience    | number                        |                                          |
| maxYearsExperience    | number?                       |                                          |
| educationRequirement  | string?                       |                                          |
| requiredSkills        | `Array<{name, required}>`     | `required: true` = hard requirement      |
| preferredSkills       | string[]                      | Nice-to-have                             |
| responsibilities      | string[]                      |                                          |

### `RankedCandidate`

| Field             | Type     | Description                                  |
|-------------------|----------|----------------------------------------------|
| rank              | number   | 1–10                                         |
| candidateId       | string   |                                              |
| matchScore        | number   | 0–1, LLM-assigned overall fit                |
| vectorSimilarity  | number   | 0–1, cosine similarity from pgvector         |
| candidate         | object   | Snapshot of key profile fields               |
| strengths         | string[] | Why this candidate fits                      |
| gaps              | string[] | Missing requirements                         |
| reasoning         | string   | LLM explanation                              |
