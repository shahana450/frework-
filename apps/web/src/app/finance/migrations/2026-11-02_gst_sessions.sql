-- GST portal sessions for downloading GSTR-1, GSTR-3B and GSTR-2B through the GSP (Sandbox).
-- The taxpayer approves with an OTP; the session token lasts a few hours. No portal password is ever stored.
-- Server-only: row level security on, no policies, so only the service role can read or write.
-- Run once in Supabase → SQL Editor. Safe to re-run.
create table if not exists fw_fin_gst_sessions (
  business_id    uuid primary key references fw_fin_businesses(id) on delete cascade,
  gstin          text not null,
  username       text not null,              -- GST portal username (not a secret)
  access_token   text,                       -- taxpayer session token from the GSP, expires in hours
  token_expiry   timestamptz,
  session_expiry timestamptz,
  connected_by   uuid,
  updated_at     timestamptz not null default now()
);
alter table fw_fin_gst_sessions enable row level security;
revoke all on fw_fin_gst_sessions from anon, authenticated;
