-- =============================================================================
-- KELO — 0007 attendance session totals (Phase 3)
--
-- Attendance previously had no concept of a total planned session count for
-- a subject — percentage/safe-skips were derived purely from raw
-- attended/missed tallies with no ceiling. Adds a per-subject
-- `total_sessions` (defaults to 33, the common semester norm, but is a
-- normal editable column so any course length works) used to validate that
-- sessions conducted never exceeds the plan and to compute remaining
-- sessions / a properly bounded "safe to miss" figure.
-- =============================================================================

alter table public.subjects
  add column if not exists total_sessions integer not null default 33
    check (total_sessions > 0);
