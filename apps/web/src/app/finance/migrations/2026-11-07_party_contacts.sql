-- Customers & Suppliers were empty: parties made from chat / WhatsApp / imports exist only as ledgers under
-- Sundry Debtors / Creditors. This adds a contact for every such ledger that has none, linked to its ledger.
-- Run AFTER 2026-10-24_p3_parties.sql (it adds fw_fin_contacts.ledger_account_id). Safe to run more than once.
insert into fw_fin_contacts (business_id, name, type, is_active, ledger_account_id)
select a.business_id, a.name, case when a.sub_type = 'trade_receivables' then 'customer' else 'vendor' end, true, a.id
from fw_fin_chart_of_accounts a
where not coalesce(a.is_group, false)
  and a.sub_type in ('trade_receivables', 'trade_payables')
  and lower(trim(a.name)) not in ('debtors control', 'creditors control', 'sundry debtors', 'sundry creditors', 'unidentified customers', 'unidentified suppliers')
  and not exists (
    select 1 from fw_fin_contacts c
    where c.business_id = a.business_id and (c.ledger_account_id = a.id or lower(trim(c.name)) = lower(trim(a.name)))
  );

-- Link contacts that were made by hand to the ledger of the same name
update fw_fin_contacts c set ledger_account_id = a.id
from fw_fin_chart_of_accounts a
where c.ledger_account_id is null and a.business_id = c.business_id and not coalesce(a.is_group, false)
  and lower(trim(a.name)) = lower(trim(c.name)) and a.sub_type in ('trade_receivables', 'trade_payables');
