-- =============================================================================
-- KELO — 0008 lecture concepts (Phase 4 — textbook-grounded knowledge)
--
-- Stores ONLY the result of matching a lecture's extracted concepts against
-- the code-level textbook registry (src/config/textbooks.ts) — never
-- textbook text itself. `textbook_subject_key` points into that static
-- config (not a DB row), so this table stays tiny and requires no book
-- content to be stored anywhere.
--
-- `textbook_status` mirrors features/knowledge/textbook-match.ts's
-- ConceptTextbookMatch:
--   not_configured — subject has no textbook mapped
--   pending        — textbook mapped but its metadata isn't verified yet
--   unverified     — textbook verified, but this concept isn't a known topic
--   verified       — concept matches a known topic in a verified textbook
-- =============================================================================

create table if not exists public.lecture_concepts (
  id                   uuid primary key default gen_random_uuid(),
  lecture_id           uuid not null references public.lectures(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  subject_id           uuid references public.subjects(id) on delete set null,
  concept              text not null,
  lecture_connection   text,
  textbook_subject_key text,
  textbook_status      text not null default 'not_configured'
                          check (textbook_status in ('not_configured','pending','unverified','verified')),
  textbook_explanation text,
  created_at           timestamptz not null default now(),
  unique (lecture_id, concept)
);
create index if not exists lecture_concepts_user_idx on public.lecture_concepts(user_id);
create index if not exists lecture_concepts_lecture_idx on public.lecture_concepts(lecture_id);
create index if not exists lecture_concepts_concept_idx on public.lecture_concepts(user_id, concept);

alter table public.lecture_concepts enable row level security;
alter table public.lecture_concepts force row level security;
revoke all on table public.lecture_concepts from anon, authenticated;
