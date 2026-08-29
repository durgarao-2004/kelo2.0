-- =============================================================================
-- KELO — 0003 lecture status pipeline
--
-- The processing pipeline needs finer-grained, honest states so a lecture is
-- never shown as "Completed" when transcription/analysis actually failed:
--   recording -> uploading -> uploaded -> transcribing -> transcribed
--             -> analyzing -> completed
--                           -> recoverable (failed downstream of a saved
--                              recording; preserved, user can retry)
--                           -> failed (the recording itself was never saved)
-- =============================================================================

-- Backfill any existing rows using statuses removed by the new constraint.
update public.lectures set status = 'uploading' where status = 'processing';
update public.lectures set status = 'analyzing' where status = 'summarizing';

alter table public.lectures drop constraint if exists lectures_status_check;
alter table public.lectures add constraint lectures_status_check
  check (status in (
    'recording','uploading','uploaded','transcribing','transcribed',
    'analyzing','completed','failed','recoverable'
  ));
