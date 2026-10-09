-- Task 3.2: renumber duplicate entry numbers (e.g. many JV-2023-0034) left over from before B12.
-- B12 (2026-10-16) already stops NEW duplicates: every posting takes its number from a locked per-series counter,
-- and new-format numbers have a unique index. This file fixes the OLD ones.
--
-- Rules
--   • Duplicates = same business + same entry_no (posted, not TLY- imports, not drafts).
--   • In each group one entry keeps the number: one already pushed to Tally if there is one, otherwise the oldest.
--   • Every other entry in the group gets the next number of its own B12 series (type + financial year),
--     e.g. JV/2023-24/0012 — but ONLY if it has not been pushed to Tally (fw_fin_integration_sync status pushed/found).
--   • Pushed duplicates are NOT changed — Tally has them under the old number. Run step 0 to list them for the owner.
--   • Entries in a locked financial year are not changed either (listed by step 0).
--   • Old → new numbers are kept in fw_fin_entry_renumber_log; the audit trigger also logs each change.
--
-- DO NOT run on production. Run on STAGING after B12 (needs fw_fin_series_prefix). Safe to run more than once.

-- ── 0. Preview (read-only): run this first and send the result to the owner ───────────────────────
-- select * from fw_fin_duplicate_entry_numbers order by business_id, entry_no, keeps desc, created_at;

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

create table if not exists fw_fin_entry_renumber_log (
  journal_id   uuid primary key references fw_fin_journals(id) on delete cascade,
  business_id  uuid not null,
  old_entry_no text not null,
  new_entry_no text not null,
  renumbered_at timestamptz not null default now()
);
alter table fw_fin_entry_renumber_log enable row level security;
drop policy if exists "renumber_log_owner_read" on fw_fin_entry_renumber_log;
create policy "renumber_log_owner_read" on fw_fin_entry_renumber_log for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);

-- ── 1. The journal guard allows exactly one thing extra: changing entry_no inside this migration ────
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

-- ── 2. Renumber ──────────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record; v_prefix text; v_no int; v_new text; n int := 0; held int := 0;
begin
  perform set_config('fw.renumber_duplicates', 'on', true);  -- this transaction only
  for r in
    select d.journal_id, d.business_id, d.entry_no, d.type, d.date
    from fw_fin_duplicate_entry_numbers d
    where d.action = 'will be renumbered'
    order by d.business_id, d.type, d.date, d.created_at, d.journal_id
  loop
    v_prefix := fw_fin_series_prefix(r.business_id, coalesce(r.type, 'journal'), r.date);
    insert into fw_fin_entry_counters (business_id, prefix, last_no) values (r.business_id, v_prefix, 0)
      on conflict (business_id, prefix) do nothing;
    update fw_fin_entry_counters set last_no = last_no + 1
      where business_id = r.business_id and prefix = v_prefix returning last_no into v_no;
    v_new := v_prefix || '/' || lpad(v_no::text, 4, '0');
    update fw_fin_journals set entry_no = v_new where id = r.journal_id;
    insert into fw_fin_entry_renumber_log (journal_id, business_id, old_entry_no, new_entry_no)
      values (r.journal_id, r.business_id, r.entry_no, v_new) on conflict (journal_id) do nothing;
    n := n + 1;
  end loop;
  select count(*) into held from fw_fin_duplicate_entry_numbers where action <> 'keeps number' and action <> 'will be renumbered';
  perform set_config('fw.renumber_duplicates', '', true);
  raise notice 'Renumbered % duplicate entries. % duplicates left for the owner (pushed to Tally or in a locked year).', n, held;
end $$;

-- ── 3. Check: should return only the pushed / locked-year duplicates listed for the owner ──────────
-- select * from fw_fin_duplicate_entry_numbers where action <> 'keeps number';
