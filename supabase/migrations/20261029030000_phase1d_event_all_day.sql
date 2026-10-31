-- ==========================================
-- PHASE 1D REFINEMENT: OPTIONAL EVENT TIME
-- ==========================================
-- Events without a time are stored as all-day dates. The flag lets the UI
-- distinguish them from events that intentionally start at 00:00.

alter table public.events
  add column if not exists is_all_day boolean not null default false;
