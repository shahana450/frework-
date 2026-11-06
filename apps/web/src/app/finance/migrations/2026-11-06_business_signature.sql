-- Authorised signatory's signature, shown on invoices (beside "For <business> · Authorised signatory").
-- Stored like the logo: a small PNG/JPEG data URL. Run once in Supabase → SQL Editor. Safe to re-run.

alter table fw_fin_businesses add column if not exists signature_url text;
