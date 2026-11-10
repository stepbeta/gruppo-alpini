-- ==========================================
-- ADMIN WRITE ACCESS FOR ORGANIZATION SETTINGS
-- ==========================================
-- Roadmap section 4.8 previously decided that writes to
-- `organization_settings` stay out of the application and happen only through
-- the Supabase dashboard or the service role. This migration deliberately
-- reverses that operational-only rule now that the portal has an
-- administrator-only surface at `/admin/impostazioni`.
--
-- The public read boundary is unchanged. The protections that replace the
-- "no application write path" rule are:
--   * `anon` keeps SELECT only and gains no write privilege;
--   * `authenticated` receives column-scoped UPDATE on the four published
--     controller fields, never INSERT or DELETE, so the seed row remains the
--     only row and the UI can only update it;
--   * the UPDATE RLS policy calls `is_current_user_admin()`, the database-owned
--     administrator boundary already used by every other admin surface;
--   * the existing BEFORE UPDATE trigger keeps `updated_at` server-owned and is
--     extended to lock the `id = true` invariant; a client cannot supply the
--     last-modified date that `/privacy` publishes;
--   * the original single-row invariant remains `id boolean primary key
--     default true` plus `check (id = true)`, and the lack of INSERT privileges
--     prevents duplicate rows even if a client bypasses the UI.
--
-- The public page continues to read this row through the cached
-- `getOrganizationSettings()` helper with `cacheLife("hours")`. The accepted
-- trade-off is documented in roadmap 4.8 and features 3.8: a saved change
-- becomes publicly visible at most one hour later, and this migration makes no
-- attempt to revalidate that cache.

-- ---------------------------------------------------------------------------
-- 1. GRANTS: PUBLIC READ, ADMINISTRATOR WRITE
-- ---------------------------------------------------------------------------
-- Supabase's local bootstrap applies broad default privileges to new public
-- tables, so the existing SELECT must be recreated explicitly after clearing
-- inherited grants. Clearing again makes this migration correct on projects
-- created both with and without those defaults.
revoke all
  on table public.organization_settings
  from anon, authenticated;

grant select
  on table public.organization_settings
  to anon, authenticated;

-- Column-scoped UPDATE: `id` and `updated_at` stay database-owned. PostgREST
-- rejects an attempt to write either column with 42501 before RLS is evaluated.
grant update (organization_name, address, contact_email, dpo_email)
  on table public.organization_settings
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY: ADMINISTRATOR-ONLY UPDATE
-- ---------------------------------------------------------------------------
-- The existing "Organization settings are public" SELECT policy is deliberately
-- untouched. This adds a separate permissive UPDATE policy; the RESTRICTIVE
-- consent/approval layers are not attached here because the only write is the
-- administrator lookup below and anonymous visitors still need the read path.
--
-- USING (true) is deliberate. The row is already public, so exposing its
-- existence for UPDATE leaks nothing. It lets PostgreSQL reach the WITH CHECK
-- expression for a regular member and raise 42501, instead of silently updating
-- zero rows. WITH CHECK is the real boundary: only an administrator can commit
-- the new values.
drop policy if exists "Organization settings editable by administrators"
  on public.organization_settings;

create policy "Organization settings editable by administrators"
  on public.organization_settings for update
  to authenticated
  using (true)
  with check (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- 3. SERVER-OWNED UPDATED_AT AND SINGLE-ROW GUARD
-- ---------------------------------------------------------------------------
-- The trigger already existed from 20261102000000. Replacing its function keeps
-- the trigger stable while adding two guarantees:
--   * `updated_at` is always the transaction timestamp, so the public
--     last-modified date cannot be forged by a client;
--   * the row cannot be moved away from `id = true`, reinforcing the existing
--     primary key + check constraint.
--
-- The UPDATE grants exclude `updated_at`, so this trigger is defence in depth
-- rather than the only protection. It also marks the exact place where a future
-- append-only audit table can record changes in the same transaction; that work
-- is deliberately out of scope and tracked as roadmap section 5.3.
create or replace function public.touch_organization_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from true then
    raise exception 'La tabella organization_settings ammette una sola riga con id = true.'
      using errcode = '23514';
  end if;

  new.updated_at := now();

  -- Future audit hook (roadmap section 5.3): insert the previous and next
  -- values into the audit table here, in the same transaction as the update.
  return new;
end;
$$;

drop trigger if exists organization_settings_touch_updated_at
  on public.organization_settings;

create trigger organization_settings_touch_updated_at
  before update on public.organization_settings
  for each row
  execute function public.touch_organization_settings_updated_at();

comment on function public.touch_organization_settings_updated_at() is
  'Keeps organization_settings.updated_at server-owned and enforces the id = true single-row invariant. Future audit hook for roadmap 5.3.';

-- ---------------------------------------------------------------------------
-- 4. NON-BLANK CONTROLLER NAME
-- ---------------------------------------------------------------------------
-- The UI trims and validates the name, but a direct PostgREST call bypasses
-- that layer. Added NOT VALID first so this migration cannot fail on a database
-- where an operator previously stored a blank name; it is validated immediately
-- when the existing data is already clean.
alter table public.organization_settings
  drop constraint if exists organization_settings_name_non_blank;

alter table public.organization_settings
  add constraint organization_settings_name_non_blank
  check (organization_name ~ '[^[:space:]]')
  not valid;

do $$
begin
  if not exists (
    select 1
    from public.organization_settings
    where organization_name !~ '[^[:space:]]'
  ) then
    alter table public.organization_settings
      validate constraint organization_settings_name_non_blank;
  end if;
end;
$$;

comment on table public.organization_settings is
  'Public GDPR controller details rendered by the privacy page. Publicly readable through anon; the single row is updated in-app by administrators only.';
