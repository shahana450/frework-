-- Cloud connectors (Razorpay, Shopify, Zoho Books, QuickBooks) and the items they fetch.
-- Fetched items wait in a review list; nothing is posted to the books until a person posts it.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists fw_fin_connections (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references fw_fin_businesses(id) on delete cascade,
  provider      text not null,                 -- razorpay | shopify | zoho_books | quickbooks
  status        text not null default 'connected' check (status in ('connected', 'error', 'expired')),
  creds_enc     text not null,                 -- AES-GCM encrypted keys / OAuth tokens
  account_label text,                          -- shop domain, Razorpay key id, Zoho org, QuickBooks company
  last_sync_at  timestamptz,
  last_error    text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (business_id, provider)
);

create table if not exists fw_fin_feed_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references fw_fin_businesses(id) on delete cascade,
  provider     text not null,
  external_id  text not null,                  -- provider's id (payment, settlement, order, journal)
  kind         text not null,                  -- payment | settlement | refund | order | journal
  date         date not null,
  description  text not null,
  party        text,
  amount       numeric not null,
  currency     text,
  lines        jsonb not null,                 -- proposed entry: [{ledger, head, dr, cr}]
  status       text not null default 'new' check (status in ('new', 'posted', 'ignored')),
  journal_id   uuid,
  fetched_at   timestamptz not null default now(),
  unique (business_id, provider, external_id)
);
create index if not exists fw_fin_feed_items_biz on fw_fin_feed_items (business_id, status, date desc);

alter table fw_fin_connections enable row level security;   -- server (service role) only
alter table fw_fin_feed_items enable row level security;
