-- FreWork Phase 1 — posting engine. Safe to run more than once. Run AFTER phase0.
-- Every journal posted through the app goes through fw_fin_post_journal: one transaction,
-- validated, numbered without gaps or repeats, and audit-logged. Corrections use
-- fw_fin_reverse_journal (a reversing entry), never an overwrite.

-- ── Audit log ────────────────────────────────────────────────────────────────
create table if not exists fw_fin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  journal_id uuid references fw_fin_journals(id) on delete set null,
  actor uuid,
  action text not null,            -- post | reverse | void | edit
  source text,                     -- ai_copilot | statement | manual | tally | whatsapp …
  reason text,
  detail jsonb
);
create index if not exists fw_fin_audit_log_biz on fw_fin_audit_log (business_id, at desc);
create index if not exists fw_fin_audit_log_journal on fw_fin_audit_log (journal_id);
alter table fw_fin_audit_log enable row level security;
drop policy if exists "audit_owner_read" on fw_fin_audit_log;
create policy "audit_owner_read" on fw_fin_audit_log for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);

-- ── Entry number counters (one per business + prefix) ────────────────────────
create table if not exists fw_fin_entry_counters (
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  prefix text not null,
  last_no int not null default 0,
  primary key (business_id, prefix)
);
alter table fw_fin_entry_counters enable row level security;

alter table fw_fin_journals add column if not exists reversal_of uuid references fw_fin_journals(id);
alter table fw_fin_journals add column if not exists reversed_by uuid references fw_fin_journals(id);
alter table fw_fin_journals add column if not exists contact_id uuid references fw_fin_contacts(id);

-- ── Post one journal ─────────────────────────────────────────────────────────
-- p_header: {date, type, narration, reference_no, party_name, source, ai_generated, metadata, force}
-- p_lines:  [{account_id, dr, cr, narration}]
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
  v_count int := 0;
  v_bad text;
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

  -- every account must belong to this business and accept postings
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
    business_id, financial_year_id, entry_no, date, type, narration, reference_no, party_name,
    status, total_debit, total_credit, created_by, ai_generated, source, metadata, confirmed_at, contact_id
  ) values (
    p_business, v_fy.id, v_entry, v_date, coalesce(p_header->>'type', 'journal'),
    left(coalesce(p_header->>'narration', ''), 500), nullif(p_header->>'reference_no', ''), nullif(p_header->>'party_name', ''),
    'posted', v_dr, v_cr, p_actor, coalesce((p_header->>'ai_generated')::boolean, false),
    coalesce(p_header->>'source', 'manual'), p_header->'metadata', now(), nullif(p_header->>'contact_id', '')::uuid
  ) returning id into v_id;

  insert into fw_fin_journal_lines (journal_id, account_id, dr_amount, cr_amount, narration, sort_order)
  select v_id, (l->>'account_id')::uuid, round(coalesce((l->>'dr')::numeric, 0), 2), round(coalesce((l->>'cr')::numeric, 0), 2),
         coalesce(l->>'narration', left(coalesce(p_header->>'narration', ''), 200)), ord
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord);

  insert into fw_fin_audit_log (business_id, journal_id, actor, action, source, detail)
  values (p_business, v_id, p_actor, 'post', coalesce(p_header->>'source', 'manual'),
          jsonb_build_object('entry_no', v_entry, 'total', v_dr, 'lines', p_lines, 'metadata', p_header->'metadata'));

  return jsonb_build_object('id', v_id, 'entry_no', v_entry, 'total', v_dr, 'financial_year_id', v_fy.id);
end;
$$;

-- ── Reverse a posted journal (corrections without rewriting history) ─────────
create or replace function fw_fin_reverse_journal(p_business uuid, p_actor uuid, p_journal uuid, p_reason text, p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j record;
  v_lines jsonb;
  v_res jsonb;
begin
  select * into v_j from fw_fin_journals where id = p_journal and business_id = p_business for update;
  if not found then raise exception 'FW_NOT_FOUND: entry not found'; end if;
  if v_j.status <> 'posted' then raise exception 'FW_INVALID: only posted entries can be reversed'; end if;
  if v_j.reversed_by is not null then raise exception 'FW_INVALID: entry % is already reversed', v_j.entry_no; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'FW_INVALID: a reason is required'; end if;

  select jsonb_agg(jsonb_build_object('account_id', account_id, 'dr', cr_amount, 'cr', dr_amount, 'narration', 'Reversal: ' || coalesce(narration, '')) order by sort_order)
  into v_lines from fw_fin_journal_lines where journal_id = p_journal;

  v_res := fw_fin_post_journal(p_business, p_actor, jsonb_build_object(
    'date', coalesce(p_date, current_date), 'type', v_j.type,
    'narration', 'Reversal of ' || v_j.entry_no || ' — ' || p_reason,
    'reference_no', v_j.entry_no, 'source', 'reversal',
    'metadata', jsonb_build_object('reversal_of', v_j.entry_no, 'reason', p_reason)
  ), v_lines);

  update fw_fin_journals set reversal_of = p_journal where id = (v_res->>'id')::uuid;
  update fw_fin_journals set reversed_by = (v_res->>'id')::uuid, updated_at = now() where id = p_journal;
  insert into fw_fin_audit_log (business_id, journal_id, actor, action, source, reason, detail)
  values (p_business, p_journal, p_actor, 'reverse', 'reversal', p_reason, jsonb_build_object('reversal_entry', v_res->>'entry_no'));
  return v_res;
end;
$$;

-- Only the server (service role) may call these; it checks the user's access first.
revoke all on function fw_fin_post_journal(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function fw_fin_reverse_journal(uuid, uuid, uuid, text, date) from public, anon, authenticated;
grant execute on function fw_fin_post_journal(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function fw_fin_reverse_journal(uuid, uuid, uuid, text, date) to service_role;
