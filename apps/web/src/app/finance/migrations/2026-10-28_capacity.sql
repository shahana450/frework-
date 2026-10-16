-- Capacity for the admin panel: database size, file storage and monthly active users (to know when to upgrade).
create or replace function fw_capacity()
returns table (db_bytes bigint, storage_bytes bigint, storage_files bigint, users_total bigint, mau bigint)
language sql stable security definer set search_path = public, auth, storage as $$
  select pg_database_size(current_database())::bigint,
         coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)::bigint,
         (select count(*) from storage.objects)::bigint,
         (select count(*) from auth.users)::bigint,
         (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days')::bigint;
$$;
revoke all on function fw_capacity() from public, anon, authenticated;
grant execute on function fw_capacity() to service_role;
