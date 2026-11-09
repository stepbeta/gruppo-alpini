-- ==========================================
-- PENDING PROFILE VISIBILITY
-- ==========================================
-- Pending registrations must be visible only to administrators and to the
-- pending account itself. Approved members continue to see approved profiles,
-- and rejected rows keep their existing visibility (administrators and the row
-- owner).
--
-- The approval migration already expressed this intent. This migration
-- reasserts it in two layers so an older or accidentally broadened select
-- policy cannot expose pending rows again:
--   1. recreate the permissive select policy with an explicit status check;
--   2. add a restrictive select guard that filters pending rows even if another
--      permissive policy is present.
--
-- `is_current_user_admin()` is SECURITY DEFINER for the usual recursion reason:
-- a policy on `profiles` that queried `profiles` directly would re-enter the
-- same policy. It remains the single privileged check.

drop policy if exists "Public profiles are viewable by authenticated users."
  on public.profiles;
drop policy if exists "Approved members can view profiles"
  on public.profiles;
drop policy if exists "Pending profiles are visible only to admins and self"
  on public.profiles;

create policy "Approved members can view profiles"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_current_user_admin()
    or (
      public.is_current_user_approved()
      and approval_status = 'approved'
    )
  );

create policy "Pending profiles are visible only to admins and self"
  on public.profiles as restrictive for select
  to authenticated
  using (
    approval_status <> 'pending'
    or auth.uid() = id
    or public.is_current_user_admin()
  );
