-- ==========================================
-- PHASE 1: ALPINI APP INITIAL SCHEMA
-- ==========================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";


-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  birth_date date,
  enlistment_year integer,
  service_place text,
  is_admin boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users."
  on public.profiles for select
  to authenticated using (true);

create policy "Users can update their own profile."
  on public.profiles for update
  to authenticated using (auth.uid() = id);

-- Trigger to automatically create a profile record when a user signs up via Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. EVENTS TABLE
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  location text,
  event_date timestamp with time zone not null,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;

create policy "Events viewable by authenticated users"
  on public.events for select to authenticated using (true);

create policy "Events insertable by admins"
  on public.events for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Events updatable by admins"
  on public.events for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- 3. EVENT RESPONSES TABLE
create table public.event_responses (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('present', 'tentative', 'absent')) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (event_id, user_id)
);

alter table public.event_responses enable row level security;

create policy "Responses viewable by authenticated users"
  on public.event_responses for select to authenticated using (true);

create policy "Users can insert/update their own response"
  on public.event_responses for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 4. GENERIC REQUESTS TABLE
create table public.generic_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  status text default 'open' check (status in ('open', 'resolved')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.generic_requests enable row level security;

create policy "Users can view their own requests"
  on public.generic_requests for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Users can insert requests"
  on public.generic_requests for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Admins can update request status"
  on public.generic_requests for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- 5. PURCHASE ITEMS & ORDERS TABLES
create table public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  price numeric(10, 2) not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.purchase_orders (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.purchase_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (item_id, user_id)
);

alter table public.purchase_items enable row level security;
alter table public.purchase_orders enable row level security;

create policy "Items viewable by authenticated"
  on public.purchase_items for select to authenticated using (true);

create policy "Items manageable by admins"
  on public.purchase_items for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Orders viewable by owners and admins"
  on public.purchase_orders for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Orders manageable by owners"
  on public.purchase_orders for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
