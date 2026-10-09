-- FreWork Phase 7 — international groundwork. Run AFTER phase1. Safe to run more than once.
-- Books always balance in the business's base currency; foreign amounts are kept alongside.

-- ── Business: where it is and how it reports ─────────────────────────────────
alter table fw_fin_businesses add column if not exists country text default 'IN';          -- ISO 3166-1 alpha-2
alter table fw_fin_businesses add column if not exists timezone text default 'Asia/Kolkata';
alter table fw_fin_businesses add column if not exists locale text default 'en-IN';
alter table fw_fin_businesses add column if not exists tax_regime text default 'IN_GST';     -- IN_GST | NONE
update fw_fin_businesses set currency = 'INR' where currency is null;

-- ── Entries: transaction currency + rate (base amounts stay in dr_amount/cr_amount) ──
alter table fw_fin_journals add column if not exists currency text;                          -- null = base currency
alter table fw_fin_journals add column if not exists exchange_rate numeric(18,8);            -- base units per 1 foreign unit
alter table fw_fin_journals add column if not exists exchange_rate_date date;
alter table fw_fin_journals add column if not exists posting_date date default current_date;
alter table fw_fin_journal_lines add column if not exists fc_dr numeric(15,2);               -- amount in transaction currency
alter table fw_fin_journal_lines add column if not exists fc_cr numeric(15,2);

-- ── Posting function: same checks as Phase 1, plus currency fields ───────────
create or replace function fw_fin_post_journal(p_business uuid, p_actor uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := coalesce((p_header->>'date')::date, current_date);
  v_dr numeric(15,2) := 0;
  v_cr numeric(15,2) := 0;
  v_line jsonb;
  v_fy record;
  v_prefix text;
  v_no int;
  v_entry text;
  v_id uuid;
  v_bad text;
  v_base text;
  v_cur text := nullif(upper(p_header->>'currency'), '');
  v_rate numeric(18,8) := nullif(p_header->>'exchange_rate', '')::numeric;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'FW_INVALID: an entry needs at least two lines';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if coalesce((v_line->>'dr')::numeric, 0) < 0 or coalesce((v_line->>'cr')::numeric, 0) < 0 then
      raise exception 'FW_INVALID: amounts cannot be negative';
    end if;
    if coalesce((v_line->>'dr')::numeric, 0) > 0 and coalesce((v_line->>'cr')::numeric, 0) > 0 then
      raise exception 'FW_INVALID: a line cannot be both debit and credit';
    end if;
    v_dr := v_dr + round(coalesce((v_line->>'dr')::numeric, 0), 2);
    v_cr := v_cr + round(coalesce((v_line->>'cr')::numeric, 0), 2);
  end loop;
  if v_dr <= 0 or v_dr <> v_cr then
    raise exception 'FW_UNBALANCED: debits % do not equal credits %', v_dr, v_cr;
  end if;

  select coalesce(currency, 'INR') into v_base from fw_fin_businesses where id = p_business;
  if v_cur = v_base then v_cur := null; v_rate := null; end if;
  if v_cur is not null and (v_rate is null or v_rate <= 0) then
    raise exception 'FW_INVALID: an exchange rate is required for % entries', v_cur;
  end if;

  select string_agg(coalesce(a.name, l->>'account_id'), ', ') into v_bad
  from jsonb_array_elements(p_lines) l
  left join fw_fin_chart_of_accounts a on a.id = (l->>'account_id')::uuid and a.business_id = p_business
  where a.id is null or coalesce(a.is_group, false);
  if v_bad is not null then
    raise exception 'FW_ACCOUNT: not a postable account of this business: %', v_bad;
  end if;

  select id, is_locked into v_fy from fw_fin_financial_years
  where business_id = p_business and v_date between start_date and end_date
  order by start_date desc limit 1;
  if v_fy.is_locked and not coalesce((p_header->>'force')::boolean, false) then
    raise exception 'FW_LOCKED: the financial year containing % is locked', v_date;
  end if;

  v_prefix := 'JV-' || to_char(v_date, 'YYYY');
  insert into fw_fin_entry_counters (business_id, prefix, last_no)
  values (p_business, v_prefix, coalesce((
    select max(nullif(regexp_replace(entry_no, '^.*-', ''), '')::int)
    from fw_fin_journals where business_id = p_business and entry_no ~ ('^' || v_prefix || '-[0-9]+$')
  ), 0))
  on conflict (business_id, prefix) do nothing;
  update fw_fin_entry_counters set last_no = last_no + 1
  where business_id = p_business and prefix = v_prefix
  returning last_no into v_no;
  v_entry := v_prefix || '-' || lpad(v_no::text, 4, '0');

  insert into fw_fin_journals (
    business_id, financial_year_id, entry_no, date, posting_date, type, narration, reference_no, party_name,
    status, total_debit, total_credit, created_by, ai_generated, source, metadata, confirmed_at, contact_id,
    currency, exchange_rate, exchange_rate_date
  ) values (
    p_business, v_fy.id, v_entry, v_date, current_date, coalesce(p_header->>'type', 'journal'),
    left(coalesce(p_header->>'narration', ''), 500), nullif(p_header->>'reference_no', ''), nullif(p_header->>'party_name', ''),
    'posted', v_dr, v_cr, p_actor, coalesce((p_header->>'ai_generated')::boolean, false),
    coalesce(p_header->>'source', 'manual'), p_header->'metadata', now(), nullif(p_header->>'contact_id', '')::uuid,
    v_cur, v_rate, case when v_cur is null then null else coalesce(nullif(p_header->>'exchange_rate_date', '')::date, v_date) end
  ) returning id into v_id;

  insert into fw_fin_journal_lines (journal_id, account_id, dr_amount, cr_amount, fc_dr, fc_cr, narration, sort_order)
  select v_id, (l->>'account_id')::uuid, round(coalesce((l->>'dr')::numeric, 0), 2), round(coalesce((l->>'cr')::numeric, 0), 2),
         nullif(l->>'fc_dr', '')::numeric, nullif(l->>'fc_cr', '')::numeric,
         coalesce(l->>'narration', left(coalesce(p_header->>'narration', ''), 200)), ord
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord);

  insert into fw_fin_audit_log (business_id, journal_id, actor, action, source, detail)
  values (p_business, v_id, p_actor, 'post', coalesce(p_header->>'source', 'manual'),
          jsonb_build_object('entry_no', v_entry, 'total', v_dr, 'currency', coalesce(v_cur, v_base), 'exchange_rate', v_rate, 'lines', p_lines, 'metadata', p_header->'metadata'));

  return jsonb_build_object('id', v_id, 'entry_no', v_entry, 'total', v_dr, 'financial_year_id', v_fy.id);
end;
$$;
revoke all on function fw_fin_post_journal(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function fw_fin_post_journal(uuid, uuid, jsonb, jsonb) to service_role;

-- The base currency can't change once anything is posted (it would silently re-denominate the books)
create or replace function fw_fin_guard_base_currency() returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency and exists (select 1 from fw_fin_journals where business_id = old.id and status = 'posted') then
    raise exception 'FW_PROTECTED: base currency cannot change after entries are posted';
  end if;
  return new;
end $$;
drop trigger if exists fw_fin_guard_base_currency on fw_fin_businesses;
create trigger fw_fin_guard_base_currency before update on fw_fin_businesses
  for each row execute function fw_fin_guard_base_currency();
