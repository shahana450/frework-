-- One chat entry = one posting. Blocks a second journal with the same client_key (sent by FreBook for each draft),
-- even when two clicks reach the server at the same moment. Run once in Supabase → SQL Editor. Safe to re-run.

create unique index if not exists fw_fin_journals_client_key_uniq
  on fw_fin_journals (business_id, (metadata->>'client_key'))
  where metadata ? 'client_key' and status <> 'voided';

-- Duplicate entry numbers (e.g. two JV-2026-0001) come from the fallback numbering used when the
-- Phase 1 posting function is missing. If this returns 0, run 2026-10-03_phase1_posting_engine.sql (and later scripts in order).
select count(*) as posting_function_installed from pg_proc where proname = 'fw_fin_post_journal';
