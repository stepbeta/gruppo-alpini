-- ==========================================
-- RSVP GUEST COUNT
-- ==========================================
-- Members may declare how many guests they bring to an event. The count
-- belongs to the response, not to an individual guest, so guests always
-- follow the member's status. An absent response keeps the stored value but
-- contributes nothing to the attendance totals.
--
-- The existing grants on public.event_responses are table-level
-- (`grant select, insert, update ... to authenticated` in
-- 20261029010000_phase1d_events_rsvp.sql), so the new column is covered
-- without additional grants, policies, or indexes.

alter table public.event_responses
  add column guest_count integer not null default 0;

alter table public.event_responses
  add constraint event_responses_guest_count_check
  check (guest_count >= 0);

comment on column public.event_responses.guest_count is
  'Number of guests declared by the member. Guests follow the member status; absent responses keep the value but do not contribute to attendance totals.';
