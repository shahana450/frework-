-- B6: tenant isolation, rebuilt on one membership rule. Run AFTER every earlier migration. Safe to run more than once.
-- DO NOT run on production before it has passed tests/rls/cross_tenant.sql on a STAGING copy and the owner approves.
--
--   • fw_fin_is_member(b)  — owner, ACTIVE team member (by sign-in email) or a FreWork admin (fw_fin_admins)
--   • fw_fin_can_write(b)  — owner, or an active member whose role may post (owner/admin/accountant/editor)
--   • Business data: members READ; writers WRITE. Journals/lines: the browser may only create/edit DRAFTS —
--     posting, reversing and corrections go through fw_fin_post_journal / fw_fin_reverse_journal (service role).
--   • Server-only tables (counters, integrations, WhatsApp, portals, grants): RLS on, NO browser policy at all.
--   • Audit: every insert/update/delete of a journal or journal line is logged with before/after rows.
--   • anon gets nothing on any fw_fin_* table.

-- ── Admins move from hard-coded emails in policies to a table ───────────────
create table if not exists fw_fin_admins (email text primary key);
insert into fw_fin_admins (email) values ('admin.frework@gmail.com'), ('auditmanagercswa@gmail.com') on conflict do nothing;
alter table fw_fin_admins enable row level security;     -- server only

create or replace function fw_fin_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fw_fin_admins where lower(email) = lower(coalesce(auth.email(), '')));
$$;

create or replace function fw_fin_is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from fw_fin_businesses where id = b and owner_id = auth.uid())
    or exists (select 1 from fw_fin_team_members where business_id = b and status = 'active'
               and lower(invited_email) = lower(coalesce(auth.email(), '')))
    or fw_fin_is_admin()
  );
$$;

create or replace function fw_fin_can_write(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from fw_fin_businesses where id = b and owner_id = auth.uid())
    or exists (select 1 from fw_fin_team_members where business_id = b and status = 'active'
               and lower(invited_email) = lower(coalesce(auth.email(), ''))
               and coalesce(role, 'viewer') in ('owner', 'admin', 'accountant', 'editor'))
    or fw_fin_is_admin()
  );
$$;
revoke all on function fw_fin_is_member(uuid), fw_fin_can_write(uuid), fw_fin_is_admin() from public, anon;
grant execute on function fw_fin_is_member(uuid), fw_fin_can_write(uuid), fw_fin_is_admin() to authenticated, service_role;

-- ── Start clean: drop every existing policy on fw_fin_* tables, enable RLS everywhere ─────────────
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'fw\_fin\_%' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'fw\_fin\_%' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('revoke all on public.%I from anon', r.tablename);
  end loop;
end $$;

-- ── Businesses ──────────────────────────────────────────────────────────────
create policy biz_read   on fw_fin_businesses for select to authenticated using (fw_fin_is_member(id));
create policy biz_create on fw_fin_businesses for insert to authenticated with check (owner_id = auth.uid());
create policy biz_update on fw_fin_businesses for update to authenticated using (fw_fin_can_write(id)) with check (fw_fin_can_write(id));
create policy biz_delete on fw_fin_businesses for delete to authenticated using (owner_id = auth.uid());

