# KELO — Deployment guide (Vercel)

KELO is a standard Next.js 16 App Router app and deploys cleanly to Vercel.

## 1. Prerequisites

- A Supabase project (this build targets `bhshekmyptwuzypygvjs`).
- A Google Cloud OAuth client (Web application).
- At least one AI provider key (Gemini, OpenAI, Grok, or OpenRouter).

## 2. Supabase

1. Apply `supabase/migrations/0001_init.sql` then `0002_rag.sql`
   (see `supabase/README.md` — SQL editor, CLI, or psql).
2. Auth is custom (email + 6-digit PIN); no Supabase Auth config is needed.
3. RLS is enabled + forced on every table with no public policies — all access
   is server-side via the service-role key.

## 3. Google OAuth (Drive only)

1. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).
2. Enable the **Google Drive API**.
3. Authorized redirect URIs:
   - `http://localhost:3000/api/drive/callback` (dev)
   - `https://YOUR_DOMAIN/api/drive/callback` (prod)
4. Scopes used: `drive.file`, `userinfo.email`, `openid` (least privilege).
5. Set `GOOGLE_OAUTH_REDIRECT_URI` to match the environment you deploy.

## 4. Environment variables (Vercel → Project → Settings → Environment Variables)

Copy names from `.env.example`. Client-exposed (safe) vs server-only (secret):

**Public (NEXT_PUBLIC_\*)** — safe to expose:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

**Server-only** — never expose, never prefix with NEXT_PUBLIC:
`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (>=32 chars; `openssl rand -base64 48`),
`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
`GEMINI_API_KEY`, `GROK_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
and optional model overrides `GEMINI_MODEL`, `OPENAI_MODEL`, `GROK_MODEL`,
`OPENROUTER_MODEL`.

> Rotate every secret that was ever shared outside a secret manager.

### Web Push (real browser/PWA notifications)

Apply `supabase/migrations/0009_push_subscriptions.sql` (SQL editor, CLI, or
psql — same as the other migrations) before this works; without it, the
Settings notifications toggle degrades to "notifications aren't supported"
since `getServerEnvDiagnostics().push` and the client subscribe call both
fail closed rather than pretending to work.

1. Generate a VAPID keypair: `npx web-push generate-vapid-keys`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public), `VAPID_PRIVATE_KEY` (secret,
   server-only), and `VAPID_SUBJECT` (a `mailto:` or `https:` contact —
   push services may use it to reach you about a misbehaving sender).
3. Set `CRON_SECRET` (`openssl rand -base64 32`) — authenticates the
   `/api/push/dispatch` sweep (class reminders + attendance warnings) so it
   can run without a signed-in user.
4. `vercel.json` schedules Vercel Cron to hit `/api/push/dispatch` once
   daily (`0 6 * * *`) — **Vercel Hobby caps Cron Jobs at once per day**; a
   more frequent schedule fails deployment validation outright, it doesn't
   just run slower. Vercel automatically sends
   `Authorization: Bearer $CRON_SECRET` on that request.

**This means Vercel's own free cron alone gives you a once-daily sweep, not
real-time class reminders.** That's still correct and useful for attendance
warnings (not time-sensitive — the per-day dedupe key caps it at one per
subject per day regardless of how often the sweep runs). It is genuinely not
enough to catch a "class starting in 15 minutes" moment for classes spread
across the day — no clever logic fixes that with only one sample a day, and
this isn't a case where a bigger number would help even on a paid plan; it's
inherent to the sampling rate. `/api/push/dispatch` is intentionally
cadence-agnostic (idempotent per-day dedupe, and its eligibility window
tolerates being invoked late or having runs skipped) specifically so you can
point ANY external scheduler at it more often without touching the app:
cron-job.org, a GitHub Actions scheduled workflow, UptimeRobot's free tier,
etc., hitting `POST /api/push/dispatch` every ~5 minutes with header
`x-cron-secret: $CRON_SECRET`. All free; none of them require a paid Vercel
plan or app changes.

Lecture-completed/failed pushes fire immediately from the processing
pipeline (no cron involved) — unaffected by any of the above, since those
don't depend on a sweep at all.

**Known limitation:** reminder timing uses the server's own clock — there is
no per-user timezone column, so a deployment serving students across
timezones will send reminders at the wrong local time for anyone not in the
server's timezone. Fine for a single-region deployment; a real fix needs a
timezone field added to the schema.

## 5. Deploy

```bash
# Local sanity check first
npm ci
npm run check      # typecheck + lint + test + build

# Then: push to a Git repo and import into Vercel, or
vercel --prod
```

- Build command: `next build` (default). Install: `npm ci`.
- Node.js 20+ runtime (Next 16 requirement).
- API routes that use Node crypto / large uploads run on the Node.js runtime
  (declared per-route). `maxDuration` is set on the recording upload/process
  routes, capped at 300s to stay within Vercel Hobby's hard limit (1-300s —
  a higher value fails deployment validation, not just runtime behavior).
  The lecture-processing pipeline is resumable, so a job that outlives one
  request's budget is safely continued on retry. Paid plans allow a higher
  ceiling if that resumable-retry behavior is ever not enough.

## 6. Post-deploy verification

1. `GET /api/health` → `ok: true` with `supabase.usersTable: true`.
2. `GET /api/ai/health` (signed in) → at least one provider `true`.
3. Sign up (email + PIN) → dashboard.
4. Settings → Connect Google Drive → consent → folders auto-created.
5. Record a short lecture → it uploads and processes into the library.

## 7. Notes

- `SESSION_SECRET` also derives the key that encrypts stored Drive tokens —
  rotating it signs users out and requires reconnecting Drive.
- The `vector` extension (0002) is optional; without it, full-text search still
  powers retrieval.
