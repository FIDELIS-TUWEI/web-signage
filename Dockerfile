# syntax=docker/dockerfile:1
# ────────────────────────────────────────────────────────────────────────────
#  Web Signage — Backend (Express / Node.js)
#  node:22-slim (Debian-slim, glibc) for the deps stage.
#  distroless/nodejs22-debian12 for the final runtime — no shell, minimal CVEs.
# ────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ── Stage 2: distroless runtime ──────────────────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./backend/
COPY package.json ./

# distroless nonroot uid 65532 — no adduser needed
USER nonroot

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:5000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["backend/server.js"]
