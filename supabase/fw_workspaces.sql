-- Run this SQL in your Supabase dashboard → SQL Editor
-- Creates the fw_workspaces table for user-submitted coworking spaces

create table if not exists public.fw_workspaces (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  type             text,
  address          text,
  city             text,
  state            text,
  pincode          text,
  price_per_day    integer,
  price_per_month  integer,
  capacity         integer,
  description      text,
  amenities        text[] default '{}',
  photos           text[] default '{}',
  contact_email    text,
  contact_phone    text,
  website          text,
  status           text not null default 'pending',  -- pending | approved | rejected
  created_at       timestamptz default now()
);

-- Enable RLS
alter table public.fw_workspaces enable row level security;

-- Users can read their own rows + all approved rows
create policy "Read own or approved spaces" on public.fw_workspaces
  for select using (auth.uid() = user_id or status = 'approved');

-- Users can insert their own rows
create policy "Insert own spaces" on public.fw_workspaces
  for insert with check (auth.uid() = user_id);

-- Users can update their own pending rows
create policy "Update own spaces" on public.fw_workspaces
  for update using (auth.uid() = user_id);
