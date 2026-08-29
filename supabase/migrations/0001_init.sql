-- =============================================================================
-- KELO — 0001 core schema
--
-- Auth model: KELO uses its OWN email + 6-digit PIN auth (NOT Supabase Auth),
-- so there is no auth.uid() to base RLS on. Instead:
--   * RLS is ENABLED (and FORCED) on every table with NO permissive policies,
--     so the anon/authenticated PostgREST roles get ZERO row access.
--   * All privileges are REVOKED from anon/authenticated for defense in depth.
--   * The app reaches these tables ONLY from the server via the service-role
--     key (which bypasses RLS), and every server query is scoped by user_id.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------- updated_at trigger helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- users ----------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  pin_hash        text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  session_version integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email))
);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ---------- subjects ----------
create table if not exists public.subjects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  name               text not null,
  color              text not null default '#4f46e5',
  target_attendance  numeric(5,2) not null default 75 check (target_attendance >= 0 and target_attendance <= 100),
  year               integer,
  semester           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists subjects_user_idx on public.subjects(user_id);
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------- schedule_entries (recurring weekly timetable) ----------
-- Times stored as minutes-from-midnight (0..1440) for reliable overlap math.
create table if not exists public.schedule_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_minute  smallint not null check (start_minute between 0 and 1439),
  end_minute    smallint not null check (end_minute between 1 and 1440),
  location      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint schedule_valid_range check (end_minute > start_minute)
);
create index if not exists schedule_user_idx on public.schedule_entries(user_id);
create index if not exists schedule_user_day_idx on public.schedule_entries(user_id, day_of_week);
create trigger schedule_set_updated_at before update on public.schedule_entries
  for each row execute function public.set_updated_at();

-- ---------- attendance_records ----------
create table if not exists public.attendance_records (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  subject_id        uuid not null references public.subjects(id) on delete cascade,
  schedule_entry_id uuid references public.schedule_entries(id) on delete set null,
  occurred_on       date not null,
  status            text not null check (status in ('attended','missed','cancelled')),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists attendance_user_subject_idx on public.attendance_records(user_id, subject_id);
create index if not exists attendance_user_date_idx on public.attendance_records(user_id, occurred_on);
-- One record per subject/day/slot (nulls treated distinct by Postgres — fine).
create unique index if not exists attendance_unique_slot
  on public.attendance_records(user_id, subject_id, occurred_on, schedule_entry_id);
create trigger attendance_set_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------- lectures (recordings) ----------
create table if not exists public.lectures (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  subject_id               uuid references public.subjects(id) on delete set null,
  title                    text,
  status                   text not null default 'recording'
                             check (status in ('recording','processing','uploading','transcribing','summarizing','completed','failed')),
  recorded_at              timestamptz not null default now(),
  duration_seconds         integer not null default 0 check (duration_seconds >= 0),
  drive_recording_file_id  text,
  drive_transcript_file_id text,
  drive_summary_file_id    text,
  error                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists lectures_user_idx on public.lectures(user_id);
create index if not exists lectures_user_subject_idx on public.lectures(user_id, subject_id);
create index if not exists lectures_user_recorded_idx on public.lectures(user_id, recorded_at desc);
create trigger lectures_set_updated_at before update on public.lectures
  for each row execute function public.set_updated_at();

-- ---------- transcripts ----------
create table if not exists public.transcripts (
  id         uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null default '',
  language   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lecture_id)
);
create index if not exists transcripts_user_idx on public.transcripts(user_id);
create trigger transcripts_set_updated_at before update on public.transcripts
  for each row execute function public.set_updated_at();

-- ---------- summaries ----------
create table if not exists public.summaries (
  id               uuid primary key default gen_random_uuid(),
  lecture_id       uuid not null references public.lectures(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  summary          text,
  key_concepts     jsonb not null default '[]'::jsonb,
  important_points jsonb not null default '[]'::jsonb,
  topics           jsonb not null default '[]'::jsonb,
  revision         jsonb not null default '{}'::jsonb,
  model            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (lecture_id)
);
create index if not exists summaries_user_idx on public.summaries(user_id);
create trigger summaries_set_updated_at before update on public.summaries
  for each row execute function public.set_updated_at();

-- ---------- drive_connections ----------
-- Tokens are stored ENCRYPTED (AES-256-GCM) by the app before insert.
create table if not exists public.drive_connections (
  user_id           uuid primary key references public.users(id) on delete cascade,
  access_token_enc  text not null,
  refresh_token_enc text,
  token_expiry      timestamptz,
  scope             text,
  google_email      text,
  root_folder_id    text,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger drive_connections_set_updated_at before update on public.drive_connections
  for each row execute function public.set_updated_at();

-- ---------- drive_folders (cache of the created folder tree) ----------
create table if not exists public.drive_folders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  path            text not null,
  drive_folder_id text not null,
  created_at      timestamptz not null default now(),
  unique (user_id, path)
);
create index if not exists drive_folders_user_idx on public.drive_folders(user_id);

-- ---------- user_settings ----------
create table if not exists public.user_settings (
  user_id            uuid primary key references public.users(id) on delete cascade,
  recording_prefs    jsonb not null default '{}'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  ai_prefs           jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security: lock every table to server-only (service-role) access.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','subjects','schedule_entries','attendance_records',
    'lectures','transcripts','summaries','drive_connections',
    'drive_folders','user_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on table public.%I from anon, authenticated;', t);
  end loop;
end $$;
