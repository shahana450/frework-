-- Usage log for the admin costs panel: AI calls (tokens) and WhatsApp messages.
-- Written only by the server (service key); nobody else can read or write it.
create table if not exists fw_usage_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,            -- ai | wa_reply | wa_business
  provider text,
  model text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  units integer default 1
);
create index if not exists fw_usage_log_at on fw_usage_log (at);
create index if not exists fw_usage_log_kind_at on fw_usage_log (kind, at);
alter table fw_usage_log enable row level security;
revoke all on fw_usage_log from anon, authenticated;

-- Totals by day, kind and model since a date (the admin panel reads this; the log can grow large)
create or replace function fw_usage_summary(p_since timestamptz)
returns table (day date, kind text, provider text, model text, calls bigint, input_tokens bigint, output_tokens bigint)
language sql stable security definer set search_path = public as $$
  select (at at time zone 'Asia/Kolkata')::date, kind, coalesce(provider, ''), coalesce(model, ''),
         sum(units)::bigint, sum(input_tokens)::bigint, sum(output_tokens)::bigint
  from fw_usage_log where at >= p_since
  group by 1, 2, 3, 4 order by 1;
$$;
revoke all on function fw_usage_summary(timestamptz) from public, anon, authenticated;
grant execute on function fw_usage_summary(timestamptz) to service_role;
