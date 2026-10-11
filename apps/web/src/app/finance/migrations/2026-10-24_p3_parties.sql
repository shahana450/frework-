-- Phase 3 (backend fixes): party ledgers everywhere; Debtors/Creditors Control become group totals.
-- Requires 2026-10-22_p1 and 2026-10-23_p2. Run on STAGING first. Safe to run more than once.
--   • fw_fin_contacts.ledger_account_id — each customer/supplier has ONE ledger under Sundry Debtors / Creditors.
--   • fw_fin_journal_lines.party_id     — filled automatically for lines on a party ledger.
--   • fw_fin_journals.against_invoice_id — a receipt/payment can say which invoice/bill it settles.
--   • fw_fin_invoice_docs.party_id.
--   • fw_fin_repair_control_ledgers(company, actor, dry_run) — moves every posting on a control ledger to the party's own
--     ledger by REVERSAL + RE-POST (party from the entry's contact or party name; otherwise "Unidentified customers /
--     suppliers"), then turns the emptied control ledgers into GROUPS so nothing can be posted to them again.
-- Order for a company: p2 bank repair → p2 renumber → THIS control repair.

alter table fw_fin_contacts       add column if not exists ledger_account_id uuid references fw_fin_chart_of_accounts(id);
alter table fw_fin_journal_lines  add column if not exists party_id uuid references fw_fin_contacts(id);
alter table fw_fin_journals       add column if not exists against_invoice_id uuid references fw_fin_journals(id);
do $$ begin
  if to_regclass('public.fw_fin_invoice_docs') is not null then
    alter table fw_fin_invoice_docs add column if not exists party_id uuid references fw_fin_contacts(id);
  end if;
end $$;
create index if not exists fw_fin_contacts_ledger on fw_fin_contacts (ledger_account_id);
create index if not exists fw_fin_journal_lines_party on fw_fin_journal_lines (party_id) where party_id is not null;

-- Link contacts to existing ledgers with the same name (party ledgers made by B2 / FreBook)
update fw_fin_contacts c set ledger_account_id = a.id
from fw_fin_chart_of_accounts a
where c.ledger_account_id is null and a.business_id = c.business_id and not coalesce(a.is_group, false)
  and lower(trim(a.name)) = lower(trim(c.name)) and a.sub_type in ('trade_receivables', 'trade_payables');

-- A line on a party ledger carries that party
create or replace function fw_fin_line_party() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.party_id is null then
    select id into new.party_id from fw_fin_contacts where ledger_account_id = new.account_id limit 1;
  end if;
  return new;
end $$;
drop trigger if exists fw_fin_line_party on fw_fin_journal_lines;
create trigger fw_fin_line_party before insert on fw_fin_journal_lines for each row execute function fw_fin_line_party();
-- …and lines already posted get it too (party_id is not an amount; the posted-entry guard is on journals)
update fw_fin_journal_lines l set party_id = c.id
from fw_fin_contacts c where l.party_id is null and c.ledger_account_id = l.account_id;

-- The party's own ledger: found or created once, under Sundry Debtors (customer) or Sundry Creditors (supplier)
create or replace function fw_fin_ensure_party_ledger(p_business uuid, p_name text, p_kind text, p_contact uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_acc uuid; v_contact uuid := p_contact; v_sub text; v_type text; v_name text := trim(p_name);
begin
  v_sub := case when p_kind = 'supplier' then 'trade_payables' else 'trade_receivables' end;
  v_type := case when p_kind = 'supplier' then 'liability' else 'asset' end;
  if v_contact is not null then select ledger_account_id into v_acc from fw_fin_contacts where id = v_contact and business_id = p_business; end if;
  if v_acc is null then
    select id into v_acc from fw_fin_chart_of_accounts
     where business_id = p_business and not coalesce(is_group, false) and lower(trim(name)) = lower(v_name) and sub_type = v_sub limit 1;
  end if;
  if v_acc is null then
    insert into fw_fin_chart_of_accounts (business_id, name, type, sub_type, code, is_group, is_system, description)
    values (p_business, v_name, v_type, v_sub, 'PTY-' || substr(md5(p_business::text || lower(v_name) || v_sub), 1, 8), false, false,
            case when p_kind = 'supplier' then 'Supplier ledger (Sundry Creditors)' else 'Customer ledger (Sundry Debtors)' end)
    returning id into v_acc;
  end if;
  if v_contact is null then
    select id into v_contact from fw_fin_contacts where business_id = p_business and lower(trim(name)) = lower(v_name) limit 1;
    if v_contact is null and v_name !~* '^unidentified' then
      insert into fw_fin_contacts (business_id, name, type, ledger_account_id) values (p_business, v_name, case when p_kind = 'supplier' then 'supplier' else 'customer' end, v_acc)
      returning id into v_contact;
    end if;
  end if;
  if v_contact is not null then update fw_fin_contacts set ledger_account_id = v_acc where id = v_contact and ledger_account_id is null; end if;
  return v_acc;
end $$;

-- Control ledgers: "Debtors Control", "Creditors Control", "Sundry Debtors", "Sundry Creditors" used as posting ledgers
create or replace view fw_fin_control_ledgers as
select a.id, a.business_id, a.name, case when a.name ~* 'debtor|receivable' then 'customer' else 'supplier' end as kind
from fw_fin_chart_of_accounts a
where not coalesce(a.is_group, false) and a.name ~* '^(sundry\s+)?(debtors|creditors|trade\s+(receivables|payables))(\s+control)?$';
revoke all on fw_fin_control_ledgers from public, anon, authenticated;

create or replace function fw_fin_repair_control_ledgers(p_business uuid, p_actor uuid, p_dry_run boolean default true)
returns table (entry_no text, date date, control text, amount numeric, party text, action text, reversal_no text, corrected_no text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_party uuid; v_pname text; v_lines jsonb; v_rev jsonb; v_new jsonb; c record;
begin
  for r in
    select distinct j.id, j.entry_no, j.date, j.type, j.narration, j.reference_no, j.party_name, j.contact_id, j.source, cl.id as control_id, cl.name as control_name, cl.kind,
           (select sum(l.dr_amount + l.cr_amount) from fw_fin_journal_lines l where l.journal_id = j.id and l.account_id = cl.id) as amt
    from fw_fin_journals j
    join fw_fin_journal_lines l on l.journal_id = j.id
    join fw_fin_control_ledgers cl on cl.id = l.account_id
    where j.business_id = p_business and j.status = 'posted' and j.reversed_by is null and j.reversal_of is null
    order by j.date, j.entry_no
  loop
    v_pname := coalesce(nullif(trim((select name from fw_fin_contacts where id = r.contact_id)), ''), nullif(trim(r.party_name), ''),
                        case when r.kind = 'customer' then 'Unidentified customers' else 'Unidentified suppliers' end);
    entry_no := r.entry_no; date := r.date; control := r.control_name; amount := r.amt; party := v_pname; reversal_no := null; corrected_no := null;
    if p_dry_run then action := 'would move to "' || v_pname || '"'; return next; continue; end if;
    begin
      v_party := fw_fin_ensure_party_ledger(p_business, v_pname, r.kind, r.contact_id);
      select jsonb_agg(jsonb_build_object('account_id', case when l.account_id = r.control_id then v_party else l.account_id end,
                                          'dr', l.dr_amount, 'cr', l.cr_amount, 'narration', l.narration) order by l.sort_order)
        into v_lines from fw_fin_journal_lines l where l.journal_id = r.id;
      v_rev := fw_fin_reverse_journal(p_business, p_actor, r.id, 'Repair: move from ' || r.control_name || ' to the party ledger', r.date);
      v_new := fw_fin_post_journal(p_business, p_actor, jsonb_build_object(
        'date', r.date, 'type', r.type, 'narration', left(coalesce(r.narration, ''), 500), 'reference_no', coalesce(r.reference_no, r.entry_no),
        'party_name', v_pname, 'contact_id', r.contact_id, 'source', 'repair',
        'metadata', jsonb_build_object('repair_of', r.id, 'repair', 'control_to_party')), v_lines);
      action := 'moved to "' || v_pname || '"'; reversal_no := v_rev->>'entry_no'; corrected_no := v_new->>'entry_no';
    exception when others then
      action := 'skipped: ' || regexp_replace(sqlerrm, '^FW_[A-Z_]+:\s*', '');
    end;
    return next;
  end loop;

  -- Emptied control ledgers become groups: totals of the party ledgers, never posted to again
  if not p_dry_run then
    for c in select id, name from fw_fin_control_ledgers where business_id = p_business loop
      if not exists (select 1 from fw_fin_journal_lines l join fw_fin_journals j on j.id = l.journal_id
                     where l.account_id = c.id and j.status = 'posted' and j.reversed_by is null and j.reversal_of is null) then
        update fw_fin_chart_of_accounts set is_group = true where id = c.id;
        entry_no := null; date := null; control := c.name; amount := null; party := null; action := 'now a group (no direct postings)'; reversal_no := null; corrected_no := null;
        return next;
      end if;
    end loop;
  end if;
end $$;

revoke all on function fw_fin_ensure_party_ledger(uuid, text, text, uuid), fw_fin_repair_control_ledgers(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function fw_fin_ensure_party_ledger(uuid, text, text, uuid) to service_role;

notify pgrst, 'reload schema';

-- Run (preview first):
--   select * from fw_fin_repair_control_ledgers('<company_id>', '<your_user_id>');          -- dry run
--   select * from fw_fin_repair_control_ledgers('<company_id>', '<your_user_id>', false);   -- apply
