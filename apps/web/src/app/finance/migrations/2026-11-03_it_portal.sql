-- Income-tax portal fetch: remembered passwords (encrypted) and background fetch jobs.
-- Server-only tables: row level security on, no policies. Run once in Supabase → SQL Editor. Safe to re-run.

-- A password is saved only when the user ticks "Remember password"; it is AES-256-GCM encrypted with a key
-- kept in server settings (PORTAL_TOKEN_KEY), and "Forget password" deletes the row.
create table if not exists fw_fin_it_credentials (
  business_id  uuid not null references fw_fin_businesses(id) on delete cascade,
  pan          text not null,
  enc_password text not null,
  saved_by     uuid,
  updated_at   timestamptz not null default now(),
  primary key (business_id, pan)
);
alter table fw_fin_it_credentials enable row level security;
revoke all on fw_fin_it_credentials from anon, authenticated;

-- One row per background fetch: the worker posts each document back with the job's token.
create table if not exists fw_fin_it_jobs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  user_id     uuid not null,
  token_hash  text not null,
  fy          text,
  status      text not null default 'running',     -- running | done | failed
  saved       int  not null default 0,
  report      jsonb,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists fw_fin_it_jobs_biz on fw_fin_it_jobs (business_id, created_at desc);
alter table fw_fin_it_jobs enable row level security;
revoke all on fw_fin_it_jobs from anon, authenticated;
