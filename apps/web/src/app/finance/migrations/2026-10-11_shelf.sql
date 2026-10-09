-- Virtual Shelf: every business record in one place (returns, notices, statements, bills, registrations).
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- Private file storage (files are only reached through short-lived links made by the server)
insert into storage.buckets (id, name, public, file_size_limit)
values ('shelf', 'shelf', false, 15728640)
on conflict (id) do nothing;

create table if not exists fw_fin_shelf_items (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references fw_fin_businesses(id) on delete cascade,
  rack          text not null default 'others',   -- gst | income_tax | tds | bank | bills | notices | payroll | registrations | others
  fy            text,                              -- e.g. "2026-27"
  period        text,                              -- e.g. "September 2026", "Q2", "AY 2026-27"
  title         text not null,
  doc_type      text,                              -- e.g. "GSTR-1", "ITR-V", "Notice u/s 143(1)", "Bank statement"
  file_path     text not null,                     -- path inside the 'shelf' bucket
  file_name     text,
  mime          text,
  size_bytes    bigint,
  source        text not null default 'upload',    -- upload | frebook | statement | gstr1 | system
  reference     text,                              -- ARN / DIN / acknowledgement / notice number
  authority     text,                              -- issuing office
  reply_due     date,                              -- notices: reply-by date (shown in Due dates)
  amount        numeric,                           -- notices: amount demanded
  status        text not null default 'open',      -- notices: open | replied | closed
  notes         text,
  ai_summary    text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists fw_fin_shelf_biz on fw_fin_shelf_items (business_id, rack, fy, created_at desc) where deleted_at is null;
create index if not exists fw_fin_shelf_due on fw_fin_shelf_items (business_id, reply_due) where reply_due is not null and deleted_at is null;

alter table fw_fin_shelf_items enable row level security;  -- server (service role) only
