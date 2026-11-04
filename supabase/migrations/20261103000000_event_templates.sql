-- ==========================================
-- EVENT TEMPLATES
-- ==========================================
-- Administrators can store reusable event details (title, description,
-- location, all-day flag and default start time) and apply them while creating
-- an event. The event date is deliberately not part of a template: it is
-- chosen each time the event is scheduled.
--
-- Templates mirror the fields currently supported by `events`. Duration is not
-- stored because events have no end time yet; adding it would require a larger
-- change to the event model and UI.

create table if not exists public.event_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  is_all_day boolean not null default true,
  default_time time without time zone,
  created_by uuid references public.profiles (id) on delete set null
    default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_templates_title_not_blank
    check (title ~ '[^[:space:]]'),
  -- Keep the two fields consistent with the event form: an all-day template has
  -- no time, while a timed template must have one. This prevents a template
  -- that claims to be timed from silently producing an all-day event.
  constraint event_templates_time_matches_all_day
    check (
      (is_all_day and default_time is null)
      or (not is_all_day and default_time is not null)
    )
);

alter table public.event_templates enable row level security;

-- Supabase does not expose new tables to the API roles automatically. The
-- policies below restrict every operation to administrators.
grant select, insert, update, delete on table public.event_templates
  to authenticated;

-- ---------------------------------------------------------------------------
-- 1. ATTRIBUTION AND UPDATED_AT
-- ---------------------------------------------------------------------------
-- As with events, the database owns `created_by`. The insert policy below
-- repeats the check so a forged value cannot pass even if the trigger is
-- disabled. The profile-deletion foreign key can still set the column to NULL
-- when the author's account is removed.

create or replace function public.set_event_template_created_by()
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
        raise exception 'event_templates.created_by must match the authenticated user'
          using errcode = '42501';
      end if;

      new.created_by := actor_id;
    end if;

    return new;
  end if;

  -- `created_by` is immutable for normal API users. The service role remains an
  -- explicit repair path, and the profile deletion cascade may clear the author.
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
    raise exception 'event_templates.created_by cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists event_templates_set_created_by
  on public.event_templates;

create trigger event_templates_set_created_by
  before insert or update on public.event_templates
  for each row
  execute function public.set_event_template_created_by();

create or replace function public.touch_event_template_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists event_templates_touch_updated_at
  on public.event_templates;

create trigger event_templates_touch_updated_at
  before update on public.event_templates
  for each row
  execute function public.touch_event_template_updated_at();

-- Supports the alphabetical selector and management list.
create index if not exists event_templates_title_idx
  on public.event_templates (title);

-- Supports the ON DELETE SET NULL action when a profile is removed.
create index if not exists event_templates_created_by_idx
  on public.event_templates (created_by)
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- 2. ADMIN-ONLY POLICIES
-- ---------------------------------------------------------------------------
-- Event templates are an administrative tool, so regular members never read
-- them, even though the table is in the authenticated API schema.

drop policy if exists "Admins can view event templates"
  on public.event_templates;
create policy "Admins can view event templates"
  on public.event_templates for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert event templates"
  on public.event_templates;
create policy "Admins can insert event templates"
  on public.event_templates for insert
  to authenticated
  with check (
    public.is_current_user_admin()
    and created_by = auth.uid()
  );

drop policy if exists "Admins can update event templates"
  on public.event_templates;
create policy "Admins can update event templates"
  on public.event_templates for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete event templates"
  on public.event_templates;
create policy "Admins can delete event templates"
  on public.event_templates for delete
  to authenticated
  using (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- 3. CONSENT AND APPROVAL LAYERS
-- ---------------------------------------------------------------------------
-- The admin policies already imply approval, but keeping the explicit
-- restrictive layers makes this table consistent with the rest of the portal
-- and prevents an unconsented administrator from reading it through PostgREST.

drop policy if exists "Privacy consent required for event templates"
  on public.event_templates;
create policy "Privacy consent required for event templates"
  on public.event_templates as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Approval required for event templates"
  on public.event_templates;
create policy "Approval required for event templates"
  on public.event_templates as restrictive for all
  to authenticated
  using (public.is_current_user_approved())
  with check (public.is_current_user_approved());

comment on table public.event_templates is
  'Reusable event details managed by administrators; the event date is chosen separately.';

comment on column public.event_templates.default_time is
  'Default start time for timed templates; NULL for all-day templates.';

comment on column public.event_templates.created_by is
  'NULL when the creating member account was deleted; the template is retained.';
