-- B5: the Tally company each business is linked to. Tally push refuses to send to any other company.
-- Safe to run more than once. DO NOT run on production before owner approval.
alter table fw_fin_businesses add column if not exists tally_company text;
