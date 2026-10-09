-- Admin grants for people who haven't signed up yet. Applied automatically on their first sign-in.
-- Run once in Supabase → SQL Editor. Safe to re-run.
create table if not exists fw_fin_pending_grants (
  email        text primary key,             -- stored lower-case
  action       text not null check (action in ('grant_trial', 'activate')),
  plan         text not null default 'professional',
  days         int  not null default 7,
  granted_by   text,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  claimed_user uuid
);
alter table fw_fin_pending_grants enable row level security;  -- server (service role) only
