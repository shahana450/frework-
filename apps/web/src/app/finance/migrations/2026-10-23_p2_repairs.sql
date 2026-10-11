-- Phase 2 (backend fixes): REPAIR SCRIPTS — scoped to one company, DRY RUN by default.
-- Requires 2026-10-22_p1_journal_rules.sql. Replaces the all-companies renumbering in 2026-10-19_t3 (do not run T3's
-- step 2 — this file has a per-company version). Nothing here deletes or edits amounts of posted entries:
-- mis-mapped bank entries are REVERSED and RE-POSTED; duplicate numbers get a new number (old → new logged).
--
-- How to run (Supabase → SQL Editor). Replace the ids. Your user id: Authentication → Users.
--   1. Preview — changes nothing:
--        select * from fw_fin_repair_bank_mismap('<company_id>', '<bank_ledger_id>', '<your_user_id>');
--        select * from fw_fin_repair_renumber('<company_id>');
--        select * from fw_fin_repair_tb('<company_id>', '<bank_ledger_id>');      -- trial balance before vs after
--   2. Apply:
--        select * from fw_fin_repair_bank_mismap('<company_id>', '<bank_ledger_id>', '<your_user_id>', false);
--        select * from fw_fin_repair_renumber('<company_id>', false);
--   3. Check: select * from fw_fin_trial_balance('<company_id>');
-- Find ids:  select id, name from fw_fin_businesses;
--            select id, name, sub_type from fw_fin_chart_of_accounts where business_id = '<company_id>' and sub_type in ('bank','cash');
-- Entries in a LOCKED year are reported, not changed: unlock that year (Settings → Financial Years), run, lock again.

-- ── Trial balance (signed: debit − credit) ─────────────────────────────────────────────────────────────────────
create or replace function fw_fin_trial_balance(p_business uuid)
returns table (account_id uuid, code text, name text, type text, debit numeric, credit numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.code, a.name, a.type,
         round(coalesce(sum(l.dr_amount), 0), 2), round(coalesce(sum(l.cr_amount), 0), 2),
         round(coalesce(sum(l.dr_amount), 0) - coalesce(sum(l.cr_amount), 0), 2)
  from fw_fin_chart_of_accounts a
  join fw_fin_journal_lines l on l.account_id = a.id
  join fw_fin_journals j on j.id = l.journal_id and j.status = 'posted'
  where a.business_id = p_business
  group by a.id, a.code, a.name, a.type
  having round(coalesce(sum(l.dr_amount), 0) - coalesce(sum(l.cr_amount), 0), 2) <> 0
  order by a.type, a.name
$$;

-- Is this a cash/bank ledger? (Bank Charges / Bank Interest / loans are not.)
create or replace function fw_fin_is_cash_bank(p_account uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select a.sub_type in ('bank', 'cash') or a.type in ('bank', 'cash')
            or (a.name ~* '\m(cash|bank)\M' and a.name !~* '(charge|commission|interest|fee|loan)' and coalesce(a.type, 'asset') = 'asset')
           from fw_fin_chart_of_accounts a where a.id = p_account), false)
$$;

