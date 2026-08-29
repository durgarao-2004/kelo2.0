-- =============================================================================
-- KELO — 0004 PIN recovery
--
-- Forgot-PIN flow: KELO never emails the PIN itself. It emails a single-use,
-- short-lived recovery link (via Resend); only a SHA-256 hash of the token is
-- stored, never the token itself, so a DB leak can't be used to reset PINs.
-- =============================================================================

create table if not exists public.pin_recovery_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pin_recovery_tokens_user_idx
  on public.pin_recovery_tokens(user_id, created_at desc);

alter table public.pin_recovery_tokens enable row level security;
alter table public.pin_recovery_tokens force row level security;
revoke all on table public.pin_recovery_tokens from anon, authenticated;
