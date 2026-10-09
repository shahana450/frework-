-- B12: a separate voucher number series per type (RV receipts, PV payments, SV sales, PU purchases, JV journals,
-- CV contra, CN/DN notes), numbered per financial year — e.g. RV/2026-27/0001. Configurable per business through
-- fw_fin_businesses.voucher_series (jsonb, e.g. {"receipt":"RCT"}). Already-posted vouchers keep their numbers
-- (JV-2026-NNNN); new series apply from the next entry. Tally imports keep TLY-… numbers as before.
-- Mirrors src/lib/voucherSeries.ts. Safe to run more than once. DO NOT run on production before owner approval.

alter table fw_fin_businesses add column if not exists voucher_series jsonb not null default '{}'::jsonb;

create or replace function fw_fin_series_prefix(p_business uuid, p_type text, p_date date)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_code text; v_fy_start date; v_y int;
begin
  select coalesce(b.voucher_series->>lower(coalesce(p_type, 'journal')), case lower(coalesce(p_type, 'journal'))
           when 'receipt' then 'RV' when 'payment' then 'PV' when 'sales' then 'SV' when 'purchase' then 'PU'
           when 'contra' then 'CV' when 'credit_note' then 'CN' when 'debit_note' then 'DN' else 'JV' end)
    into v_code from fw_fin_businesses b where b.id = p_business;
  v_code := upper(left(regexp_replace(coalesce(v_code, 'JV'), '[^A-Za-z0-9]', '', 'g'), 6));
  if v_code = '' then v_code := 'JV'; end if;
  select start_date into v_fy_start from fw_fin_financial_years
    where business_id = p_business and p_date between start_date and end_date order by start_date desc limit 1;
  -- No financial year set up: Indian FY (April–March) from the entry date
  v_y := coalesce(extract(year from v_fy_start)::int, case when extract(month from p_date) >= 4 then extract(year from p_date)::int else extract(year from p_date)::int - 1 end);
  return v_code || '/' || v_y || '-' || lpad(((v_y + 1) % 100)::text, 2, '0');
end $$;

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

  -- Imported vouchers keep their source number (e.g. TLY-Sales 105) so re-imports are recognised
  if coalesce(p_header->>'entry_no', '') ~ '^TLY-' and coalesce(p_header->>'source', '') = 'tally_import' then
    if exists (select 1 from fw_fin_journals where business_id = p_business and entry_no = p_header->>'entry_no') then
      raise exception 'FW_DUPLICATE: % is already imported', p_header->>'entry_no';
    end if;
    v_entry := p_header->>'entry_no';
  else
    -- B12: one series per voucher type and financial year (RV/2026-27/0001 …); the counter row locks per series
    v_prefix := fw_fin_series_prefix(p_business, coalesce(p_header->>'type', 'journal'), v_date);
    insert into fw_fin_entry_counters (business_id, prefix, last_no) values (p_business, v_prefix, 0)
    on conflict (business_id, prefix) do nothing;
    update fw_fin_entry_counters set last_no = last_no + 1
    where business_id = p_business and prefix = v_prefix
    returning last_no into v_no;
    v_entry := v_prefix || '/' || lpad(v_no::text, 4, '0');
  end if;

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
revoke all on function fw_fin_series_prefix(uuid, text, date) from public, anon, authenticated;
grant execute on function fw_fin_series_prefix(uuid, text, date) to service_role;

-- New-format numbers are unique per business (older JV-YYYY-NNNN data is left untouched — it has known repeats)
create unique index if not exists fw_fin_journals_new_series_unique
  on fw_fin_journals (business_id, entry_no) where entry_no ~ '^[A-Z0-9]{1,6}/[0-9]{4}-[0-9]{2}/[0-9]+$';
