-- ==========================================
-- ADMIN MANAGEMENT: CAP AND SELF-DEMOTION GUARD
-- ==========================================
-- Administrators are promoted and demoted in-app from /iscritti. The role
-- remains profiles.is_admin; the existing
-- profiles_prevent_admin_escalation trigger still blocks non-admin changes.
-- This migration adds only two invariants on top of that guard:
--   * at most four administrators may coexist;
--   * an administrator cannot revoke their own role.
--
-- The count helper is SECURITY DEFINER for the same reason as
-- is_current_user_admin(): a count on profiles executed inside a profiles
-- trigger would re-enter the profiles RLS policies. The helper bypasses RLS
-- for one narrow count and exposes nothing else.
--
-- Trigger order matters. PostgreSQL fires same-timing triggers in alphabetical
-- order, so profiles_prevent_admin_escalation runs before
-- profiles_protect_admin_management. A non-admin is therefore rejected by the
-- existing permission guard before the cap check can run. The approval trigger
-- remains independent and continues to protect approval_status.

create or replace function public.count_current_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where is_admin = true;
$$;

revoke all on function public.count_current_admins() from public;
grant execute on function public.count_current_admins() to authenticated;

comment on function public.count_current_admins() is
  'Counts administrators without recursive RLS evaluation. Used only by the administrator-management trigger.';

create or replace function public.protect_profile_admin_management()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.jwt() ->> 'role', '');
  admin_count integer;
begin
  if tg_op = 'UPDATE'
     and old.is_admin is not true
     and new.is_admin is true
  then
    -- Serialize promotions so two concurrent transactions cannot both pass the
    -- count and create a fifth administrator.
    perform pg_advisory_xact_lock(hashtext('public.profiles.admin_cap'));

    admin_count := public.count_current_admins();

    if admin_count >= 4 then
      raise exception 'Limite di 4 amministratori raggiunto.';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.is_admin is true
     and new.is_admin is false
     and actor_id is not null
     and actor_role <> 'service_role'
     and old.id = actor_id
  then
    raise exception 'Non puoi revocare il tuo stesso ruolo di amministratore.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_management on public.profiles;

create trigger profiles_protect_admin_management
  before update on public.profiles
  for each row
  execute function public.protect_profile_admin_management();

comment on function public.protect_profile_admin_management() is
  'Enforces the four-administrator cap and blocks self-demotion. Non-admin role changes remain blocked by profiles_prevent_admin_escalation.';
