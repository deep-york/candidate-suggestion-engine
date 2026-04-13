# Ingestion Pipeline — Flow Diagram

```mermaid
flowchart TD
    A([Client: POST /api/uploads\nPDF or DOCX file]) --> B{Validate file\nMIME + size ≤ 10MB}
    B -- invalid --> C([400 Bad Request])
    B -- valid --> D[Store raw file\nMinIO / S3]
    D --> E[INSERT documents\nstatus = pending]
    E --> F[Enqueue BullMQ job\ningestion queue]
    F --> G([202 Accepted\n{documentId, status: queued}])

    subgraph Worker["BullMQ Worker (async)"]
        H[Dequeue job\n{documentId}] --> I[Fetch file\nfrom MinIO / S3]
        I --> J{Select parser\nfrom registry}
        J -- PDF --> K[pdf-parse\nraw text]
        J -- DOCX --> L[mammoth\nraw text]
        J -- future --> M[...]
        K --> N[UPDATE status = extracting]
        L --> N
        M --> N
        N --> O[OpenAI GPT-4o\nStructured JSON extraction\nskills, experience, education...]
        O --> P{Extraction\nsucceeded?}
        P -- no --> Q[UPDATE status = failed\nlog error]
        P -- yes --> R[UPDATE status = embedding]
        R --> S[Build embedding text\nfrom synthesised summary]
        S --> T[OpenAI text-embedding-3-small\n→ float vector 1536 dims]
        T --> U[INSERT candidates\nprofile JSONB + vector\nUPDATE status = ready]
    end

    F -.-> H
    U --> V([SSE: status = ready\nto browser via GET /api/uploads/:id/status])
```

## Status Transitions

```mermaid
stateDiagram-v2
    [*] --> pending : document uploaded
    pending --> parsing : worker picks up job
    parsing --> parsed : raw text extracted
    parsed --> extracting : sent to GPT-4o
    extracting --> extracted : structured JSON received
    extracted --> embedding : sent to OpenAI embedder
    embedding --> ready : vector stored in pgvector
    parsing --> failed : parse error
    extracting --> failed : LLM error / timeout
    embedding --> failed : embedding API error
    failed --> pending : manual retry
```

## Retry & Error Handling

```mermaid
flowchart LR
    JOB[BullMQ Job] --> PROC[Process]
    PROC -- success --> DONE([Remove from queue])
    PROC -- error attempt 1 --> RETRY1[Retry after 2s]
    RETRY1 -- error attempt 2 --> RETRY2[Retry after 4s]
    RETRY2 -- error attempt 3 --> RETRY3[Retry after 8s]
    RETRY3 -- error --> DLQ([Dead Letter Queue\n+ status = failed in DB])
```
