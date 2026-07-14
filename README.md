# CourtReach

AI-powered sales outreach tool that finds racquet-sport clubs (badminton, tennis, pickleball, squash) across a region, locates the right management contact, verifies them with AI, drafts and sends personalised outreach, and tracks everything on a shared team dashboard.

## Architecture

A pnpm monorepo with three packages:

- **`apps/web`** - Next.js (App Router) + React + Tailwind dashboard.
- **`apps/api`** - Express.js REST API + BullMQ workers (discovery, verification, outreach, reply polling).
- **`packages/shared`** - Shared TypeScript types and Zod schemas used by both apps.

```
Discovery (OpenStreetMap Overpass + scraping + Hunter.io)
  -> Verification (MX/DNS check + AI cross-reference)
  -> Outreach (AI draft + SMTP send + follow-ups)
  -> Dashboard (pipeline board, review queue, analytics)
```

## Prerequisites

- Node.js 20+ and pnpm 9+
- PostgreSQL 14+ (local install or a free cloud DB such as Neon)
- Redis 6+ (local install or a free cloud Redis such as Upstash) - required for the job queue

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in DATABASE_URL, REDIS_URL, JWT_SECRET, and any API keys
pnpm db:generate
pnpm db:migrate        # creates the schema
```

### Required env

- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` - always required.

### Optional integrations (graceful fallbacks if missing)

- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - AI verification + drafting (falls back to heuristics).
- `HUNTER_API_KEY` - contact discovery (falls back to website-scraped emails only).
- `SMTP_*` - real email sending (falls back to a logging stub).
- `IMAP_*` - reply detection (skipped if unset).

## Running (development)

Open three terminals (or run in the background):

```bash
pnpm dev:api       # Express API on http://localhost:4000
pnpm --filter @courtreach/api dev:worker   # BullMQ workers
pnpm dev:web       # Next.js on http://localhost:3000
```

Then register a workspace at http://localhost:3000/register, create a campaign, and run discovery.

## Useful scripts

- `pnpm db:studio` - open Prisma Studio.
- `pnpm db:seed` - create a demo account (`demo@courtreach.local` / `password123`).
- `pnpm typecheck` - type-check all packages.
- `pnpm build` - production build of all packages.

## Compliance note

Cold B2B outreach is regulated (CAN-SPAM in the US, CASL in Canada/Ontario). Always include a real
physical address and an unsubscribe option in your template, and respect opt-outs.
