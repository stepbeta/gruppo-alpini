-- ==========================================
-- PHASE 1B: PROFILE PAGE ACCESS
-- ==========================================
-- Supabase does not expose new tables to the API roles automatically. The
-- Phase 1 schema added RLS policies but no table grants, so without this
-- migration every profiles query returns "permission denied" (42501).
--
-- Only the columns the profile form edits are relevant here; the trigger below
-- prevents a member from promoting themselves by sending `is_admin = true`.

grant select on table public.profiles to authenticated;
grant insert, update on table public.profiles to authenticated;

-- Allows the app to create a profile row if it is missing (for accounts created
-- before the on_auth_user_created trigger, or if the trigger was skipped).
create policy "Users can insert their own profile."
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id and is_admin is not true);

-- RLS cannot compare OLD and NEW values. This trigger blocks a non-admin from
-- changing the admin flag on their own row while still letting admins and the
-- service role manage it.
create or replace function public.prevent_profile_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not exists (
       select 1
       from public.profiles
       where id = auth.uid() and is_admin = true
     )
  then
    raise exception 'Only administrators can change the admin flag'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_escalation on public.profiles;

create trigger profiles_prevent_admin_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_admin_escalation();

-- Backfill profiles for accounts that existed before the signup trigger.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.email
  )
from auth.users u
on conflict (id) do nothing;
