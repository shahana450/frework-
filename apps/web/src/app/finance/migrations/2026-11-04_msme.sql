-- MSME suppliers for section 43B(h): Udyam type and number, and whether the credit period is agreed in writing
-- (if not, the limit is 15 days; if agreed, the agreed credit_days up to 45). Safe to run more than once.
alter table fw_fin_contacts add column if not exists msme_type text check (msme_type in ('micro', 'small', 'medium'));
alter table fw_fin_contacts add column if not exists udyam_no text;
alter table fw_fin_contacts add column if not exists msme_written_terms boolean not null default false;
