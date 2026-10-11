-- Phase 1 (backend fixes): stop new bad data.
--   1. Journal rules in the database: a line is never both debit and credit (CHECK), the same ledger can't be on both
--      sides, receipts/payments must use a cash/bank ledger, the date must be inside a financial year.
--   2. Voucher numbering through fw_fin_voucher_series (business, FY, voucher type, prefix, next_no), locked with
--      SELECT … FOR UPDATE inside the posting transaction. Default series: INV (sales), RCT (receipts), PMT (payments),
--      PUR (purchases), JV (journals), CTR (contra), CN/DN (notes) — e.g. INV/2026-27/0001. FY comes from the entry date.
--   3. Bank import batches: each batch stores its bank_account_id; imported entries carry bank_account_id / bank_ref.
-- Requires 2026-10-16_b12_voucher_series.sql first. Safe to run more than once.
-- Run on STAGING first. Existing rows are not changed; repairs are in the Phase 2 scripts.

-- ── 1. Lines: never both debit and credit, never negative (checked for new rows; old rows are left for the repair) ──
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fw_fin_journal_lines_one_side') then
    alter table fw_fin_journal_lines add constraint fw_fin_journal_lines_one_side
      check (coalesce(dr_amount, 0) >= 0 and coalesce(cr_amount, 0) >= 0 and not (coalesce(dr_amount, 0) > 0 and coalesce(cr_amount, 0) > 0)) not valid;
  end if;
end $$;

-- ── 2. Voucher series ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists fw_fin_voucher_series (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references fw_fin_businesses(id) on delete cascade,
  fy_id        uuid references fw_fin_financial_years(id) on delete set null,
  voucher_type text not null,
  prefix       text not null,            -- e.g. INV/2026-27
  next_no      int  not null default 1,
  created_at   timestamptz not null default now(),
  unique (business_id, prefix)
);
alter table fw_fin_voucher_series enable row level security;

-- Carry the B12 counters over so numbering continues where it left off
do $$ begin
  if to_regclass('public.fw_fin_entry_counters') is not null then
    insert into fw_fin_voucher_series (business_id, voucher_type, prefix, next_no)
    select business_id, 'journal', prefix, last_no + 1 from fw_fin_entry_counters
    on conflict (business_id, prefix) do update set next_no = greatest(fw_fin_voucher_series.next_no, excluded.next_no);
  end if;
end $$;

-- Default codes: INV / RCT / PMT / PUR / JV / CTR / CN / DN (still overridable per business in fw_fin_businesses.voucher_series)
create or replace function fw_fin_series_prefix(p_business uuid, p_type text, p_date date)
returns text language plpgsql stable security definer set search_path = public as $fn$
declare
  v_code text; v_fy_start date; v_y int;
begin
  select coalesce(b.voucher_series->>lower(coalesce(p_type, 'journal')), case lower(coalesce(p_type, 'journal'))
           when 'sales' then 'INV' when 'receipt' then 'RCT' when 'payment' then 'PMT' when 'purchase' then 'PUR'
           when 'contra' then 'CTR' when 'credit_note' then 'CN' when 'debit_note' then 'DN' else 'JV' end)
    into v_code from fw_fin_businesses b where b.id = p_business;
  v_code := upper(left(regexp_replace(coalesce(v_code, 'JV'), '[^A-Za-z0-9]', '', 'g'), 6));
  if v_code = '' then v_code := 'JV'; end if;
  -- FY from the entry date: the business's FY containing it, else April–March
  select start_date into v_fy_start from fw_fin_financial_years
    where business_id = p_business and p_date between start_date and end_date order by start_date desc limit 1;
  v_y := coalesce(extract(year from v_fy_start)::int, case when extract(month from p_date) >= 4 then extract(year from p_date)::int else extract(year from p_date)::int - 1 end);
  return v_code || '/' || v_y || '-' || lpad(((v_y + 1) % 100)::text, 2, '0');
end $fn$;

-- One number per business + FY + voucher type (new-format numbers; old JV-YYYY-NNNN repeats are fixed by the repair)
create unique index if not exists fw_fin_journals_series_no_unique
  on fw_fin_journals (business_id, financial_year_id, type, entry_no)
  where entry_no ~ '^[A-Z0-9]{1,6}/[0-9]{4}-[0-9]{2}/[0-9]+$';

