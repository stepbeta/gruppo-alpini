-- ==========================================
-- CLOSED REGISTRATION & MEMBER APPROVAL
-- ==========================================
-- New signups start as `pending`. An administrator must approve them before
-- they can read member data, events, requests, shop data or announcements.
-- Existing profiles are grandfathered as `approved` so the current members and
-- administrators are not locked out.
--
-- The status is a text column with a check constraint instead of a boolean:
-- `rejected` must remain distinguishable from an account that is still waiting.

-- ---------------------------------------------------------------------------
-- 1. APPROVAL STATUS ON PROFILES
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists approval_status text not null default 'pending'
    constraint profiles_approval_status_check
    check (approval_status in ('pending', 'approved', 'rejected'));

comment on column public.profiles.approval_status is
  'Registration state: pending until an administrator approves or rejects it.';

create index if not exists profiles_approval_status_idx
  on public.profiles (approval_status);

-- Every profile that existed before this migration belongs to a member who was
-- already using the portal. Keep them approved; only new signups start pending.
update public.profiles
set approval_status = 'approved'
where approval_status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. NEW SIGNUPS START PENDING
-- ---------------------------------------------------------------------------
-- The auth trigger owns profile creation, so a new account cannot choose its
-- own approval status. `on conflict do nothing` keeps a retried or duplicated
-- auth event from overwriting an existing profile.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, approval_status)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. APPROVAL HELPERS
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER avoids recursive RLS evaluation when the helper is called
-- from a policy on `profiles`. Administrators are always considered approved:
-- an accidentally rejected admin must not lose the ability to repair accounts.

create or replace function public.is_current_user_approved()
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
      and (approval_status = 'approved' or is_admin = true)
  );
$$;

revoke all on function public.is_current_user_approved() from public;
grant execute on function public.is_current_user_approved() to authenticated;

comment on function public.is_current_user_approved() is
  'True when the caller is approved or is an administrator. Used by restrictive RLS policies.';

-- RLS cannot compare OLD and NEW values. This trigger blocks a member from
-- self-approving through a crafted INSERT/UPDATE while letting administrators
-- and the service role change the status. The existing admin/id trigger remains
-- responsible for `is_admin` and the primary key.
create or replace function public.protect_profile_approval_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.jwt() ->> 'role', '');
  actor_is_admin boolean := public.is_current_user_admin();
begin
  if tg_op = 'INSERT' then
    -- `auth.uid()` is NULL for direct SQL/maintenance connections, which are
    -- already privileged. Only enforce the rule for API users.
    if auth.uid() is not null
       and actor_role <> 'service_role'
       and not actor_is_admin
    then
      new.approval_status := 'pending';
    end if;

    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     and auth.uid() is not null
     and actor_role <> 'service_role'
     and not actor_is_admin
  then
    raise exception 'Only administrators can change the approval status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_approval_status on public.profiles;

create trigger profiles_protect_approval_status
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_approval_status();

-- ---------------------------------------------------------------------------
-- 4. PROFILE READ ACCESS
-- ---------------------------------------------------------------------------
-- Pending and rejected accounts can read their own row so the app can show the
-- correct holding screen. Regular members only see approved profiles, while
-- administrators see every row (including accounts waiting for a decision).

drop policy if exists "Public profiles are viewable by authenticated users."
  on public.profiles;
drop policy if exists "Approved members can view profiles"
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

-- ---------------------------------------------------------------------------
-- 5. RESTRICT MEMBER DATA UNTIL APPROVAL
-- ---------------------------------------------------------------------------
-- These restrictive policies compose with the existing permissive policies and
-- with the GDPR consent layer: both an accepted privacy policy and an approved
-- account are required. `user_consents` stays open to its owner so a pending
-- account can still accept the privacy policy and see the holding screen.

drop policy if exists "Approval required for events"
  on public.events;
create policy "Approval required for events"
  on public.events as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

drop policy if exists "Approval required for event responses"
  on public.event_responses;
create policy "Approval required for event responses"
  on public.event_responses as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

drop policy if exists "Approval required for generic requests"
  on public.generic_requests;
create policy "Approval required for generic requests"
  on public.generic_requests as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

drop policy if exists "Approval required for purchase items"
  on public.purchase_items;
create policy "Approval required for purchase items"
  on public.purchase_items as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

drop policy if exists "Approval required for purchase orders"
  on public.purchase_orders;
create policy "Approval required for purchase orders"
  on public.purchase_orders as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

drop policy if exists "Approval required for announcements"
  on public.announcement_banners;
create policy "Approval required for announcements"
  on public.announcement_banners as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());
