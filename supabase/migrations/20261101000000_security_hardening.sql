-- ==========================================
-- SECURITY HARDENING: EVENT ATTRIBUTION,
-- TEXT INTEGRITY, AND LEGACY CLEANUP
-- ==========================================

-- ---------------------------------------------------------------------------
-- 1. EVENTS.CREATED_BY
-- ---------------------------------------------------------------------------
-- The browser used to send `created_by`. RLS only checked `is_admin`, so an
-- administrator could attribute an event to another member. The database now
-- owns this field:
--   * INSERT: default `auth.uid()`; the trigger rejects a mismatched value.
--   * UPDATE: the trigger rejects any change. The service role remains an
--     explicit escape hatch for imports and data repair.
-- The insert policy also requires `created_by = auth.uid()` as defence in
-- depth.

alter table public.events
  alter column created_by set default auth.uid();

create or replace function public.set_event_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if tg_op = 'INSERT' then
    if actor_id is not null then
      if new.created_by is not null and new.created_by is distinct from actor_id then
        raise exception 'events.created_by must match the authenticated user'
          using errcode = '42501';
      end if;

      new.created_by := actor_id;
    end if;

    return new;
  end if;

  -- `created_by` is immutable for normal API users. The service role can still
  -- repair historical attribution when necessary.
  if new.created_by is distinct from old.created_by
     and actor_role <> 'service_role' then
    raise exception 'events.created_by cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists events_set_created_by on public.events;

create trigger events_set_created_by
  before insert or update on public.events
  for each row
  execute function public.set_event_created_by();

-- The BEFORE trigger fills `created_by` before RLS evaluates the WITH CHECK
-- expression. Recreate the admin insert policy with an explicit attribution
-- check so a forged value cannot pass even if the trigger is ever disabled.
drop policy if exists "Events insertable by admins" on public.events;

create policy "Events insertable by admins"
  on public.events for insert
  to authenticated
  with check (
    public.is_current_user_admin()
    and created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 2. NON-BLANK TEXT
-- ---------------------------------------------------------------------------
-- The UI trims and validates these fields, but a direct PostgREST call bypasses
-- that layer. These checks apply to every INSERT and UPDATE.
--
-- Constraints are added NOT VALID so this migration never fails on legacy
-- rows. They are enforced for all new writes immediately, and validated in the
-- DO block below when the existing data is already clean.
--
-- If the migration reports blank legacy rows, fix those rows and run:
--   alter table public.events validate constraint events_title_non_blank;
--   alter table public.generic_requests validate constraint generic_requests_message_non_blank;
--   alter table public.profiles validate constraint profiles_full_name_non_blank;

-- `full_name` is optional. Existing blank names are normalised to NULL, which
-- the application already treats as "not provided".
update public.profiles
set full_name = null
where full_name is not null
  and full_name !~ '[^[:space:]]';

alter table public.profiles
  drop constraint if exists profiles_full_name_non_blank;

alter table public.profiles
  add constraint profiles_full_name_non_blank
  check (full_name is null or full_name ~ '[^[:space:]]')
  not valid;

alter table public.events
  drop constraint if exists events_title_non_blank;

alter table public.events
  add constraint events_title_non_blank
  check (title ~ '[^[:space:]]')
  not valid;

alter table public.generic_requests
  drop constraint if exists generic_requests_message_non_blank;

alter table public.generic_requests
  add constraint generic_requests_message_non_blank
  check (message ~ '[^[:space:]]')
  not valid;

do $$
declare
  blank_profiles bigint;
  blank_events bigint;
  blank_requests bigint;
begin
  select count(*) into blank_profiles
  from public.profiles
  where full_name is not null
    and full_name !~ '[^[:space:]]';

  select count(*) into blank_events
  from public.events
  where title !~ '[^[:space:]]';

  select count(*) into blank_requests
  from public.generic_requests
  where message !~ '[^[:space:]]';

  if blank_profiles = 0 then
    alter table public.profiles
      validate constraint profiles_full_name_non_blank;
  else
    raise warning
      'profiles_full_name_non_blank remains NOT VALID: % profile(s) have blank names',
      blank_profiles;
  end if;

  if blank_events = 0 then
    alter table public.events
      validate constraint events_title_non_blank;
  else
    raise warning
      'events_title_non_blank remains NOT VALID: % event(s) have blank titles',
      blank_events;
  end if;

  if blank_requests = 0 then
    alter table public.generic_requests
      validate constraint generic_requests_message_non_blank;
  else
    raise warning
      'generic_requests_message_non_blank remains NOT VALID: % request(s) have blank messages',
      blank_requests;
  end if;

  raise notice
    'Text integrity constraints installed; blank/whitespace-only values are now rejected.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. LEGACY TESTS TABLE
-- ---------------------------------------------------------------------------
-- `tests` was the initial connection-verification table. It is unused by the
-- application and was publicly readable by `anon`. Dropping the table removes
-- its grants, RLS policies, and data. The explicit policy drop documents the
-- intent and works even if the table has no policy.

do $$
begin
  if to_regclass('public.tests') is not null then
    drop policy if exists "public can read tests" on public.tests;
  end if;
end;
$$;

drop table if exists public.tests;