-- ── 3. Bank import batches ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists fw_fin_bank_import_batches (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references fw_fin_businesses(id) on delete cascade,
  bank_account_id uuid not null references fw_fin_chart_of_accounts(id),
  file_name       text,
  row_count       int not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now()
);
alter table fw_fin_bank_import_batches enable row level security;
create index if not exists fw_fin_bank_import_batches_biz on fw_fin_bank_import_batches (business_id, created_at desc);
-- Duplicate checks look entries up by bank account + date, and by cheque/UTR ref
create index if not exists fw_fin_journals_bank_acct_date on fw_fin_journals (business_id, (metadata->>'bank_account_id'), date) where metadata ? 'bank_account_id';
create index if not exists fw_fin_journals_bank_ref on fw_fin_journals (business_id, (metadata->>'bank_ref')) where metadata ? 'bank_ref';

-- ── 4. The posting function with the Phase 1 rules ───────────────────────────────────────────────────────────────
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
  v_type text := lower(coalesce(p_header->>'type', 'journal'));
  v_has_fy boolean;
  v_series record;
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

  -- Reversals mirror an existing entry line for line, so these rules apply to everything except reversals
  if coalesce(p_header->>'source', '') <> 'reversal' then
  -- Phase 1: the same ledger can't be on both sides of one entry
  select a.name into v_bad from jsonb_array_elements(p_lines) d
    join jsonb_array_elements(p_lines) c on (d->>'account_id') = (c->>'account_id')
    join fw_fin_chart_of_accounts a on a.id = (d->>'account_id')::uuid
   where coalesce((d->>'dr')::numeric, 0) > 0 and coalesce((c->>'cr')::numeric, 0) > 0 limit 1;
  if v_bad is not null then
    raise exception 'FW_INVALID: "%" is on both the debit and the credit side', v_bad;
  end if;

  -- Receipts debit cash/bank, payments credit cash/bank (Bank Charges / Bank Interest are not bank ledgers)
  if v_type in ('receipt', 'payment') and not exists (
    select 1 from jsonb_array_elements(p_lines) l join fw_fin_chart_of_accounts a on a.id = (l->>'account_id')::uuid
     where (a.sub_type in ('bank', 'cash') or a.type in ('bank', 'cash')
            or (a.name ~* '\m(cash|bank)\M' and a.name !~* '(charge|commission|interest|fee|loan)' and coalesce(a.type, 'asset') = 'asset'))
       and ((v_type = 'receipt' and coalesce((l->>'dr')::numeric, 0) > 0) or (v_type = 'payment' and coalesce((l->>'cr')::numeric, 0) > 0))) then
    raise exception 'FW_INVALID: a % must % a cash or bank ledger', v_type, case when v_type = 'receipt' then 'debit' else 'credit' end;
  end if;
  end if;

  select id, is_locked into v_fy from fw_fin_financial_years
  where business_id = p_business and v_date between start_date and end_date
  order by start_date desc limit 1;
  -- The date must fall in one of the business's financial years (when any are set up)
  select exists (select 1 from fw_fin_financial_years where business_id = p_business) into v_has_fy;
  if v_has_fy and v_fy.id is null and coalesce(p_header->>'source', '') not in ('opening_balances', 'reversal') then
    raise exception 'FW_INVALID: % is outside your financial years', v_date;
  end if;
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
    -- Phase 1: one series per business + financial year + voucher type; the row is locked until this transaction ends
    v_prefix := fw_fin_series_prefix(p_business, v_type, v_date);
    insert into fw_fin_voucher_series (business_id, fy_id, voucher_type, prefix, next_no)
    values (p_business, v_fy.id, v_type, v_prefix, 1)
    on conflict (business_id, prefix) do nothing;
    select * into v_series from fw_fin_voucher_series where business_id = p_business and prefix = v_prefix for update;
    v_no := v_series.next_no;
    update fw_fin_voucher_series set next_no = next_no + 1, fy_id = coalesce(fy_id, v_fy.id) where id = v_series.id;
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

notify pgrst, 'reload schema';
