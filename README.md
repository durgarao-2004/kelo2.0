# KELO

A premium academic class companion:
**Classes → Record → Organize → Transcribe → Understand → Revise → Track attendance.**

Record lectures in the browser, auto-organize them into Google Drive, get
AI transcripts, summaries and revision material, ask questions grounded in your
own lectures, and track attendance against each subject's requirement.

## Stack

- **Next.js 16** (App Router, Server Actions) · **React 19** · **TypeScript**
- **Tailwind CSS** · **Framer Motion** · **lucide-react**
- **Supabase** (Postgres + RLS) as the cloud backend
- **Zod** validation · **jose** sessions · **bcryptjs** PIN hashing
- **Vitest** for business-logic tests

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in real values
# apply supabase/migrations/*.sql to your Supabase project (see supabase/README.md)
npm run dev                     # http://localhost:3000
```

## Commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server                          |
| `npm run typecheck` | `tsc --noEmit`                                 |
| `npm test`          | Run the Vitest suite                          |
| `npm run lint`      | ESLint (flat config)                          |
| `npm run build`     | Production build                              |
| `npm run check`     | typecheck + lint + test + build (quality gate)|

## Architecture

```
src/
  app/                 App Router (public landing, (auth), (app) protected, api routes)
  components/          UI: app shell, auth, timetable, attendance, recording, lectures, search, marketing
  features/            Pure domain logic (attendance, timetable, recording, drive, ai, search) — unit-tested
  lib/                 env validation, supabase clients, crypto, utils
  server/              Server-only: auth, db access, drive, ai, recordings, search
supabase/migrations/   SQL schema + RLS + RAG
```

Authentication is **email + 6-digit PIN** (not Supabase Auth). Every table is
locked to server-only access via RLS; the app reaches the database only through
the service-role key with per-user scoping.

## Security

- Server secrets never reach the browser (verified: 0 leaks in the client bundle).
- RLS enabled + forced on all tables; privileges revoked from anon/authenticated.
- Drive OAuth tokens encrypted at rest (AES-256-GCM).
- Signed, httpOnly session cookies; PIN lockout after repeated failures.

See **BUILD_STATUS.md** for phase-by-phase verification and **DEPLOYMENT.md**
for Vercel + Supabase + Google setup.
