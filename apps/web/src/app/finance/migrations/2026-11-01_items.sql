-- Items (products / services) a business sells: picked on invoices to fill HSN, price, GST and unit.
-- Filled one by one or in bulk from an Excel template. Run once in Supabase → SQL Editor. Safe to re-run.
create table if not exists fw_fin_items (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  name        text not null,
  hsn         text,
  unit        text default 'NOS',
  rate        numeric(15,2) default 0,      -- selling price, before GST
  gst_rate    numeric(5,2)  default 18,
  is_service  boolean default false,
  is_active   boolean default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists fw_fin_items_biz_name on fw_fin_items (business_id, lower(name));

alter table fw_fin_items enable row level security;
drop policy if exists member_read on fw_fin_items;
drop policy if exists writer_insert on fw_fin_items;
drop policy if exists writer_update on fw_fin_items;
drop policy if exists writer_delete on fw_fin_items;
create policy member_read   on fw_fin_items for select to authenticated using (fw_fin_is_member(business_id));
create policy writer_insert on fw_fin_items for insert to authenticated with check (fw_fin_can_write(business_id));
create policy writer_update on fw_fin_items for update to authenticated using (fw_fin_can_write(business_id)) with check (fw_fin_can_write(business_id));
create policy writer_delete on fw_fin_items for delete to authenticated using (fw_fin_can_write(business_id));
grant select, insert, update, delete on fw_fin_items to authenticated;
