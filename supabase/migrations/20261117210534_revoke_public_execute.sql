-- Revoke EXECUTE on SECURITY DEFINER functions that no client is meant to call.
--
-- `create function` grants EXECUTE to PUBLIC by default, so each of these was
-- reachable through /rest/v1/rpc/<name> as both anon and authenticated. All of
-- them are trigger functions or helpers invoked from inside other SECURITY
-- DEFINER code. Trigger invocation does not check EXECUTE, and a SECURITY
-- DEFINER caller checks privileges as its owner, so revoking removes them from
-- the public API surface without changing behaviour.
--
-- Deliberately left executable by authenticated:
--   is_current_user_admin(), is_current_user_approved(), has_accepted_privacy_consent()
--     RLS policy expressions are evaluated as the caller, so revoking these would
--     break the policy matrix. They are read-only lookups about the caller.
--   export_user_data(uuid)
--     The GDPR export RPC; it enforces self-or-administrator internally.
--   rls_auto_enable()
--     Supabase-owned event trigger, recreated by platform migrations.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_event_created_by() from public, anon, authenticated;
revoke execute on function public.protect_profile_approval_status() from public, anon, authenticated;
revoke execute on function public.protect_profile_admin_management() from public, anon, authenticated;
revoke execute on function public.prevent_profile_admin_escalation() from public, anon, authenticated;

-- Only ever called from protect_profile_admin_management(), which is SECURITY
-- DEFINER and therefore runs with the owner's privileges.
revoke execute on function public.count_current_admins() from public, anon, authenticated;

-- The UPDATE policy used `using (true)` with `with check (is_current_user_admin())`.
-- The check already rejected non-administrators, but `using (true)` made every
-- authenticated caller scan rows before failing, and the asymmetry obscured the
-- rule. Align the two halves; the WITH CHECK clause is unchanged.
alter policy "Organization settings editable by administrators"
  on public.organization_settings
  using (public.is_current_user_admin());
