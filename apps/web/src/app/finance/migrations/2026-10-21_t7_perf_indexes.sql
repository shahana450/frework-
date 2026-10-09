-- Task 7: indexes for the busiest finance queries at ~10,000 vouchers per business.
-- Add after timing staging with scripts/seed-10k.ts + e2e/perf.spec.ts. DO NOT run on production before owner approval.
-- `if not exists` makes it safe to run more than once. On a large live table use CREATE INDEX CONCURRENTLY one by one
-- (outside a transaction) instead.

-- Books and Journals: .eq(business_id).order(date desc).order(entry_no desc) — the sort is served by the index
create index if not exists fw_fin_journals_biz_date_entry on fw_fin_journals (business_id, date desc, entry_no desc);

-- Reports / receivables read posted lines per business and date range through the journal
create index if not exists fw_fin_journals_biz_posted_date on fw_fin_journals (business_id, date) where status = 'posted';

-- Lines are always fetched by journal and summed by account
create index if not exists fw_fin_journal_lines_journal_account on fw_fin_journal_lines (journal_id, account_id);

-- Parties list and party look-ups
create index if not exists fw_fin_contacts_biz_name on fw_fin_contacts (business_id, name);

-- Tally push status per business (Books page) — the primary key is (journal_id, provider)
create index if not exists fw_fin_integration_sync_biz_status on fw_fin_integration_sync (business_id, provider, status);

analyze fw_fin_journals; analyze fw_fin_journal_lines; analyze fw_fin_contacts; analyze fw_fin_integration_sync;
