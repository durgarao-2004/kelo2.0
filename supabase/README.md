# KELO — Supabase setup

KELO uses Supabase as its cloud backend. Auth is **custom email + 6-digit PIN**
(not Supabase Auth), so every table is locked to **server-only** access:
Row Level Security is enabled + forced with no policies, and privileges are
revoked from the `anon`/`authenticated` roles. The app reaches the database only
from the server using the **service-role** key, scoping every query by `user_id`.

## Apply the migrations

Run the files in `supabase/migrations/` **in order**. Pick one method:

### A. Supabase SQL editor (no extra tooling)

1. Open your project → **SQL editor** → **New query**.
2. Paste the full contents of `0001_init.sql`, run it.
3. Paste `0002_rag.sql`, run it.
   - If your plan lacks the `vector` extension, remove the `embedding` column,
     the `hnsw` index, and `match_lecture_chunks`; full-text search still works.

### B. Supabase CLI

```bash
supabase link --project-ref bhshekmyptwuzypygvjs
supabase db push        # applies supabase/migrations in order
```

### C. psql (needs the DB connection string / password)

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rag.sql
```

## Verify

With the dev server running and `.env.local` filled:

```bash
curl -s localhost:3000/api/health | jq
```

Expect `"supabase": { "reachable": true, "usersTable": true }` and `"ok": true`.

## Regenerating types (optional)

`src/lib/supabase/types.ts` is hand-maintained to match these migrations. To
regenerate from the live DB instead:

```bash
supabase gen types typescript --project-id bhshekmyptwuzypygvjs > src/lib/supabase/types.ts
```
