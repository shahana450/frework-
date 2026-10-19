-- Bank-statement pages read by the AI, per account owner per month (plan allowance: Starter 100 … CA Practice 6,000).
-- Spreadsheets are read without AI and are not counted. Run once in Supabase → SQL Editor. Safe to re-run.
create table if not exists fw_fin_statement_usage (
  owner_id   uuid not null,
  month      text not null,               -- 'YYYY-MM' (India time)
  pages      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, month)
);
alter table fw_fin_statement_usage enable row level security;   -- server (service role) only

-- Adds pages atomically (two batches finishing together can't lose a count)
create or replace function fw_fin_add_statement_pages(p_owner uuid, p_month text, p_pages int)
returns int language sql security definer set search_path = public as $$
  insert into fw_fin_statement_usage (owner_id, month, pages) values (p_owner, p_month, p_pages)
  on conflict (owner_id, month) do update set pages = fw_fin_statement_usage.pages + excluded.pages, updated_at = now()
  returning pages;
$$;
revoke all on function fw_fin_add_statement_pages(uuid, text, int) from public, anon, authenticated;
