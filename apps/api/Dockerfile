# ──── Development stage ────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS development

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 4000
CMD ["bun", "run", "dev"]

# ──── Build stage ──────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY . .

# ──── Production stage ─────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS production

WORKDIR /app

# Only copy production node_modules + source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

EXPOSE 4000
CMD ["bun", "run", "src/index.ts"]
