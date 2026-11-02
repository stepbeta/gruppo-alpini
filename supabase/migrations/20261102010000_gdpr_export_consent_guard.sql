-- ==========================================
-- GDPR: CLOSE CONSENT BYPASSES IN ADMIN PATHS
-- ==========================================
-- The first GDPR migration added restrictive policies on member tables, but two
-- SECURITY DEFINER paths still ignored the consent requirement:
--   * an unconsented administrator could export another member's data through
--     `export_user_data`, because it bypasses RLS;
--   * an unconsented administrator could read every consent row through the
--     `user_consents` select policy.
--
-- Self-service export remains allowed before acceptance: a member must always
-- be able to obtain their own data, even while deciding whether to consent.

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

  -- Exporting another member's data requires both administrator privileges and
  -- an accepted privacy policy. The client gate blocks this in the UI; this
  -- check keeps the API safe even if the gate is bypassed.
  if target_user_id <> auth.uid()
     and not (
       public.is_current_user_admin()
       and public.has_accepted_privacy_consent()
     )
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
  'Builds the GDPR data-export JSON for the caller or, for consented administrators, for another member.';

-- Read access to the consent history is limited to the owner. Administrators
-- can read another member's history (needed for an export) only after they
-- have accepted the policy themselves; cross-member exports are further
-- restricted inside export_user_data.
drop policy if exists "Users can read their own consents"
  on public.user_consents;

create policy "Users can read their own consents"
  on public.user_consents for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      public.has_accepted_privacy_consent()
      and public.is_current_user_admin()
    )
  );
