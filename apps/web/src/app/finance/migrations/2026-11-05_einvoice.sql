-- e-Invoice / e-Way bill API logins per business (NIC API user created for the GSP).
-- The password is kept only when "remember" is ticked, AES-256-GCM encrypted (PORTAL_TOKEN_KEY); the token lasts ~6 hours.
-- The IRN, acknowledgement, QR and e-way bill number are saved in the invoice's metadata. Safe to run more than once.
create table if not exists fw_fin_nic_logins (
  business_id  uuid not null references fw_fin_businesses(id) on delete cascade,
  kind         text not null check (kind in ('einvoice', 'ewaybill')),
  username     text not null,
  enc_password text,
  token        text,
  token_expiry timestamptz,
  saved_by     uuid,
  updated_at   timestamptz not null default now(),
  primary key (business_id, kind)
);
alter table fw_fin_nic_logins enable row level security;   -- server only (service role); no browser access