-- ── Plan: bank-import entries posted against the wrong ledger ────────────────────────────────────────────────────
-- A bank-import entry (source statement / bank_import) with two lines is wrong when no line is a cash/bank ledger
-- (e.g. "Dr Creditors Control / Cr Bank Charges ₹20,00,000") or the same ledger is on both sides
-- (e.g. "Dr Bank Charges / Cr Bank Charges ₹9"). The line that stood in for the bank is replaced by p_bank:
--   • a ledger with "bank" in its name that is not a bank (Bank Charges …), or
--   • for same-ledger entries, the credit line (money out) — or the debit line when the entry is a receipt.
create or replace function fw_fin_repair_bank_plan(p_business uuid, p_bank uuid)
returns table (journal_id uuid, entry_no text, date date, amount numeric, problem text, old_lines jsonb, new_lines jsonb, new_type text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_lines jsonb; v_same boolean; v_has_bank boolean; v_replace int; v_new jsonb; i int;
begin
  for r in
    select j.id, j.entry_no, j.date, j.type, j.total_debit
    from fw_fin_journals j
    where j.business_id = p_business and j.status = 'posted' and j.reversed_by is null and j.reversal_of is null
      and coalesce(j.source, '') in ('statement', 'bank_import')
      and (select count(*) from fw_fin_journal_lines l where l.journal_id = j.id) = 2
    order by j.date, j.entry_no
  loop
    select jsonb_agg(jsonb_build_object('account_id', l.account_id, 'name', a.name, 'dr', l.dr_amount, 'cr', l.cr_amount, 'bank', fw_fin_is_cash_bank(l.account_id)) order by l.sort_order)
      into v_lines from fw_fin_journal_lines l join fw_fin_chart_of_accounts a on a.id = l.account_id where l.journal_id = r.id;
    v_same := (v_lines->0->>'account_id') = (v_lines->1->>'account_id');
    v_has_bank := (v_lines->0->>'bank')::boolean or (v_lines->1->>'bank')::boolean;
    continue when v_has_bank and not v_same;
    v_replace := null;
    if v_same then
      v_replace := case when r.type = 'receipt' then (case when (v_lines->0->>'dr')::numeric > 0 then 0 else 1 end)
                        else (case when (v_lines->0->>'cr')::numeric > 0 then 0 else 1 end) end;
    else
      for i in 0..1 loop
        if (v_lines->i->>'name') ~* 'bank' then v_replace := i; end if;
      end loop;
    end if;
    journal_id := r.id; entry_no := r.entry_no; date := r.date; amount := r.total_debit; old_lines := v_lines;
    if v_replace is null then
      problem := 'no cash/bank ledger and no line that stood in for the bank — needs a manual decision'; new_lines := null; new_type := null;
      return next; continue;
    end if;
    problem := case when v_same then 'same ledger on both sides' else '"' || (v_lines->v_replace->>'name') || '" acted as the bank' end;
    v_new := jsonb_build_array(
      jsonb_build_object('account_id', case when v_replace = 0 then p_bank::text else v_lines->0->>'account_id' end, 'dr', (v_lines->0->>'dr')::numeric, 'cr', (v_lines->0->>'cr')::numeric),
      jsonb_build_object('account_id', case when v_replace = 1 then p_bank::text else v_lines->1->>'account_id' end, 'dr', (v_lines->1->>'dr')::numeric, 'cr', (v_lines->1->>'cr')::numeric));
    new_lines := v_new;
    new_type := case when (v_lines->v_replace->>'cr')::numeric > 0 then 'payment' else 'receipt' end;
    return next;
  end loop;
end $$;

-- ── Apply: reverse each wrong entry and post the corrected one (dry run returns the plan only) ─────────────────
create or replace function fw_fin_repair_bank_mismap(p_business uuid, p_bank uuid, p_actor uuid, p_dry_run boolean default true)
returns table (entry_no text, date date, amount numeric, problem text, action text, reversal_no text, corrected_no text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare p record; v_rev jsonb; v_new jsonb; v_orig record;
begin
  if not exists (select 1 from fw_fin_chart_of_accounts where id = p_bank and business_id = p_business and not coalesce(is_group, false)) or not fw_fin_is_cash_bank(p_bank) then
    raise exception 'p_bank must be a bank or cash ledger of this company';
  end if;
  for p in select * from fw_fin_repair_bank_plan(p_business, p_bank) loop
    entry_no := p.entry_no; date := p.date; amount := p.amount; problem := p.problem; reversal_no := null; corrected_no := null;
    if p.new_lines is null then action := 'manual review'; return next; continue; end if;
    if p_dry_run then action := 'would reverse and re-post as ' || p.new_type || ' against the bank'; return next; continue; end if;
    begin
      select narration, reference_no, party_name, contact_id into v_orig from fw_fin_journals where id = p.journal_id;
      v_rev := fw_fin_reverse_journal(p_business, p_actor, p.journal_id, 'Repair: bank import posted against the wrong ledger', p.date);
      v_new := fw_fin_post_journal(p_business, p_actor, jsonb_build_object(
        'date', p.date, 'type', p.new_type, 'narration', left('Corrected: ' || coalesce(v_orig.narration, ''), 500),
        'reference_no', p.entry_no, 'party_name', v_orig.party_name, 'contact_id', v_orig.contact_id, 'source', 'repair',
        'metadata', jsonb_build_object('repair_of', p.journal_id, 'bank_account_id', p_bank, 'repair', 'bank_mismap')), p.new_lines);
      action := 'reversed and re-posted'; reversal_no := v_rev->>'entry_no'; corrected_no := v_new->>'entry_no';
    exception when others then
      action := 'skipped: ' || regexp_replace(sqlerrm, '^FW_[A-Z_]+:\s*', '');
    end;
    return next;
  end loop;
end $$;

-- ── Duplicate voucher numbers (per company) ─────────────────────────────────────────────────────────────────────
create table if not exists fw_fin_entry_renumber_log (
  journal_id   uuid primary key references fw_fin_journals(id) on delete cascade,
  business_id  uuid not null,
  old_entry_no text not null,
  new_entry_no text not null,
  renumbered_at timestamptz not null default now()
);
alter table fw_fin_entry_renumber_log enable row level security;

-- The journal guard allows exactly one extra change: a new entry_no while fw.renumber_duplicates is on (this function only)
create or replace function fw_fin_guard_journal() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' and old.entry_no not like 'TLY-%' and old.created_at < now() - interval '10 minutes' then
      raise exception 'FW_PROTECTED: posted entry % cannot be deleted — reverse it instead', old.entry_no;
    end if;
    return old;
  end if;
  if old.status = 'posted' and (
       new.date is distinct from old.date or new.business_id is distinct from old.business_id
    or new.total_debit is distinct from old.total_debit or new.total_credit is distinct from old.total_credit
    or (new.entry_no is distinct from old.entry_no and coalesce(current_setting('fw.renumber_duplicates', true), '') <> 'on')
    or (new.status is distinct from old.status and not (new.status = 'voided' and old.created_at > now() - interval '10 minutes'))
  ) then
    raise exception 'FW_PROTECTED: posted entry % cannot be changed — reverse it and post a correction', old.entry_no;
  end if;
  return new;
end $$;

create or replace view fw_fin_duplicate_entry_numbers as
with base as (
  select j.id, j.business_id, j.entry_no, j.type, j.date, j.created_at,
         exists (select 1 from fw_fin_integration_sync s
                 where s.journal_id = j.id and s.provider = 'tally' and s.status in ('pushed', 'found')) as pushed,
         coalesce((select bool_or(fy.is_locked) from fw_fin_financial_years fy
                   where fy.business_id = j.business_id and j.date between fy.start_date and fy.end_date), false) as year_locked
  from fw_fin_journals j
  where j.status = 'posted' and j.entry_no not like 'TLY-%' and j.entry_no not like 'DRAFT-%'
), grouped as (
  select b.*, count(*) over (partition by b.business_id, b.entry_no) as copies,
         row_number() over (partition by b.business_id, b.entry_no order by b.pushed desc, b.created_at, b.id) as rn
  from base b
)
select id as journal_id, business_id, entry_no, type, date, created_at, pushed, year_locked, copies,
       (rn = 1) as keeps,
       case when rn = 1 then 'keeps number'
            when pushed then 'PUSHED DUPLICATE — owner decides'
            when year_locked then 'locked year — not changed'
            else 'will be renumbered' end as action
from grouped where copies > 1;
revoke all on fw_fin_duplicate_entry_numbers from public, anon, authenticated;

create or replace function fw_fin_repair_renumber(p_business uuid, p_dry_run boolean default true)
returns table (entry_no text, date date, type text, action text, new_entry_no text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_prefix text; v_no int; v_sim jsonb := '{}'::jsonb;
begin
  if not p_dry_run then perform set_config('fw.renumber_duplicates', 'on', true); end if;
  for r in
    select d.* from fw_fin_duplicate_entry_numbers d where d.business_id = p_business
    order by d.entry_no, d.keeps desc, d.type, d.date, d.created_at, d.journal_id
  loop
    entry_no := r.entry_no; date := r.date; type := r.type; action := r.action; new_entry_no := null;
    if r.action = 'will be renumbered' then
      v_prefix := fw_fin_series_prefix(p_business, coalesce(r.type, 'journal'), r.date);
      if p_dry_run then
        v_no := coalesce((v_sim->>v_prefix)::int, (select next_no from fw_fin_voucher_series where business_id = p_business and prefix = v_prefix), 1);
        v_sim := v_sim || jsonb_build_object(v_prefix, v_no + 1);
      else
        insert into fw_fin_voucher_series (business_id, voucher_type, prefix, next_no) values (p_business, coalesce(r.type, 'journal'), v_prefix, 1)
          on conflict (business_id, prefix) do nothing;
        select next_no into v_no from fw_fin_voucher_series where business_id = p_business and prefix = v_prefix for update;
        update fw_fin_voucher_series set next_no = next_no + 1 where business_id = p_business and prefix = v_prefix;
      end if;
      new_entry_no := v_prefix || '/' || lpad(v_no::text, 4, '0');
      if not p_dry_run then
        update fw_fin_journals set entry_no = new_entry_no where id = r.journal_id;
        insert into fw_fin_entry_renumber_log (journal_id, business_id, old_entry_no, new_entry_no)
          values (r.journal_id, p_business, r.entry_no, new_entry_no) on conflict (journal_id) do nothing;
        action := 'renumbered';
      else
        action := 'would renumber';
      end if;
    end if;
    return next;
  end loop;
  if not p_dry_run then perform set_config('fw.renumber_duplicates', '', true); end if;
end $$;

-- ── Trial balance before vs after the bank repair (projected from the plan in a dry run) ────────────────────────
create or replace function fw_fin_repair_tb(p_business uuid, p_bank uuid)
returns table (code text, name text, before_balance numeric, after_balance numeric, change numeric)
language sql stable security definer set search_path = public as $$
  with tb as (select account_id, balance from fw_fin_trial_balance(p_business)),
  plan as (select * from fw_fin_repair_bank_plan(p_business, p_bank) where new_lines is not null),
  delta as (
    select (x->>'account_id')::uuid as account_id, -((x->>'dr')::numeric - (x->>'cr')::numeric) as d from plan, jsonb_array_elements(plan.old_lines) x
    union all
    select (x->>'account_id')::uuid, (x->>'dr')::numeric - (x->>'cr')::numeric from plan, jsonb_array_elements(plan.new_lines) x
  ),
  agg as (select account_id, sum(d) as d from delta group by account_id),
  ids as (select account_id from tb union select account_id from agg)
  select a.code, a.name, coalesce(tb.balance, 0), round(coalesce(tb.balance, 0) + coalesce(agg.d, 0), 2), round(coalesce(agg.d, 0), 2)
  from ids join fw_fin_chart_of_accounts a on a.id = ids.account_id
  left join tb on tb.account_id = ids.account_id left join agg on agg.account_id = ids.account_id
  order by abs(coalesce(agg.d, 0)) desc, a.name
$$;

revoke all on function fw_fin_trial_balance(uuid), fw_fin_is_cash_bank(uuid), fw_fin_repair_bank_plan(uuid, uuid),
  fw_fin_repair_bank_mismap(uuid, uuid, uuid, boolean), fw_fin_repair_renumber(uuid, boolean), fw_fin_repair_tb(uuid, uuid)
  from public, anon, authenticated;
