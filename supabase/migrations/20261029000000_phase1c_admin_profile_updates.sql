-- ==========================================
-- PHASE 1C: ADMIN PROFILE UPDATES
-- ==========================================
-- The directory lets administrators correct any member's profile. The Phase 1
-- update policy only allows a user to update their own row, so administrators
-- need an additional permissive UPDATE policy.
--
-- The policy helper is SECURITY DEFINER on purpose: querying `profiles` from a
-- policy on `profiles` would trigger the same policy again and cause infinite
-- recursion. The function owner bypasses RLS for this small lookup.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- The new policy lets admins update any row, so also protect the primary key
-- from being changed through a crafted API request. Normal app updates never
-- send `id`.
create or replace function public.prevent_profile_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
  then
    raise exception 'The profile id cannot be changed'
      using errcode = '42501';
  end if;

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
