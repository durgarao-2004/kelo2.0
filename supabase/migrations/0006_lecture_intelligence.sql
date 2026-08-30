-- =============================================================================
-- KELO — 0006 lecture intelligence (Phase 2)
--
-- Analysis is expanded beyond summary/key_concepts/important_points/topics to
-- include structured notes, definitions actually given in the lecture, and
-- examples actually mentioned — all grounded in the transcript, never
-- invented (enforced in the prompt, not the schema).
--
-- The processing pipeline also gets one more explicit status: `finalizing`
-- covers "transcript + analysis are done, just persisting Drive files/index"
-- so a crash there doesn't get misreported as still `analyzing`.
-- =============================================================================

alter table public.summaries
  add column if not exists notes jsonb not null default '[]'::jsonb,
  add column if not exists definitions jsonb not null default '[]'::jsonb,
  add column if not exists examples jsonb not null default '[]'::jsonb;

alter table public.lectures drop constraint if exists lectures_status_check;
alter table public.lectures add constraint lectures_status_check
  check (status in (
    'recording','uploading','uploaded','transcribing','transcribed',
    'analyzing','finalizing','completed','failed','recoverable'
  ));
