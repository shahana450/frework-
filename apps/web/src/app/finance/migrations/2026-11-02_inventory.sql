-- Basic inventory: each item's opening quantity and reorder level, and every movement of stock (in from purchases or
-- adjustments, out from sales). On hand = opening + all movements. Run once in Supabase → SQL Editor. Safe to re-run.
-- Nothing existing is changed: two columns are added to items, and one new table.

alter table fw_fin_items add column if not exists opening_qty   numeric(15,3) not null default 0;
alter table fw_fin_items add column if not exists opening_rate  numeric(15,2) not null default 0;   -- cost per unit
alter table fw_fin_items add column if not exists reorder_level numeric(15,3) not null default 0;
alter table fw_fin_items add column if not exists track_stock   boolean not null default true;

create table if not exists fw_fin_stock_moves (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  item_id     uuid not null references fw_fin_items(id) on delete cascade,
  date        date not null,
  qty         numeric(15,3) not null,              -- + in (purchase, adjustment up), − out (sale, adjustment down)
  rate        numeric(15,2) not null default 0,    -- cost (in) or selling price (out) per unit
  kind        text not null check (kind in ('purchase', 'sale', 'adjustment', 'return')),
  journal_id  uuid references fw_fin_journals(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid
);
create index if not exists fw_fin_stock_moves_item on fw_fin_stock_moves (business_id, item_id, date);
-- One movement per item per entry (a sales invoice posting its lines twice can't double the stock)
create unique index if not exists fw_fin_stock_moves_once on fw_fin_stock_moves (journal_id, item_id) where journal_id is not null;

alter table fw_fin_stock_moves enable row level security;
drop policy if exists member_read on fw_fin_stock_moves;
drop policy if exists writer_insert on fw_fin_stock_moves;
drop policy if exists writer_update on fw_fin_stock_moves;
drop policy if exists writer_delete on fw_fin_stock_moves;
create policy member_read   on fw_fin_stock_moves for select to authenticated using (fw_fin_is_member(business_id));
create policy writer_insert on fw_fin_stock_moves for insert to authenticated with check (fw_fin_can_write(business_id));
create policy writer_update on fw_fin_stock_moves for update to authenticated using (fw_fin_can_write(business_id)) with check (fw_fin_can_write(business_id));
create policy writer_delete on fw_fin_stock_moves for delete to authenticated using (fw_fin_can_write(business_id));
grant select, insert, update, delete on fw_fin_stock_moves to authenticated;
