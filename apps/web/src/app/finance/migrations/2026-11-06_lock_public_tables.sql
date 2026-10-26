-- Security fix: fw_users, fw_enquiries and fw_leads could be read by anyone holding the public (anon) key.
-- After this: each signed-in person reads / writes only their own fw_users row; the contact form can still
-- send an enquiry but nobody can read enquiries or leads from the browser. Staff read them through the
-- server (service role), which row-level security doesn't limit. Safe to run more than once.

-- Remove whatever policies these tables had (some allowed everyone to read)
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('fw_users', 'fw_enquiries', 'fw_leads') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table fw_users enable row level security;
alter table fw_enquiries enable row level security;
alter table fw_leads enable row level security;

-- fw_users: your own row only
create policy fw_users_own_select on fw_users for select to authenticated using (id = auth.uid());
create policy fw_users_own_insert on fw_users for insert to authenticated with check (id = auth.uid());
create policy fw_users_own_update on fw_users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- fw_enquiries: anyone may send one (contact form); no one may read them from the browser
create policy fw_enquiries_send on fw_enquiries for insert to anon, authenticated with check (true);

-- fw_leads: written by the server only — no browser policies at all
