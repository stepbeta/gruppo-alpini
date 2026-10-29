-- ==========================================
-- PHASE 1D: EVENTS AND RSVP
-- ==========================================
-- The Phase 1 schema already created `events` and `event_responses` with RLS
-- policies, but Supabase does not expose new tables to the API roles
-- automatically. Without these grants every event query fails with 42501.

grant select, insert, update on table public.events to authenticated;
grant select, insert, update on table public.event_responses to authenticated;

-- Members only need their own response. Administrators need every response to
-- show attendance totals on each event. The existing FOR ALL policy already
-- grants owners SELECT access, so the broad select policy is no longer needed.
drop policy "Responses viewable by authenticated users" on public.event_responses;

create policy "Responses viewable by admins"
  on public.event_responses for select
  to authenticated
  using (public.is_current_user_admin());

-- Supports upcoming/past event ordering as the calendar grows.
create index if not exists events_event_date_idx
  on public.events (event_date);
