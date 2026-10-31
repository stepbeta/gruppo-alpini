-- ==========================================
-- PHASE 1E: GENERIC REQUESTS & SECRETARIAT BOARD
-- ==========================================
-- The Phase 1 schema created `generic_requests` with RLS policies, but
-- Supabase does not expose new tables to the API roles automatically. Without
-- these grants every request query fails with 42501.

grant select, insert on table public.generic_requests to authenticated;

-- Members can only submit requests; administrators only change the status.
-- A column-level grant makes the intended mutation explicit and prevents an
-- accidental message or owner rewrite through the API.
grant update (status) on table public.generic_requests to authenticated;

-- Make sure every row has a valid status before enforcing NOT NULL.
update public.generic_requests
set status = 'open'
where status is null;

alter table public.generic_requests
  alter column status set default 'open';

alter table public.generic_requests
  alter column status set not null;

-- Use the shared SECURITY DEFINER helper so the admin check stays consistent
-- with the profile, event, and response policies.
drop policy if exists "Users can view their own requests"
  on public.generic_requests;

create policy "Users can view their own requests or admins all"
  on public.generic_requests for select
  to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Admins can update request status"
  on public.generic_requests;

create policy "Admins can update request status"
  on public.generic_requests for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- Supports the personal list (newest first) and the secretariat board filters.
create index if not exists generic_requests_user_created_idx
  on public.generic_requests (user_id, created_at desc);

create index if not exists generic_requests_status_created_idx
  on public.generic_requests (status, created_at desc);
