-- ============================================================
-- FreWork — Complete Database Setup
-- Run this entire file in Supabase SQL Editor (once)
-- ============================================================

-- ── 1. Users ──────────────────────────────────────────────
create table if not exists fw_users (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  name        text,
  mobile      text,
  method      text default 'email',
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table fw_users enable row level security;
create policy "Users can read own profile"  on fw_users for select using (auth.uid() = id);
create policy "Users can update own profile" on fw_users for update using (auth.uid() = id);
create policy "Users can insert own profile" on fw_users for insert with check (auth.uid() = id);

-- ── 2. Workspaces ──────────────────────────────────────────
create table if not exists fw_workspaces (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade,
  name            text not null,
  type            text,
  address         text,
  city            text,
  state           text,
  pincode         text,
  description     text,
  capacity        int,
  price_per_day   int,
  price_per_month int,
  amenities       text[],
  photos          text[],
  contact_email   text,
  contact_phone   text,
  website         text,
  status          text default 'pending',
  created_at      timestamptz default now()
);
alter table fw_workspaces enable row level security;
create policy "Public can view approved workspaces" on fw_workspaces for select using (status = 'active');
create policy "Owners can manage own workspace"     on fw_workspaces for all   using (auth.uid() = user_id);

-- ── 3. Freelancers / Teachers / Skilled Workers ────────────
create table if not exists fw_freelancers (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users on delete cascade,
  name             text not null,
  title            text,
  category         text,  -- 'Freelancer' | 'Teacher' | 'Skilled Worker'
  city             text,
  bio              text,
  skills           text[],
  hourly_rate      int,
  experience_years int,
  contact_email    text,
  contact_phone    text,
  linkedin         text,
  portfolio        text,
  photos           text[],
  extra            jsonb,
  status           text default 'pending',
  created_at       timestamptz default now()
);
alter table fw_freelancers enable row level security;
create policy "Public can view approved freelancers" on fw_freelancers for select using (status = 'active');
create policy "Owners can manage own profile"        on fw_freelancers for all   using (auth.uid() = user_id);

-- ── 4. Jobs ────────────────────────────────────────────────
create table if not exists fw_jobs (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users on delete cascade,
  company_name     text,
  job_title        text not null,
  job_type         text,
  location         text,
  city             text,
  salary_min       int,
  salary_max       int,
  experience_level text,
  description      text,
  requirements     text,
  skills           text[],
  contact_email    text,
  status           text default 'active',
  created_at       timestamptz default now()
);
alter table fw_jobs enable row level security;
create policy "Public can view active jobs" on fw_jobs for select using (status = 'active');
create policy "Owners can manage own jobs" on fw_jobs for all   using (auth.uid() = user_id);

-- ── 5. Services (GROW) ─────────────────────────────────────
create table if not exists fw_services (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade,
  provider_name   text,
  qualification   text,
  service_type    text,
  description     text,
  price_from      int,
  price_to        int,
  delivery_days   int,
  contact_email   text,
  contact_phone   text,
  website         text,
  linkedin        text,
  status          text default 'pending',
  created_at      timestamptz default now()
);
alter table fw_services enable row level security;
create policy "Public can view approved services" on fw_services for select using (status = 'active');
create policy "Owners can manage own services"    on fw_services for all   using (auth.uid() = user_id);

-- ── 6. Startups ────────────────────────────────────────────
create table if not exists fw_startups (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade,
  company_name    text not null,
  tagline         text,
  sector          text,
  stage           text,
  city            text,
  description     text,
  website         text,
  pitch_deck_url  text,
  funding_target  bigint,
  equity_offered  numeric(5,2),
  contact_email   text,
  contact_phone   text,
  photos          text[],
  status          text default 'pending',
  created_at      timestamptz default now()
);
alter table fw_startups enable row level security;
create policy "Public can view approved startups" on fw_startups for select using (status = 'active');
create policy "Owners can manage own startup"     on fw_startups for all   using (auth.uid() = user_id);

-- ── 7. Subscriptions ───────────────────────────────────────
create table if not exists fw_subscriptions (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references auth.users on delete cascade unique,
  plan                  text not null,   -- professional | growth | business | enterprise
  billing               text default 'monthly',
  amount                int,
  razorpay_payment_id   text,
  razorpay_order_id     text,
  status                text default 'active',
  started_at            timestamptz default now(),
  expires_at            timestamptz,
  updated_at            timestamptz default now()
);
alter table fw_subscriptions enable row level security;
create policy "Users can view own subscription" on fw_subscriptions for select using (auth.uid() = user_id);
create policy "Users can insert own subscription" on fw_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update own subscription" on fw_subscriptions for update using (auth.uid() = user_id);

-- ── 8. Storage Bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frework-uploads', 'frework-uploads', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

create policy "Authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'frework-uploads');

create policy "Users can delete own uploads"
  on storage.objects for delete to authenticated
  using (bucket_id = 'frework-uploads');

create policy "Public can view photos"
  on storage.objects for select to public
  using (bucket_id = 'frework-uploads');

-- ── 9. Auto-create user profile on signup ──────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.fw_users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
