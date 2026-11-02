-- ==========================================
-- GDPR: ORGANIZATION SETTINGS, PRIVACY CONSENT,
-- DATA EXPORT AND ACCOUNT RESTRICTION
-- ==========================================
-- This migration adds:
--   * a single-row public configuration table used by the privacy page;
--   * an immutable consent history per user and privacy-policy version;
--   * a restrictive RLS layer that keeps unconsented accounts away from
--     member data even if they call PostgREST directly;
--   * a SECURITY DEFINER function that builds the GDPR export payload for the
--     signed-in member or for an administrator acting on a member's request.

-- ---------------------------------------------------------------------------
-- 1. PUBLIC ORGANIZATION SETTINGS
-- ---------------------------------------------------------------------------
-- The privacy page is public and server-rendered. It reads this row through
-- the anon role, while administrators update it through the Supabase dashboard
-- or the service role. A single row is enough for the association.

create table if not exists public.organization_settings (
  id boolean primary key default true,
  organization_name text not null default 'Gruppo Alpini',
  address text,
  contact_email text,
  dpo_email text,
  updated_at timestamp with time zone not null default now(),
  constraint organization_settings_single_row check (id = true)
);

alter table public.organization_settings enable row level security;

grant select on table public.organization_settings to anon, authenticated;

drop policy if exists "Organization settings are public"
  on public.organization_settings;

create policy "Organization settings are public"
  on public.organization_settings for select
  to anon, authenticated
  using (true);

create or replace function public.touch_organization_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organization_settings_touch_updated_at
  on public.organization_settings;

create trigger organization_settings_touch_updated_at
  before update on public.organization_settings
  for each row
  execute function public.touch_organization_settings_updated_at();

-- The association name is safe to prefill; the address and contact addresses
-- stay NULL until an administrator configures them. The page falls back to a
-- clear "not configured" message instead of inventing personal data.
insert into public.organization_settings (id, organization_name)
values (true, 'Gruppo Alpini')
on conflict (id) do nothing;

comment on table public.organization_settings is
  'Public GDPR controller details rendered by the privacy page.';

-- ---------------------------------------------------------------------------
-- 2. IMMUTABLE PRIVACY CONSENT HISTORY
-- ---------------------------------------------------------------------------
-- One row per accepted policy version. The application records consent with a
-- plain INSERT and never exposes DELETE or UPDATE privileges, so the history
-- remains an audit trail. Deleting the auth user removes their consent rows.

create table if not exists public.user_consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null,
  accepted_at timestamp with time zone not null default now(),
  constraint user_consents_policy_version_non_blank
    check (policy_version ~ '[^[:space:]]'),
  constraint user_consents_user_version_unique
    unique (user_id, policy_version)
);

alter table public.user_consents enable row level security;

grant select, insert on table public.user_consents to authenticated;

drop policy if exists "Users can read their own consents"
  on public.user_consents;

create policy "Users can read their own consents"
  on public.user_consents for select
  to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Users can record their own consent"
  on public.user_consents;

create policy "Users can record their own consent"
  on public.user_consents for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists user_consents_user_accepted_idx
  on public.user_consents (user_id, accepted_at desc);

-- The timestamp is evidence of when consent was given. Force it server-side so
-- a direct API call cannot backdate or postdate an acceptance. The append-only
-- grants above still prevent edits after the row exists.
create or replace function public.set_user_consent_accepted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.accepted_at := now();
  return new;
end;
$$;

drop trigger if exists user_consents_set_accepted_at
  on public.user_consents;

create trigger user_consents_set_accepted_at
  before insert on public.user_consents
  for each row
  execute function public.set_user_consent_accepted_at();

comment on table public.user_consents is
  'Append-only privacy-policy acceptance history. policy_version matches lib/privacy.ts.';

-- ---------------------------------------------------------------------------
-- 3. RESTRICT MEMBER DATA UNTIL CONSENT IS RECORDED
-- ---------------------------------------------------------------------------
-- The client gate prevents unconsented users from reaching the portal UI. This
-- restrictive policy adds a server-side layer: an unconsented authenticated
-- account cannot read or write member data through the API either. The consent
-- table itself is intentionally left open to the owner so the gate can record
-- the acceptance.
--
-- The helper is SECURITY DEFINER to avoid recursive RLS evaluation on
-- user_consents. It returns true for any accepted version; the client gate
-- still requires the current version so updated policies can be re-accepted.

