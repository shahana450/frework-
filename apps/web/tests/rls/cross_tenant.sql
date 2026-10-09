-- B6 cross-tenant RLS test. Run on a STAGING Supabase project (SQL Editor, as postgres) AFTER
-- 2026-10-18_b6_rls_hardening.sql. Everything happens in one transaction and is ROLLED BACK.
-- It acts as user B exactly like the REST API does (role "authenticated" + JWT claims) and RAISES on any leak.
-- Expected output: "RLS cross-tenant test passed" notice. Any exception = a leak; the message names the table.
begin;

-- Two users and their businesses (A has data; B is the attacker)
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@rls.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@rls.test', 'authenticated', 'authenticated');
insert into fw_fin_businesses (id, owner_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'A Corp'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'B Corp');
insert into fw_fin_chart_of_accounts (id, business_id, name, type, sub_type, code, is_group) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cash', 'asset', 'cash', 'A1', false),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000001', 'Sales', 'income', 'revenue', 'A2', false);
insert into fw_fin_journals (id, business_id, entry_no, date, type, narration, status, total_debit, total_credit) values
  ('aaaaaaaa-0000-0000-0000-0000000000j1', 'aaaaaaaa-0000-0000-0000-000000000001', 'JV-TEST-1', current_date, 'journal', 'A secret sale', 'posted', 100, 100);
insert into fw_fin_journal_lines (journal_id, account_id, dr_amount, cr_amount, sort_order) values
  ('aaaaaaaa-0000-0000-0000-0000000000j1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 100, 0, 1),
  ('aaaaaaaa-0000-0000-0000-0000000000j1', 'aaaaaaaa-0000-0000-0000-0000000000c2', 0, 100, 2);
insert into fw_fin_contacts (business_id, name, type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A Customer', 'customer');
insert into fw_fin_chat_sessions (user_id, business_id, title) values ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'A chat');

-- Become user B, as the REST API would
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"b@rls.test","role":"authenticated"}', true);

do $$
declare t text; n int; a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  -- 1. SELECT with NO filter (as if the REST filter were removed): B must see none of A's rows anywhere
  foreach t in array array['fw_fin_businesses','fw_fin_chart_of_accounts','fw_fin_journals','fw_fin_contacts','fw_fin_documents',
    'fw_fin_financial_years','fw_fin_gst_profiles','fw_fin_invoice_docs','fw_fin_ledgers','fw_fin_shelf_items','fw_fin_ai_suggestions',
    'fw_fin_virtual_ca_chats','fw_fin_audit_log','fw_fin_integration_sync','fw_fin_portal_status','fw_fin_feed_items','fw_fin_team_members'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I where %s = $1', t, case when t = 'fw_fin_businesses' then 'id' else 'business_id' end) into n using a;
    if n > 0 then raise exception 'LEAK (select): user B can read % row(s) of business A in %', n, t; end if;
  end loop;
  select count(*) into n from fw_fin_journal_lines where journal_id = 'aaaaaaaa-0000-0000-0000-0000000000j1';
  if n > 0 then raise exception 'LEAK (select): user B can read A''s journal lines'; end if;
  select count(*) into n from fw_fin_chat_sessions where business_id = a;
  if n > 0 then raise exception 'LEAK (select): user B can read A''s chat sessions'; end if;

  -- Server-only tables: B (any signed-in user) sees nothing at all
  foreach t in array array['fw_fin_entry_counters','fw_fin_connections','fw_fin_wa_links','fw_fin_wa_sessions','fw_fin_wa_seen','fw_fin_portal_links','fw_fin_pending_grants','fw_fin_admins'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'LEAK (select): signed-in users can read server-only table %', t; end if;
  end loop;

  -- 2. UPDATE / DELETE of A's rows must touch nothing
  update fw_fin_businesses set name = 'pwned' where id = a;                get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (update): businesses'; end if;
  update fw_fin_journals set narration = 'pwned' where business_id = a;    get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (update): journals'; end if;
  update fw_fin_chart_of_accounts set name = 'pwned' where business_id = a; get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (update): chart_of_accounts'; end if;
  delete from fw_fin_contacts where business_id = a;                       get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (delete): contacts'; end if;
  delete from fw_fin_journal_lines where journal_id = 'aaaaaaaa-0000-0000-0000-0000000000j1'; get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (delete): journal lines'; end if;
  delete from fw_fin_journals where business_id = a;                       get diagnostics n = row_count; if n > 0 then raise exception 'LEAK (delete): journals'; end if;

  -- 3. INSERT into A's business must be refused
  begin
    insert into fw_fin_journals (business_id, entry_no, date, type, narration, status, total_debit, total_credit) values (a, 'X', current_date, 'journal', 'pwned', 'draft', 1, 1);
    raise exception 'LEAK (insert): user B inserted a journal into business A';
  exception when insufficient_privilege or check_violation then null;
    when others then if sqlerrm like 'LEAK%' then raise; end if;
  end;
  begin
    insert into fw_fin_contacts (business_id, name, type) values (a, 'pwned', 'customer');
    raise exception 'LEAK (insert): user B inserted a contact into business A';
  exception when insufficient_privilege or check_violation then null;
    when others then if sqlerrm like 'LEAK%' then raise; end if;
  end;

  -- 4. Even in HIS OWN business, B cannot write a POSTED journal from the browser (posting is server-side only)
  begin
    insert into fw_fin_journals (business_id, entry_no, date, type, narration, status, total_debit, total_credit)
      values ('bbbbbbbb-0000-0000-0000-000000000001', 'X2', current_date, 'journal', 'bypass engine', 'posted', 1, 1);
    raise exception 'LEAK (insert): a browser user posted a journal directly, bypassing the posting engine';
  exception when insufficient_privilege or check_violation then null;
    when others then if sqlerrm like 'LEAK%' then raise; end if;
  end;

  raise notice 'RLS cross-tenant test passed';
end $$;

rollback;
