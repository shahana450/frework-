-- FreWork Phase 6 — accounting controls. Run AFTER phase0 and phase1. Safe to run more than once.

-- ── 1. Posted entries can't be silently rewritten ────────────────────────────
-- Corrections go through reversals (fw_fin_reverse_journal). Exceptions kept on purpose:
--   • lines may be added to a posted entry within 10 minutes of it being created (multi-step imports)
--   • Tally-imported copies (entry_no TLY-…) may be deleted, because Tally remains their source
--   • drafts are unrestricted
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
    or new.entry_no is distinct from old.entry_no
    or (new.status is distinct from old.status and not (new.status = 'voided' and old.created_at > now() - interval '10 minutes'))
  ) then
    raise exception 'FW_PROTECTED: posted entry % cannot be changed — reverse it and post a correction', old.entry_no;
  end if;
  return new;
end $$;
drop trigger if exists fw_fin_guard_journal on fw_fin_journals;
create trigger fw_fin_guard_journal before update or delete on fw_fin_journals
  for each row execute function fw_fin_guard_journal();

create or replace function fw_fin_guard_lines() returns trigger language plpgsql as $$
declare j record;
begin
  select status, entry_no, created_at into j from fw_fin_journals where id = coalesce(new.journal_id, old.journal_id);
  if j.status = 'posted' and j.created_at < now() - interval '10 minutes' and j.entry_no not like 'TLY-%' then
    raise exception 'FW_PROTECTED: lines of posted entry % cannot be changed — reverse it and post a correction', j.entry_no;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists fw_fin_guard_lines on fw_fin_journal_lines;
create trigger fw_fin_guard_lines before insert or update or delete on fw_fin_journal_lines
  for each row execute function fw_fin_guard_lines();

-- ── 2. Locked years stay locked for every write path, not only the app ───────
create or replace function fw_fin_guard_locked_year() returns trigger language plpgsql as $$
declare locked boolean;
begin
  if new.status <> 'posted' then return new; end if;
  select bool_or(is_locked) into locked from fw_fin_financial_years
  where business_id = new.business_id and new.date between start_date and end_date;
  if coalesce(locked, false) and coalesce(new.metadata->>'force_locked', '') <> 'true' then
    raise exception 'FW_LOCKED: the financial year containing % is locked', new.date;
  end if;
  return new;
end $$;
drop trigger if exists fw_fin_guard_locked_year on fw_fin_journals;
create trigger fw_fin_guard_locked_year before insert on fw_fin_journals
  for each row execute function fw_fin_guard_locked_year();

alter table fw_fin_financial_years add column if not exists is_closed boolean default false;
alter table fw_fin_financial_years add column if not exists locked_at timestamptz;
alter table fw_fin_financial_years add column if not exists locked_by uuid;

-- ── 3. Integration sync status (Tally today, others later) ───────────────────
create table if not exists fw_fin_integration_sync (
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  journal_id uuid not null references fw_fin_journals(id) on delete cascade,
  provider text not null,                 -- 'tally' …
  status text not null,                   -- 'pushed' | 'failed' | 'found'
  external_ref text,                      -- e.g. Tally voucher number
  target text,                            -- e.g. Tally company name
  error text,
  synced_by uuid,
  synced_at timestamptz not null default now(),
  primary key (journal_id, provider)
);
create index if not exists fw_fin_integration_sync_biz on fw_fin_integration_sync (business_id, provider);
alter table fw_fin_integration_sync enable row level security;
drop policy if exists "sync_owner_read" on fw_fin_integration_sync;
create policy "sync_owner_read" on fw_fin_integration_sync for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);
