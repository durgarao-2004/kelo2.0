-- =============================================================================
-- KELO — 0005 resilient recording sessions
--
-- Phase 1 (bulletproof recording): a lecture recording is no longer uploaded
-- as one giant blob at the end. The browser persists every MediaRecorder
-- chunk locally (IndexedDB) and uploads chunks independently as they're
-- produced; the server stages each chunk in Storage and only assembles +
-- uploads to Drive once, in a `finalize` step, when all chunks are present.
--
-- `recording_sessions` is the source of truth for one recording attempt:
--   recording -> finalizing -> uploaded
--                            -> failed (retryable; chunks are preserved)
-- `recording_chunk_meta` tracks which chunk indexes have safely landed in
-- Storage (bucket `recording-chunks`), so finalize can detect gaps and the
-- primary key gives natural de-duplication for re-sent chunks.
-- =============================================================================

create table if not exists public.recording_sessions (
  id                uuid primary key,
  user_id           uuid not null references public.users(id) on delete cascade,
  subject_id        uuid references public.subjects(id) on delete set null,
  title             text,
  mime_type         text not null,
  status            text not null default 'recording'
                       check (status in ('recording','finalizing','uploaded','failed')),
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  lecture_id        uuid references public.lectures(id) on delete set null,
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists recording_sessions_user_idx on public.recording_sessions(user_id);
create trigger recording_sessions_set_updated_at before update on public.recording_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.recording_chunk_meta (
  session_id  uuid not null references public.recording_sessions(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  size_bytes  integer not null check (size_bytes >= 0),
  created_at  timestamptz not null default now(),
  primary key (session_id, chunk_index)
);
create index if not exists recording_chunk_meta_session_idx
  on public.recording_chunk_meta(session_id);

-- ---------- Storage: private bucket for staged chunk bytes ----------
-- Objects are named `{session_id}/{chunk_index}`. Same security model as
-- every other table here: no policies for anon/authenticated, so only the
-- server (service-role key, bypasses Storage RLS same as Postgres RLS)
-- can read or write chunks.
insert into storage.buckets (id, name, public, file_size_limit)
values ('recording-chunks', 'recording-chunks', false, 26214400)
on conflict (id) do nothing;

alter table public.recording_sessions enable row level security;
alter table public.recording_sessions force row level security;
revoke all on table public.recording_sessions from anon, authenticated;

alter table public.recording_chunk_meta enable row level security;
alter table public.recording_chunk_meta force row level security;
revoke all on table public.recording_chunk_meta from anon, authenticated;
