-- Phase 4 (backend fixes): Tally mapping per company + GUID on pushed journals.
-- Requires 2026-10-17_b5_tally_link.sql. Run on STAGING first. Safe to run more than once.
--   • fw_fin_businesses.tally_port / tally_verified_at — the Tally company link (tally_company, from B5) now also keeps
--     the bridge port and when it was last confirmed open in Tally.
--   • fw_fin_journals.tally_guid — the REMOTEID FreWork gave the voucher in Tally ("frework-<journal id>"); one per
--     business. Matching FreWork ↔ Tally uses it (then date + amount + ledger), never the voucher number.
-- GST due-date amounts and health alerts are code-only changes (lib/gst3b.ts, lib/dashboard.ts) — nothing to run.

alter table fw_fin_businesses add column if not exists tally_port text;
alter table fw_fin_businesses add column if not exists tally_verified_at timestamptz;

alter table fw_fin_journals add column if not exists tally_guid text;
create unique index if not exists fw_fin_journals_tally_guid_unique on fw_fin_journals (business_id, tally_guid) where tally_guid is not null;

-- Vouchers pushed before this release have no REMOTEID in Tally, so they are matched by date + amount + ledger.

notify pgrst, 'reload schema';