-- ── Business data: members read, writers write ─────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['fw_fin_chart_of_accounts', 'fw_fin_contacts', 'fw_fin_documents', 'fw_fin_financial_years',
                           'fw_fin_gst_profiles', 'fw_fin_invoice_docs', 'fw_fin_ledgers', 'fw_fin_shelf_items',
                           'fw_fin_ai_suggestions', 'fw_fin_virtual_ca_chats'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy member_read on public.%I for select to authenticated using (fw_fin_is_member(business_id))', t);
    execute format('create policy writer_insert on public.%I for insert to authenticated with check (fw_fin_can_write(business_id))', t);
    execute format('create policy writer_update on public.%I for update to authenticated using (fw_fin_can_write(business_id)) with check (fw_fin_can_write(business_id))', t);
    execute format('create policy writer_delete on public.%I for delete to authenticated using (fw_fin_can_write(business_id))', t);
  end loop;
  -- Read-only for members (written by the server)
  foreach t in array array['fw_fin_audit_log', 'fw_fin_integration_sync', 'fw_fin_portal_status', 'fw_fin_feed_items'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy member_read on public.%I for select to authenticated using (fw_fin_is_member(business_id))', t);
  end loop;
end $$;

-- Team list: members see it, only the owner changes it
create policy team_read  on fw_fin_team_members for select to authenticated using (fw_fin_is_member(business_id));
create policy team_owner on fw_fin_team_members for all to authenticated
  using (exists (select 1 from fw_fin_businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from fw_fin_businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- ── Journals: the browser handles DRAFTS only; posting is server-side (fw_fin_post_journal) ─────
create policy journal_read   on fw_fin_journals for select to authenticated using (fw_fin_is_member(business_id));
create policy journal_draft_insert on fw_fin_journals for insert to authenticated with check (fw_fin_can_write(business_id) and status = 'draft');
create policy journal_draft_update on fw_fin_journals for update to authenticated
  using (fw_fin_can_write(business_id) and status = 'draft') with check (fw_fin_can_write(business_id) and status in ('draft', 'voided'));
create policy journal_draft_delete on fw_fin_journals for delete to authenticated using (fw_fin_can_write(business_id) and status = 'draft');

create policy jline_read on fw_fin_journal_lines for select to authenticated
  using (exists (select 1 from fw_fin_journals j where j.id = journal_id and fw_fin_is_member(j.business_id)));
create policy jline_draft_write on fw_fin_journal_lines for all to authenticated
  using (exists (select 1 from fw_fin_journals j where j.id = journal_id and j.status = 'draft' and fw_fin_can_write(j.business_id)))
  with check (exists (select 1 from fw_fin_journals j where j.id = journal_id and j.status = 'draft' and fw_fin_can_write(j.business_id)));

-- ── Chat sessions: your own, in a business you belong to ────────────────────
create policy chat_own on fw_fin_chat_sessions for all to authenticated
  using (user_id = auth.uid() and fw_fin_is_member(business_id)) with check (user_id = auth.uid() and fw_fin_is_member(business_id));

-- ── Subscriptions (table exists only in the live DB): your own rows, read-only ───────────────
do $$ begin
  if to_regclass('public.fw_fin_subscriptions') is not null then
    execute 'create policy sub_own_read on public.fw_fin_subscriptions for select to authenticated using (user_id = auth.uid())';
  end if;
end $$;
-- Server-only (no browser policy): entry_counters, connections, wa_links, wa_sessions, wa_seen, portal_links,
-- pending_grants, admins. RLS is on and no policy exists, so authenticated/anon get nothing.

-- ── Storage: Shelf and logos are private; objects are under "<business_id>/…" ──────────────
do $$ begin
  if exists (select 1 from storage.buckets where id = 'shelf') then
    update storage.buckets set public = false where id = 'shelf';
    drop policy if exists shelf_member_read on storage.objects;
    create policy shelf_member_read on storage.objects for select to authenticated
      using (bucket_id = 'shelf' and fw_fin_is_member(nullif(split_part(name, '/', 1), '')::uuid));
  end if;
end $$;

-- ── Audit log: who, when, before → after for every journal / line change ───────────────────
alter table fw_fin_audit_log add column if not exists before jsonb;
alter table fw_fin_audit_log add column if not exists after jsonb;

create or replace function fw_fin_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_biz uuid; v_journal uuid;
begin
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
drop trigger if exists fw_fin_audit_journals on fw_fin_journals;
create trigger fw_fin_audit_journals after update or delete on fw_fin_journals for each row execute function fw_fin_audit_row();
drop trigger if exists fw_fin_audit_lines on fw_fin_journal_lines;
create trigger fw_fin_audit_lines after update or delete on fw_fin_journal_lines for each row execute function fw_fin_audit_row();
-- (Inserts are already logged by fw_fin_post_journal with the full entry.)
