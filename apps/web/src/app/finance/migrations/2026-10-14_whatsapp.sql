-- FreBook on WhatsApp: each FreWork user registers their own number; chats post entries and answer questions.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists fw_fin_wa_links (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,                 -- international digits, e.g. 919876543210
  business_id   uuid not null references fw_fin_businesses(id) on delete cascade,
  user_id       uuid not null,                 -- the FreWork user this number acts as (their role applies)
  verified      boolean not null default false,
  code          text,                          -- one-time code the user sends from the phone: LINK 123456
  code_expires  timestamptz,
  created_at    timestamptz not null default now(),
  unique (phone, business_id)
);
create index if not exists fw_fin_wa_links_phone on fw_fin_wa_links (phone) where verified;

create table if not exists fw_fin_wa_sessions (
  phone        text primary key,
  business_id  uuid,                           -- business currently chatting with (numbers linked to several)
  pending      jsonb,                          -- draft entry waiting for YES
  history      jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Meta re-sends a webhook when it doesn't get a quick reply — each message id is handled once
create table if not exists fw_fin_wa_seen (
  message_id  text primary key,
  phone       text not null,
  seen_at     timestamptz not null default now()
);
create index if not exists fw_fin_wa_seen_phone on fw_fin_wa_seen (phone, seen_at desc);

alter table fw_fin_wa_links enable row level security;     -- server (service role) only
alter table fw_fin_wa_sessions enable row level security;
alter table fw_fin_wa_seen enable row level security;
