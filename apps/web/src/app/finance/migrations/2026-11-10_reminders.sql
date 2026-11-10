-- WhatsApp reminders: payments to make (bills, rent, EMIs), daily summary, compliance due dates; customer reminders
-- get more frequencies. Adds one table and a few columns — nothing existing is changed. Safe to run more than once.

create table if not exists fw_fin_payment_reminders (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references fw_fin_businesses(id) on delete cascade,
  kind           text not null default 'payment' check (kind in ('payment', 'emi')),
  title          text not null,
  party          text,
  amount         numeric,
  due_date       date not null,
  repeat         text not null default 'once' check (repeat in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  remind_before  int not null default 3 check (remind_before between 0 and 60),
  every_days     int not null default 1 check (every_days between 1 and 30),
  status         text not null default 'active' check (status in ('active', 'paid', 'stopped')),
  last_sent      date,
  paid_history   jsonb not null default '[]',      -- [{due, paid_on, by}]
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists fw_fin_payment_reminders_biz on fw_fin_payment_reminders (business_id, status, due_date);
alter table fw_fin_payment_reminders enable row level security;
drop policy if exists member_read on fw_fin_payment_reminders;
create policy member_read on fw_fin_payment_reminders for select to authenticated using (fw_fin_is_member(business_id));

-- Per linked WhatsApp number: when and what to send
alter table fw_fin_wa_links add column if not exists remind_hour       int not null default 9;      -- 0–23, India time
alter table fw_fin_wa_links add column if not exists daily_summary     boolean not null default false;
alter table fw_fin_wa_links add column if not exists compliance_alert  boolean not null default false;
alter table fw_fin_wa_links add column if not exists compliance_before int not null default 3;     -- days before a due date
alter table fw_fin_wa_links add column if not exists summary_last      date;
alter table fw_fin_wa_links add column if not exists compliance_last   date;
-- collect_alert now also takes: every3 | fortnightly | monthly (as well as off | daily | weekly)
