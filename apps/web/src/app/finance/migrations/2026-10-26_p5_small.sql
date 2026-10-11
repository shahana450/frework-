-- Phase 5 (backend fixes): test companies are flagged and listed separately in the company switcher.
-- Safe to run more than once.
alter table fw_fin_businesses add column if not exists is_test boolean not null default false;

-- Mark your test company (owner runs this with the right name; nothing is marked automatically):
--   update fw_fin_businesses set is_test = true where name = 'AUDIT TEST TRADERS';

notify pgrst, 'reload schema';
