-- Inventory, full: godowns / branches / job workers, batches with expiry, inter-branch transfers, job work (ITC-04),
-- production and scrap. Run once in Supabase → SQL Editor, after 2026-11-01_items.sql and 2026-11-02_inventory.sql.
-- Safe to re-run. Nothing existing is removed: columns are added, the movement kinds are widened, one table is new.

-- Items: more detail
alter table fw_fin_items add column if not exists sku             text;
alter table fw_fin_items add column if not exists category        text;
alter table fw_fin_items add column if not exists brand           text;
alter table fw_fin_items add column if not exists mrp             numeric(15,2);
alter table fw_fin_items add column if not exists purchase_rate   numeric(15,2);           -- last / standard cost
alter table fw_fin_items add column if not exists valuation       text not null default 'fifo';   -- fifo | avg
alter table fw_fin_items add column if not exists track_batch     boolean not null default false;
alter table fw_fin_items add column if not exists track_expiry    boolean not null default false;
alter table fw_fin_items add column if not exists shelf_life_days integer;
alter table fw_fin_items add column if not exists max_qty         numeric(15,3);
alter table fw_fin_items add column if not exists is_capital_good boolean not null default false;  -- job work: 3 years instead of 1

-- Where stock sits: own godowns, branches (same or another GSTIN), and job workers holding your material
create table if not exists fw_fin_godowns (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  name        text not null,
  kind        text not null default 'godown' check (kind in ('godown', 'branch', 'job_worker')),
  gstin       text,
  state       text,
  address     text,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists fw_fin_godowns_biz_name on fw_fin_godowns (business_id, lower(name));

alter table fw_fin_godowns enable row level security;
drop policy if exists member_read on fw_fin_godowns;
drop policy if exists writer_insert on fw_fin_godowns;
drop policy if exists writer_update on fw_fin_godowns;
drop policy if exists writer_delete on fw_fin_godowns;
create policy member_read   on fw_fin_godowns for select to authenticated using (fw_fin_is_member(business_id));
create policy writer_insert on fw_fin_godowns for insert to authenticated with check (fw_fin_can_write(business_id));
create policy writer_update on fw_fin_godowns for update to authenticated using (fw_fin_can_write(business_id)) with check (fw_fin_can_write(business_id));
create policy writer_delete on fw_fin_godowns for delete to authenticated using (fw_fin_can_write(business_id));
grant select, insert, update, delete on fw_fin_godowns to authenticated;

-- Movements: location, batch, expiry, document reference and the pair a transfer / job-work challan belongs to
alter table fw_fin_stock_moves add column if not exists godown_id   uuid references fw_fin_godowns(id) on delete set null;
alter table fw_fin_stock_moves add column if not exists batch       text;
alter table fw_fin_stock_moves add column if not exists mfg_date    date;
alter table fw_fin_stock_moves add column if not exists expiry      date;
alter table fw_fin_stock_moves add column if not exists ref_no      text;      -- bill / invoice / delivery challan no.
alter table fw_fin_stock_moves add column if not exists party       text;      -- supplier, customer or job worker
alter table fw_fin_stock_moves add column if not exists transfer_id uuid;      -- both legs of a transfer or a job-work round share it

alter table fw_fin_stock_moves drop constraint if exists fw_fin_stock_moves_kind_check;
alter table fw_fin_stock_moves add constraint fw_fin_stock_moves_kind_check check (kind in (
  'purchase', 'sale', 'adjustment', 'return',
  'transfer_out', 'transfer_in',          -- between your own godowns / branches
  'jobwork_out', 'jobwork_in',            -- sent to / received back from a job worker (delivery challan)
  'consume', 'produce', 'scrap'           -- manufacturing: raw material used, finished goods made, waste
));
create index if not exists fw_fin_stock_moves_godown on fw_fin_stock_moves (business_id, godown_id);
create index if not exists fw_fin_stock_moves_transfer on fw_fin_stock_moves (transfer_id) where transfer_id is not null;
create index if not exists fw_fin_stock_moves_expiry on fw_fin_stock_moves (business_id, expiry) where expiry is not null;