create or replace function public.has_accepted_privacy_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_consents
    where user_id = auth.uid()
  );
$$;

revoke all on function public.has_accepted_privacy_consent() from public;
grant execute on function public.has_accepted_privacy_consent() to authenticated;

drop policy if exists "Privacy consent required for profiles"
  on public.profiles;
create policy "Privacy consent required for profiles"
  on public.profiles as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Privacy consent required for events"
  on public.events;
create policy "Privacy consent required for events"
  on public.events as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Privacy consent required for event responses"
  on public.event_responses;
create policy "Privacy consent required for event responses"
  on public.event_responses as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Privacy consent required for generic requests"
  on public.generic_requests;
create policy "Privacy consent required for generic requests"
  on public.generic_requests as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Privacy consent required for purchase items"
  on public.purchase_items;
create policy "Privacy consent required for purchase items"
  on public.purchase_items as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

drop policy if exists "Privacy consent required for purchase orders"
  on public.purchase_orders;
create policy "Privacy consent required for purchase orders"
  on public.purchase_orders as restrictive for all
  to authenticated
  using (public.has_accepted_privacy_consent())
  with check (public.has_accepted_privacy_consent());

-- ---------------------------------------------------------------------------
-- 4. GDPR DATA EXPORT
-- ---------------------------------------------------------------------------
-- Returns a single JSON document with profile, auth email/ID, event RSVPs,
-- generic requests and the full consent history. Members can export only their
-- own data; administrators can export another member's data for an offline
-- request. The function is SECURITY DEFINER because it reads auth.users and
-- builds the report across tables; authorization is enforced explicitly below.

create or replace function public.export_user_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user auth.users%rowtype;
  profile_data jsonb;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessione mancante' using errcode = '42501';
  end if;

  if target_user_id is null then
    raise exception 'Identificativo utente non valido' using errcode = '22023';
  end if;

  if target_user_id <> auth.uid()
     and not public.is_current_user_admin()
  then
    raise exception 'Non hai i permessi per esportare questi dati'
      using errcode = '42501';
  end if;

  select *
  into target_user
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'Utente non trovato' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'full_name', p.full_name,
    'birth_date', p.birth_date,
    'enlistment_year', p.enlistment_year,
    'service_place', p.service_place,
    'is_admin', p.is_admin,
    'updated_at', p.updated_at
  )
  into profile_data
  from public.profiles p
  where p.id = target_user_id;

  result := jsonb_build_object(
    'export_version', '1.0',
    'generated_at', now(),
    'user', jsonb_build_object(
      'id', target_user.id,
      'email', target_user.email,
      'created_at', target_user.created_at,
      'email_confirmed_at', target_user.email_confirmed_at,
      'last_sign_in_at', target_user.last_sign_in_at
    ),
    'profile', profile_data,
    'event_responses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_id', e.id,
          'event_title', e.title,
          'event_date', e.event_date,
          'is_all_day', e.is_all_day,
          'location', e.location,
          'status', r.status,
          'status_label', case r.status
            when 'present' then 'Presente'
            when 'tentative' then 'In forse'
            when 'absent' then 'Assente'
            else r.status
          end,
          'response_updated_at', r.updated_at
        )
        order by e.event_date desc
      )
      from public.event_responses r
      join public.events e on e.id = r.event_id
      where r.user_id = target_user_id
    ), '[]'::jsonb),
    'generic_requests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', gr.id,
          'message', gr.message,
          'created_at', gr.created_at,
          'status', gr.status,
          'status_label', case gr.status
            when 'open' then 'In attesa'
            when 'resolved' then 'Risolta'
            else gr.status
          end
        )
        order by gr.created_at desc
      )
      from public.generic_requests gr
      where gr.user_id = target_user_id
    ), '[]'::jsonb),
    'privacy_consents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'policy_version', c.policy_version,
          'accepted_at', c.accepted_at
        )
        order by c.accepted_at desc
      )
      from public.user_consents c
      where c.user_id = target_user_id
    ), '[]'::jsonb)
  );

  return result;
end;
$$;

revoke all on function public.export_user_data(uuid) from public;
grant execute on function public.export_user_data(uuid) to authenticated;

comment on function public.export_user_data(uuid) is
  'Builds the GDPR data-export JSON for the caller or, for administrators, for another member.';
