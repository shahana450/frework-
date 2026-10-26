-- READ ONLY. Lists entries hit by the bank-import bug, per business: an expense-named ledger used as a bank
-- ("Bank Charges" with sub-type bank), the same ledger on both sides, or a bank import with no real bank line.
-- Nothing is changed. Review the list, then reverse those entries in FreBook (Journal → Reverse) and import again.
with lines as (
  select j.business_id, b.name as business, j.id, j.entry_no, j.date, j.narration, j.source,
         a.name as ledger, a.sub_type, l.dr_amount, l.cr_amount
  from fw_fin_journals j
  join fw_fin_businesses b on b.id = j.business_id
  join fw_fin_journal_lines l on l.journal_id = j.id
  join fw_fin_chart_of_accounts a on a.id = l.account_id
  where j.status = 'posted' and j.reversed_by is null
)
select business, entry_no, date, narration, string_agg(ledger || ' ' || case when dr_amount > 0 then 'Dr ' || dr_amount else 'Cr ' || cr_amount end, ' | ') as lines,
       case
         when bool_or(sub_type = 'bank' and ledger ~* '(charge|interest|commission|fee)') then 'Expense ledger set up as a bank'
         when count(distinct ledger) = 1 then 'Same ledger on both sides'
         when bool_and(coalesce(sub_type, '') not in ('bank', 'cash')) and max(source) in ('bank_import', 'statement') then 'Bank import without a bank line'
       end as problem
from lines
group by business, id, entry_no, date, narration
having bool_or(sub_type = 'bank' and ledger ~* '(charge|interest|commission|fee)')
    or count(distinct ledger) = 1
    or (bool_and(coalesce(sub_type, '') not in ('bank', 'cash')) and max(source) in ('bank_import', 'statement'))
order by business, date;

-- Ledgers wrongly set up as banks (fix their group in Chart of Accounts → Indirect Expenses)
select b.name as business, a.name as ledger, a.sub_type
from fw_fin_chart_of_accounts a join fw_fin_businesses b on b.id = a.business_id
where a.sub_type = 'bank' and a.name ~* '(charge|interest|commission|fee)';
