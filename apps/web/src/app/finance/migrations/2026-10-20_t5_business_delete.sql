-- Task 5: "Delete this business" (promised in the Privacy Policy).
-- Soft delete first (deleted_at), then a scheduled job erases the business and everything under it after 30 days.
-- Run AFTER B6 (2026-10-18) and T3 (2026-10-19). If B6 is ever re-run, run this file again afterwards
-- (it re-defines fw_fin_is_member / fw_fin_can_write to hide deleted businesses).
-- DO NOT run on production. Run on STAGING first. Safe to run more than once.

-- ── 1. Columns ────────────────────────────────────────────────────────────────────────────────────
alter table fw_fin_businesses add column if not exists deleted_at timestamptz;
alter table fw_fin_businesses add column if not exists deleted_by uuid;
create index if not exists fw_fin_businesses_deleted on fw_fin_businesses (deleted_at) where deleted_at is not null;

-- ── 2. A deleted business is invisible to every member at once (all business data policies use these) ──
create or replace function fw_fin_is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and not exists (select 1 from fw_fin_businesses where id = b and deleted_at is not null)
    and (
      exists (select 1 from fw_fin_businesses where id = b and owner_id = auth.uid())
      or exists (select 1 from fw_fin_team_members where business_id = b and status = 'active'
                 and lower(invited_email) = lower(coalesce(auth.email(), '')))
      or fw_fin_is_admin()
    );
$$;

create or replace function fw_fin_can_write(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and not exists (select 1 from fw_fin_businesses where id = b and deleted_at is not null)
    and (
      exists (select 1 from fw_fin_businesses where id = b and owner_id = auth.uid())
      or exists (select 1 from fw_fin_team_members where business_id = b and status = 'active'
                 and lower(invited_email) = lower(coalesce(auth.email(), ''))
                 and coalesce(role, 'viewer') in ('owner', 'admin', 'accountant', 'editor'))
      or fw_fin_is_admin()
    );
$$;
revoke all on function fw_fin_is_member(uuid), fw_fin_can_write(uuid) from public, anon;
grant execute on function fw_fin_is_member(uuid), fw_fin_can_write(uuid) to authenticated, service_role;

-- ── 3. Guards step aside ONLY inside the purge function (flag fw.purge_business) ───────────────────
create or replace function fw_fin_guard_journal() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('fw.purge_business', true), '') = 'on' then return coalesce(new, old); end if;
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

create or replace function fw_fin_guard_lines() returns trigger language plpgsql as $$
declare j record;
begin
  if coalesce(current_setting('fw.purge_business', true), '') = 'on' then return coalesce(new, old); end if;
  select status, entry_no, created_at into j from fw_fin_journals where id = coalesce(new.journal_id, old.journal_id);
  if j.status = 'posted' and j.created_at < now() - interval '10 minutes' and j.entry_no not like 'TLY-%' then
    raise exception 'FW_PROTECTED: lines of posted entry % cannot be changed — reverse it and post a correction', j.entry_no;
  end if;
  return coalesce(new, old);
end $$;

create or replace function fw_fin_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_biz uuid; v_journal uuid;
begin
  -- Purging a deleted business: its audit trail goes with it
  if coalesce(current_setting('fw.purge_business', true), '') = 'on' then return coalesce(new, old); end if;
  if tg_table_name = 'fw_fin_journals' then
    v_biz := coalesce(new.business_id, old.business_id); v_journal := coalesce(new.id, old.id);
  else
    v_journal := coalesce(new.journal_id, old.journal_id);
    select business_id into v_biz from fw_fin_journals where id = v_journal;
  end if;
  insert into fw_fin_audit_log (business_id, journal_id, actor, action, source, before, after, detail)
  values (v_biz, v_journal, auth.uid(), lower(tg_op) || ':' || tg_table_name, 'db_trigger',
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end, '{}'::jsonb);
  return coalesce(new, old);
end $$;

-- ── 4. Hard delete after 30 days ───────────────────────────────────────────────────────────────────
-- Keeps only the fact that a purge happened (ids and dates, no business data).
create table if not exists fw_fin_business_purge_log (
  business_id uuid primary key,
  deleted_at  timestamptz not null,
  purged_at   timestamptz not null default now(),
  error       text
);
alter table fw_fin_business_purge_log enable row level security;   -- server only

create or replace function fw_fin_purge_deleted_businesses() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform set_config('fw.purge_business', 'on', true);
  for r in select id, deleted_at from fw_fin_businesses
           where deleted_at is not null and deleted_at < now() - interval '30 days' order by deleted_at loop
    begin
      -- Child tables that don't cascade from fw_fin_businesses
      delete from fw_fin_journal_lines where journal_id in (select id from fw_fin_journals where business_id = r.id);
      delete from fw_fin_journals where business_id = r.id;
      delete from fw_fin_businesses where id = r.id;            -- everything else cascades
      insert into fw_fin_business_purge_log (business_id, deleted_at) values (r.id, r.deleted_at)
        on conflict (business_id) do update set purged_at = now(), error = null;
      n := n + 1;
    exception when others then
      insert into fw_fin_business_purge_log (business_id, deleted_at, error) values (r.id, r.deleted_at, sqlerrm)
        on conflict (business_id) do update set error = excluded.error, purged_at = now();
    end;
  end loop;
  perform set_config('fw.purge_business', '', true);
  return n;
end $$;
revoke all on function fw_fin_purge_deleted_businesses() from public, anon, authenticated;
grant execute on function fw_fin_purge_deleted_businesses() to service_role;

-- ── 5. Schedule it daily with pg_cron (Supabase: Database → Extensions → enable pg_cron first) ──────
-- If pg_cron isn't enabled this step is skipped with a notice; enable it and run this file again.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'fw-purge-deleted-businesses';
    perform cron.schedule('fw-purge-deleted-businesses', '30 21 * * *', 'select fw_fin_purge_deleted_businesses()');  -- 03:00 IST
  else
    raise notice 'pg_cron is not enabled — enable it, then run this file again to schedule the 30-day purge.';
  end if;
end $$;

-- ── Check (staging) ────────────────────────────────────────────────────────────────────────────────
-- select jobname, schedule, command from cron.job where jobname = 'fw-purge-deleted-businesses';
-- select id, name, deleted_at from fw_fin_businesses where deleted_at is not null;
