# LeadForge Pro — Base44 Dev Environment

## What this is
A single-process fullstack B2B lead-gen app: Express API + React/Vite frontend
served via Vite middleware mode (dev), PostgreSQL (Prisma ORM), Redis (BullMQ).

## Architecture
- **Single origin**: `server.ts` runs both the API and the Vite dev server (middleware
  mode). Everything is on port 3000 — no separate API port.
- **Dev mode** (`NODE_ENV=development`): `tsx server.ts` boots Vite middleware for
  live frontend HMR. Backend changes require a service restart.
- **Production mode** (`NODE_ENV=production`): serves prebuilt `dist/` bundle.

## Services (docker-compose.base44.yml)
- `app` — node:22-alpine, bind-mounted source, runs `npx tsx server.ts`
- `setup` — one-shot: `npm install && npx prisma generate`
- `migrate` — one-shot: `npx prisma migrate deploy` (runs after setup + postgres)
- `postgres` — postgres:16-alpine
- `redis` — redis:7-alpine

## Secrets
All required secrets are **locally generated crypto material** (JWT, encryption
keys, webhook HMAC secrets, owner password, DB password) — none are external
service credentials. They are set inline in the compose `environment:` block.

Optional external integrations (disabled by default, not required to boot):
- `OLLAMA_API_KEY` — local LLM (Ollama). Empty = disabled.
- `HUNTER_API_KEY` — Hunter.io email enrichment. Disabled (`HUNTER_DISCOVERY_ENABLED=false`).

## Key env vars
- `CONTAINERIZED=true` — makes the app connect to `postgres:5432` instead of localhost
- `LOCAL_ONLY_MODE=true` — safe default; blocks public URLs, non-loopback CORS, live SMTP
- `DISABLE_HMR=false` — enables Vite HMR for frontend live reload
- `HOST=0.0.0.0` — binds to all interfaces (required for Docker port mapping)

## Vite config note
`vite.config.ts` has `server.allowedHosts: true` so the preview's external hostname
(changes per environment) is accepted. Without this, Vite returns 403 for the preview origin.

## Verification
- Health: `curl http://localhost:3000/api/health/live` → `{"status":"alive",...}`
- Frontend: `curl -H "Host: 3000-$BASE44_PUBLIC_HOST_SUFFIX" http://localhost:3000/`
  returns the Vite-served HTML with HMR client.
- Login: owner@example.com / (password in compose env: OWNER_PASSWORD)
