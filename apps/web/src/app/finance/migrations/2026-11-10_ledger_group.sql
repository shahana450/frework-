-- The exact group a ledger sits under (Duties & Taxes, Stock-in-Hand, Loans & Advances…), as chosen in Edit ledger.
-- Type / sub_type stay as they are for the reports; this keeps the finer group that several heads share.
-- Adds one nullable column — nothing existing changes. Safe to run more than once.
alter table fw_fin_chart_of_accounts add column if not exists group_key text;
