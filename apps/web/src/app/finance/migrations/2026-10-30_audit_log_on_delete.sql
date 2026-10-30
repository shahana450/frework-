-- Deleting an entry failed: the audit trigger runs AFTER the delete and logs the entry's id in journal_id, which must
-- point at an existing entry — and the entry is already gone. So every delete (e.g. "Clear Tally imports") was refused.
-- Fix: when the entry itself is deleted, log it with journal_id empty and keep its id in detail. Nothing else changes.
-- Safe to run more than once.

create or replace function fw_fin_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_biz uuid; v_journal uuid; v_detail jsonb := '{}'::jsonb;
begin
  -- Purging a deleted business: its audit trail goes with it
  if coalesce(current_setting('fw.purge_business', true), '') = 'on' then return coalesce(new, old); end if;
  if tg_table_name = 'fw_fin_journals' then
    v_biz := coalesce(new.business_id, old.business_id); v_journal := coalesce(new.id, old.id);
  else
    v_journal := coalesce(new.journal_id, old.journal_id);
    select business_id into v_biz from fw_fin_journals where id = v_journal;
  end if;
  if v_biz is null then return coalesce(new, old); end if;   -- lines of an entry already gone: nothing to tie them to
  -- The entry no longer exists (deleted, or its lines deleted along with it): keep the id in detail only
  if tg_op = 'DELETE' and not exists (select 1 from fw_fin_journals where id = v_journal) then
    v_detail := jsonb_build_object('journal_id', v_journal); v_journal := null;
  end if;
  insert into fw_fin_audit_log (business_id, journal_id, actor, action, source, before, after, detail)
  values (v_biz, v_journal, auth.uid(), lower(tg_op) || ':' || tg_table_name, 'db_trigger',
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end, v_detail);
  return coalesce(new, old);
end $$;
