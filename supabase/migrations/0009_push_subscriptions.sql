-- =============================================================================
-- KELO — 0009 web push subscriptions (Phase 6 — real background notifications)
--
-- Existing notification code (features/notifications/*) is explicitly
-- client-tab-only: it fires while the dashboard is open, nothing else. This
-- adds the real infrastructure for standards-based Web Push (VAPID) so a
-- registered user can receive a notification while KELO isn't open, on
-- whatever platform actually supports it.
--
-- `endpoint` is unique GLOBALLY, not per-user: a push subscription belongs to
-- one browser/device registration with the push service, not to whichever
-- app account happened to create it. If the same browser subscribes again
-- under a different signed-in user (e.g. shared device, account switch), the
-- upsert on `endpoint` reassigns ownership rather than creating a second row
-- — otherwise the old owner could keep receiving that device's pushes
-- forever, which would be a cross-user leak.
--
-- `push_dedupe` gives idempotent "already notified" checks for
-- server-triggered sends (class reminders, attendance warnings) without
-- inventing a scheduling system: a sender does
-- `insert ... on conflict (user_id, dedupe_key) do nothing returning id`
-- and only sends when a row actually came back.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table if not exists public.push_dedupe (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  dedupe_key   text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists push_dedupe_created_idx on public.push_dedupe(created_at);

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions', 'push_dedupe']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on table public.%I from anon, authenticated;', t);
  end loop;
end $$;
