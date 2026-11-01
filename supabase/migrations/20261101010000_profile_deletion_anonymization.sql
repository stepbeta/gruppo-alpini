-- ==========================================
-- ACCOUNT DELETION & HISTORICAL DATA PRESERVATION
-- ==========================================
-- Deleting an auth user removes the linked profile (profiles.id cascades from
-- auth.users). Historical rows must survive that deletion:
--   * events.created_by
--   * event_responses.user_id
--   * generic_requests.user_id
--   * purchase_orders.user_id
-- All four references become NULL. In particular, event_responses keep their
-- status, so past event attendance totals remain correct and the response is
-- simply anonymised.

-- ---------------------------------------------------------------------------
-- 1. Normalise existing references and make historical columns nullable
-- ---------------------------------------------------------------------------

-- Drop every current foreign key from these tables to profiles. Looking them
-- up by catalog instead of by name keeps the migration safe if a constraint
-- was renamed by hand.
do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select
      con.conname,
      con.conrelid::regclass as table_name
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    join pg_class referenced
      on referenced.oid = con.confrelid
    join pg_namespace referenced_ns
      on referenced_ns.oid = referenced.relnamespace
    where con.contype = 'f'
      and referenced_ns.nspname = 'public'
      and referenced.relname = 'profiles'
      and con.conrelid in (
        'public.events'::regclass,
        'public.event_responses'::regclass,
        'public.generic_requests'::regclass,
        'public.purchase_orders'::regclass
      )
      and att.attname in ('created_by', 'user_id')
  loop
    execute format(
      'alter table %s drop constraint %I',
      existing_constraint.table_name,
      existing_constraint.conname
    );
  end loop;
end;
$$;

alter table public.events
  alter column created_by drop not null;

alter table public.event_responses
  alter column user_id drop not null;

alter table public.generic_requests
  alter column user_id drop not null;

alter table public.purchase_orders
  alter column user_id drop not null;

-- The security-hardening migration makes events.created_by immutable. Foreign
-- key actions fire ordinary triggers too, so ON DELETE SET NULL would otherwise
-- be rejected. Allow the specific case where the referenced profile no longer
-- exists (the account was just deleted); normal profile edits stay blocked.
create or replace function public.set_event_created_by()
returns trigger
language plpgsql
security definer
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

  if new.created_by is distinct from old.created_by
     and actor_role <> 'service_role'
     and not (
       new.created_by is null
       and not exists (
         select 1
         from public.profiles
         where id = old.created_by
       )
     )
  then
    raise exception 'events.created_by cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Repair any pre-existing orphan references (for example after a manual data
-- import). The application never creates them, but making them NULL before the
-- new constraints are added lets this migration run on legacy databases too.
update public.events e
set created_by = null
where e.created_by is not null
  and not exists (
    select 1 from public.profiles p where p.id = e.created_by
  );

update public.event_responses r
set user_id = null
where r.user_id is not null
  and not exists (
    select 1 from public.profiles p where p.id = r.user_id
  );

update public.generic_requests r
set user_id = null
where r.user_id is not null
  and not exists (
    select 1 from public.profiles p where p.id = r.user_id
  );

update public.purchase_orders o
set user_id = null
where o.user_id is not null
  and not exists (
    select 1 from public.profiles p where p.id = o.user_id
  );

-- ---------------------------------------------------------------------------
-- 2. Recreate the references as ON DELETE SET NULL
-- ---------------------------------------------------------------------------
-- The auth.users -> profiles cascade remains unchanged: deleting an account
-- still removes the profile row, while these historical rows stay in place.

alter table public.events
  add constraint events_created_by_fkey
  foreign key (created_by)
  references public.profiles (id)
  on delete set null;

alter table public.event_responses
  add constraint event_responses_user_id_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete set null;

-- Postgres treats NULLs as distinct in UNIQUE (event_id, user_id), so several
-- deleted members can remain anonymous on the same event without blocking new
-- responses from active members.

alter table public.generic_requests
  add constraint generic_requests_user_id_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete set null;

alter table public.purchase_orders
  add constraint purchase_orders_user_id_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Supporting indexes for ON DELETE SET NULL
-- ---------------------------------------------------------------------------

create index if not exists event_responses_user_id_idx
  on public.event_responses (user_id)
  where user_id is not null;

create index if not exists purchase_orders_user_id_idx
  on public.purchase_orders (user_id)
  where user_id is not null;

-- generic_requests already has generic_requests_user_created_idx, whose first
-- column is user_id. events.created_by is intentionally left unindexed: the
-- group has a small number of events and profile deletion is rare.

comment on column public.events.created_by is
  'NULL when the creating member account was deleted; the event is retained.';

comment on column public.event_responses.user_id is
  'NULL when the member account was deleted; status is retained for historical attendance totals.';

comment on column public.generic_requests.user_id is
  'NULL when the member account was deleted; the request is retained for the secretariat history.';

comment on column public.purchase_orders.user_id is
  'NULL when the member account was deleted; order history is retained.';
