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
  routes; raise it on paid plans if long lectures need more time.

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
