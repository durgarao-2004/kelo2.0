# KELO — Build Status

Legend: **PASS** / **FAIL** / **BLOCKED**

Quality gate per phase: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

| Phase | Area                          | Status | Tests | Notes |
| ----- | ----------------------------- | ------ | ----- | ----- |
| 1     | Project foundation            | PASS   | PASS  | Next 16 / React 19 / TS / Tailwind / Vitest. 0 npm vulnerabilities. |
| 2     | Supabase + environment        | PASS\* | PASS  | Clients + schema + RLS + types + /api/health build/typecheck/lint pass. \*Applying SQL to live DB is **BLOCKED** (sandbox egress + no DB creds) — see supabase/README.md. |
| 3     | Email + 6-digit PIN auth      | PASS\* | PASS  | 30 unit tests (PIN rules, session JWT, signup/login/lockout/reset). Live middleware redirect verified locally (`/dashboard`→`/login`). \*Live signup vs Supabase **BLOCKED** by egress allowlist + no DB creds. |
| 4     | Dashboard                     | PASS   | PASS  | Next class / today timeline (client tz-correct), overall attendance ring, derived insights, recent lectures, Drive card. |
| 5     | Timetable + attendance        | PASS   | PASS  | Subjects + weekly schedule CRUD with overlap detection; attendance marking + calculations. 26 domain tests. Reads degrade gracefully when backend unreachable. |
| 6     | Recording                     | PASS\* | PASS  | Real MediaRecorder capture (timer, waveform, pause/resume, permission + error handling); state machine + upload retry/recovery (10 tests); honest save seam (409 when Drive off, local download fallback). \*Live mic capture needs a real browser — **BLOCKED** in headless sandbox. |
| 7     | Google Drive                  | PASS\* | PASS  | Server-side OAuth (connect/callback/disconnect), AES-256-GCM token encryption + refresh, auto folder tree with dedupe cache, multipart upload, save pipeline, settings UI. Folder-plan + crypto = 9 tests. \*Live OAuth needs human consent + egress — **BLOCKED**. |
| 8     | AI router + features          | PASS\* | PASS  | Task-based router (Gemini→OpenAI→Grok→OpenRouter) with fallback (8 tests), real providers, lecture analysis (title/summary/concepts/revision), transcription (Whisper→Gemini), defensive JSON parse (7 tests). \*Live provider calls **BLOCKED** by egress. |
| 9     | Search / RAG                  | PASS\* | PASS  | Chunking (5 tests), FTS retrieval RPC scoped per-user, "Ask my lectures" grounded answers with sources, search UI, chunk indexing, full processing pipeline. \*Live retrieval/embeddings need the DB + AI — **BLOCKED**. |
| 10-12 | Premium UI / audit / prod     | PASS   | PASS  | Premium landing (motion + subtle hero), lecture library (list + detail with summary/revision/transcript), responsive app shell + mobile nav. Security audit: **0 secrets in client bundle**, 0 npm vulnerabilities, RLS enforced, tokens encrypted. `npm run check` green. Vercel/Supabase/Google docs in DEPLOYMENT.md. |

## Stack (pinned)

- next 16.3.3, react 19.2.8 (App Router, Server Actions)
- @supabase/supabase-js 2.112.4
- bcryptjs 3.0.3 (PIN hashing), jose 6.2.10 (session signing)
- framer-motion 12.43.0, lucide-react 1.35.0
- zod 4.4.3 (validation), tailwindcss 3.4.10
- vitest 4.1.11 (node env), eslint 9 + eslint-config-next 16

## Environment constraint (why some steps are BLOCKED)

The build sandbox enforces a **network egress allowlist**: only package
registries are reachable. Every external service returns
`403 "Host not in allowlist"`. So from here I cannot: apply SQL to live
Supabase, run Google OAuth, or make live AI/upload calls. All such code is
built + unit-tested with injected fakes; live verification is deferred to your
environment. Hosts to allowlist (egress settings) or run from your machine:

- `bhshekmyptwuzypygvjs.supabase.co` (+ DB host for DDL)
- `generativelanguage.googleapis.com`, `oauth2.googleapis.com`, `www.googleapis.com`
- `api.openai.com`, `api.x.ai`, `openrouter.ai`

## Known issues

- Live secrets were shared in chat → user to rotate all keys before production.

## Tests

91 passing across: PIN rules, session JWT, auth signup/login/lockout/reset,
attendance math, timetable overlap + class status, recorder state machine +
upload retry, Drive folder planning + token crypto, AI router fallback,
JSON parsing, and RAG chunking. `npm run check` (typecheck + lint + test +
build) is green.

## What YOU must verify live (BLOCKED here — needs your environment)

Everything below is fully coded + unit-tested; only live execution is blocked by
the sandbox egress allowlist and human-auth steps.

1. Apply `supabase/migrations/0001_init.sql` + `0002_rag.sql` (SQL editor).
2. `npm run dev`, then `GET /api/health` → `ok:true`.
3. Sign up (email + PIN) → dashboard; sign out; sign in; hit a protected route.
4. Settings → Connect Google Drive → consent → confirm folder tree is created.
5. Record a short lecture → confirm upload + processing (transcript/summary).
6. `GET /api/ai/health` (signed in) → a provider is `true`; ask a lecture question.

## Definition of done (this build)

Installs clean · env validation works · typecheck/lint/test/build pass ·
0 npm vulnerabilities · 0 server secrets in the client bundle · auth, dashboard,
timetable, attendance, recording, Drive, AI router+fallback, search/RAG all
implemented with real functionality (no fake success states) · responsive ·
Vercel deployment documented. Remaining items are the live-service checks above,
which require your credentials/consent and an unrestricted network.
