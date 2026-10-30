-- Remove financial years saved more than once (same business, same start and end date) and stop it happening again.
-- 1. For each set of copies, keep one: the one marked current, else the oldest.
-- 2. Anything pointing at a copy (voucher series, opening balances, …) is moved to the kept year — every table with a
--    foreign key to fw_fin_financial_years is found automatically, so nothing is left pointing at a deleted row.
-- 3. Delete the copies.
-- 4. A unique index: one year per business per start date.
-- Safe to run more than once. Entries themselves are not touched (they go by date).

begin;

create temp table fy_dupes on commit drop as
select id, keep_id from (
  select id,
         first_value(id) over (partition by business_id, start_date, end_date
                               order by is_current desc nulls last, id) as keep_id
  from fw_fin_financial_years
) x where id <> keep_id;

do $$
declare r record;
begin
  for r in
    select kcu.table_name, kcu.column_name
    from information_schema.referential_constraints rc
    join information_schema.key_column_usage kcu on kcu.constraint_name = rc.constraint_name and kcu.constraint_schema = rc.constraint_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name and ccu.constraint_schema = rc.unique_constraint_schema
    where ccu.table_name = 'fw_fin_financial_years' and kcu.table_schema = 'public'
  loop
    execute format('update public.%I t set %I = d.keep_id from fy_dupes d where t.%I = d.id', r.table_name, r.column_name, r.column_name);
  end loop;
end $$;

delete from fw_fin_financial_years where id in (select id from fy_dupes);

create unique index if not exists fw_fin_financial_years_one_per_start on fw_fin_financial_years (business_id, start_date);

commit;
