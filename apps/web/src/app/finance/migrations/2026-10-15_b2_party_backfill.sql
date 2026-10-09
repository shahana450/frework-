-- B2 backfill: move each named party's balance out of "Debtors Control" / "Creditors Control" into the party's own ledger.
-- Posted entries are immutable, so nothing is rewritten: one reclassification entry per party is POSTED through
-- fw_fin_post_journal (same engine, same checks, audit-logged).
--   • Idempotent  — each entry carries metadata.client_key = 'b2-backfill:<control>:<party>'; re-running skips parties already done.
--   • Reversible  — run fw_fin_b2_backfill_undo(business_id, actor) to reverse every entry this created.
--   • Party names come from fw_fin_journals.party_name (what the draft recorded). Entries without a party name stay in
--     the control ledger and are listed by fw_fin_b2_unnamed() for the owner to tag.
-- DO NOT run against production until the owner approves and it has been tried on a copy (staging) of the database.

create or replace function fw_fin_b2_backfill(p_business uuid, p_actor uuid, p_date date default current_date)
returns table (party text, control text, amount numeric, entry_no text)
language plpgsql security definer set search_path = public as $$
declare
  r record; v_party uuid; v_control uuid; v_key text; v_res jsonb; v_sub text; v_type text;
begin
  for r in
    select j.party_name as pname, a.id as control_id, a.name as control_name,
           case when a.name ilike '%debtor%' or a.sub_type = 'trade_receivables' then 'debtors' else 'creditors' end as side,
           sum(l.dr_amount - l.cr_amount) as net
    from fw_fin_journal_lines l
    join fw_fin_journals j on j.id = l.journal_id
    join fw_fin_chart_of_accounts a on a.id = l.account_id
    where j.business_id = p_business and j.status = 'posted'
      and a.name ~* '^(debtors|creditors) control$'
      and coalesce(trim(j.party_name), '') <> ''
      and coalesce(j.metadata->>'b2_backfill', '') = ''
    group by j.party_name, a.id, a.name, a.sub_type
    having abs(sum(l.dr_amount - l.cr_amount)) >= 0.01
  loop
    v_key := 'b2-backfill:' || r.control_name || ':' || lower(trim(r.pname));
    continue when exists (select 1 from fw_fin_journals where business_id = p_business and metadata->>'client_key' = v_key and status <> 'voided');

    -- The party's own ledger (created once, under Sundry Debtors / Creditors)
    v_sub := case when r.side = 'debtors' then 'trade_receivables' else 'trade_payables' end;
    v_type := case when r.side = 'debtors' then 'asset' else 'liability' end;
    select id into v_party from fw_fin_chart_of_accounts
      where business_id = p_business and lower(trim(name)) = lower(trim(r.pname)) and not is_group limit 1;
    if v_party is null then
      insert into fw_fin_chart_of_accounts (business_id, name, type, sub_type, code, is_group, is_system, description)
      values (p_business, trim(r.pname), v_type, v_sub, 'B2-' || substr(md5(r.pname), 1, 8), false, false, 'Party ledger created by the B2 backfill')
      returning id into v_party;
    end if;

    -- Positive net = the control ledger holds a debit for this party → Dr party / Cr control (and the reverse)
    v_res := fw_fin_post_journal(p_business, p_actor, jsonb_build_object(
      'date', p_date, 'type', 'journal', 'source', 'b2_backfill',
      'narration', 'Reclassify ' || r.pname || ' from ' || r.control_name || ' to its own ledger',
      'party_name', r.pname,
      'metadata', jsonb_build_object('client_key', v_key, 'b2_backfill', 'reclass', 'control', r.control_name)
    ), jsonb_build_array(
      jsonb_build_object('account_id', case when r.net > 0 then v_party else r.control_id end, 'dr', abs(r.net), 'cr', 0, 'narration', 'B2 reclassification'),
      jsonb_build_object('account_id', case when r.net > 0 then r.control_id else v_party end, 'dr', 0, 'cr', abs(r.net), 'narration', 'B2 reclassification')
    ));
    party := r.pname; control := r.control_name; amount := r.net; entry_no := v_res->>'entry_no';
    return next;
  end loop;
end $$;

-- Undo: reverse every reclassification the backfill posted (history kept — reversals, not deletes)
create or replace function fw_fin_b2_backfill_undo(p_business uuid, p_actor uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from fw_fin_journals
    where business_id = p_business and metadata->>'b2_backfill' = 'reclass' and status = 'posted' and reversed_by is null
  loop
    perform fw_fin_reverse_journal(p_business, p_actor, r.id, 'Undo B2 party backfill');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Entries still sitting in a control ledger with no party name — for the owner to tag
create or replace function fw_fin_b2_unnamed(p_business uuid)
returns table (entry_no text, date date, narration text, amount numeric)
language sql security definer set search_path = public as $$
  select j.entry_no, j.date, j.narration, sum(l.dr_amount - l.cr_amount)
  from fw_fin_journal_lines l join fw_fin_journals j on j.id = l.journal_id join fw_fin_chart_of_accounts a on a.id = l.account_id
  where j.business_id = p_business and j.status = 'posted' and a.name ~* '^(debtors|creditors) control$' and coalesce(trim(j.party_name), '') = ''
  group by j.entry_no, j.date, j.narration order by j.date;
$$;

revoke all on function fw_fin_b2_backfill(uuid, uuid, date) from public, anon, authenticated;
revoke all on function fw_fin_b2_backfill_undo(uuid, uuid) from public, anon, authenticated;
revoke all on function fw_fin_b2_unnamed(uuid) from public, anon, authenticated;
grant execute on function fw_fin_b2_backfill(uuid, uuid, date), fw_fin_b2_backfill_undo(uuid, uuid), fw_fin_b2_unnamed(uuid) to service_role;
