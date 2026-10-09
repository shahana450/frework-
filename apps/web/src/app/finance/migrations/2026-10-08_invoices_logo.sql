-- Business logo + saved invoice documents (edits made on the invoice, kept apart from the posted entry)
-- Run once in Supabase → SQL Editor. Safe to re-run.

alter table fw_fin_businesses add column if not exists logo_url text;

create table if not exists fw_fin_invoice_docs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  journal_id  uuid not null references fw_fin_journals(id) on delete cascade,
  invoice_no  text,
  data        jsonb not null default '{}'::jsonb,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (journal_id)
);
create index if not exists fw_fin_invoice_docs_biz on fw_fin_invoice_docs (business_id, created_at desc);

-- Only the server (service role) reads and writes these rows
alter table fw_fin_invoice_docs enable row level security;
