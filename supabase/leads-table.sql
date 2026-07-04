-- Run in Supabase SQL Editor

create table if not exists fw_leads (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  mobile       text not null,
  email        text,
  service      text,
  source       text default 'website',   -- meta_ad | instagram | website | referral
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  status       text default 'new',       -- new | contacted | qualified | converted | lost
  notes        text,
  created_at   timestamptz default now()
);

-- No RLS — admin-only table accessed via service role key
-- Index for fast admin queries
create index if not exists fw_leads_status_idx on fw_leads(status);
create index if not exists fw_leads_created_idx on fw_leads(created_at desc);
