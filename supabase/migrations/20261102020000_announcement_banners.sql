-- ==========================================
-- PLATFORM-WIDE ANNOUNCEMENT BANNERS
-- ==========================================
-- A single announcement is displayed at the top of every authenticated page.
-- Several rows may be active (for example a current banner and a future-dated
-- one); the application shows the most recently created banner whose active
-- flag and optional date window allow it.
--
-- RLS keeps inactive and out-of-window banners invisible to regular members,
-- while administrators can read every row from the management page.

create table if not exists public.announcement_banners (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null
    default auth.uid(),
  created_at timestamp with time zone not null default now(),
  constraint announcement_banners_message_not_blank
    check (btrim(message) <> ''),
  constraint announcement_banners_date_order
    check (start_date is null or end_date is null or start_date <= end_date)
);

alter table public.announcement_banners enable row level security;

grant select, insert, update, delete on table public.announcement_banners
  to authenticated;

create index if not exists announcement_banners_active_created_idx
  on public.announcement_banners (created_at desc)
  where is_active;

-- Regular members only see banners that are currently inside their display
-- window. Administrators see every row so they can edit, toggle and delete
-- scheduled or expired announcements.
drop policy if exists "Visible announcements are readable"
  on public.announcement_banners;

create policy "Visible announcements are readable"
  on public.announcement_banners for select
  to authenticated
  using (
    (
      is_active
      and (start_date is null or start_date <= now())
      and (end_date is null or end_date >= now())
    )
    or public.is_current_user_admin()
  );

drop policy if exists "Admins can create announcements"
  on public.announcement_banners;

create policy "Admins can create announcements"
  on public.announcement_banners for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update announcements"
  on public.announcement_banners;

create policy "Admins can update announcements"
  on public.announcement_banners for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete announcements"
  on public.announcement_banners;

create policy "Admins can delete announcements"
  on public.announcement_banners for delete
  to authenticated
  using (public.is_current_user_admin());

comment on table public.announcement_banners is
  'Platform-wide announcement banners. The most recent visible row is displayed at the top of authenticated pages.';

comment on column public.announcement_banners.start_date is
  'Optional start of the display window; NULL means immediately.';

comment on column public.announcement_banners.end_date is
  'Optional end of the display window; NULL means until deactivated or deleted.';
