-- GST / Income-tax portal connections (via a licensed GSP / ERI) and the statuses fetched from them.
-- Portal PASSWORDS ARE NEVER STORED. Only the provider's short-lived session token, encrypted by the server.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists fw_fin_portal_links (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references fw_fin_businesses(id) on delete cascade,
  portal        text not null check (portal in ('gst', 'it')),
  identifier    text not null,                 -- GSTIN (gst) or PAN (it)
  provider      text not null,                 -- demo | mastersindia | … (gst) ; demo | <eri> (it)
  status        text not null default 'otp_pending' check (status in ('otp_pending', 'linked', 'expired', 'error')),
  session_enc   text,                          -- AES-GCM encrypted provider session (never a password)
  otp_ref       text,                          -- provider's OTP transaction reference
  expires_at    timestamptz,
  last_sync_at  timestamptz,
  last_error    text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (business_id, portal)
);

create table if not exists fw_fin_portal_status (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references fw_fin_businesses(id) on delete cascade,
  portal       text not null,                  -- gst | it
  kind         text not null,                  -- return | itr | refund | ledger
  form         text not null,                  -- GSTR-1, GSTR-3B, ITR, Refund, Cash ledger …
  period       text not null,                  -- YYYY-MM (GST month), AY 2026-27 (IT)
  status       text not null,                  -- filed | not_filed | e_verified | processed | issued …
  arn          text,
  filed_on     date,
  amount       numeric,
  details      jsonb not null default '{}'::jsonb,
  demo         boolean not null default false, -- true when produced by Demo mode
  fetched_at   timestamptz not null default now(),
  unique (business_id, portal, form, period)
);
create index if not exists fw_fin_portal_status_biz on fw_fin_portal_status (business_id, portal, period desc);

alter table fw_fin_portal_links enable row level security;   -- server (service role) only
alter table fw_fin_portal_status enable row level security;
