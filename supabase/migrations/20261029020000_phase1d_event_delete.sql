-- ==========================================
-- PHASE 1D REFINEMENT: ADMIN EVENT DELETION
-- ==========================================
-- Editing already uses the Phase 1 events UPDATE policy and the Phase 1D
-- grants. Deletion needs its own table grant and RLS policy.

grant delete on table public.events to authenticated;

drop policy if exists "Events deletable by admins" on public.events;

create policy "Events deletable by admins"
  on public.events for delete
  to authenticated
  using (public.is_current_user_admin());
