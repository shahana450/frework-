-- Email-forward bank import (FreBook)
-- Clients auto-forward bank alert and e-statement emails to admin@frework.online. A Microsoft 365 rule redirects
-- them to Amazon SES, which stores the raw email in S3 and notifies /api/inbound/email.
-- Every write goes through server routes (service role). Owners can read their own rows; queues are admin-only.
-- Safe to run more than once.

-- 1. Bank senders we trust: domain + sender patterns per bank. Only DKIM-verified mail from these is processed.
create table if not exists fw_bank_sender_whitelist (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null,                 -- sbi, federal, hdfc, icici, sib, canara
  bank_name text not null,
  sender_domain text not null,             -- DKIM d= must equal this or be a subdomain of it
  sender_patterns text[] not null default '{}', -- From: addresses (or *@domain) this bank sends alerts / statements from
  kinds text[] not null default '{alert,statement}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bank_code, sender_domain)
);

-- 2. The mailbox(es) each business receives bank mail in, and the Gmail forwarding confirmation when it arrives
create table if not exists fw_bank_email_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  email text not null,                     -- lower-cased, e.g. owner@gmail.com
  provider text,                           -- gmail, outlook, workspace, other (detected)
  confirm_code text,                       -- Gmail "forwarding confirmation" code, cleared once forwarding works
  confirm_link text,
  confirm_received_at timestamptz,
  last_email_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);
create index if not exists fw_bank_email_sources_email on fw_bank_email_sources (email);

-- 3. Bank accounts that may appear in forwarded mail: bank, last 4 digits, the FreBook bank ledger (= Tally ledger)
create table if not exists fw_bank_mail_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  bank_code text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  ledger_account_id uuid references fw_fin_chart_of_accounts(id) on delete set null,
  statement_password_sealed text,          -- AES-256-GCM (BANKMAIL_KEY); never returned to the browser
  last_balance numeric,                    -- closing balance of the newest imported line (continuity check)
  last_balance_date date,
  created_at timestamptz not null default now(),
  unique (business_id, bank_code, last4)
);

-- 4. Every inbound email, once (Message-ID). The raw email itself stays encrypted in storage and is deleted after retention.
create table if not exists fw_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  received_at timestamptz not null default now(),
  raw_key text,                            -- storage path of the encrypted raw email; null once retention removes it
  raw_deleted_at timestamptz,
  from_addr text,
  subject text,
  forwarder text,                          -- the client mailbox it was forwarded from, as read from the headers
  bank_code text,
  kind text,                               -- alert, statement, gmail_confirm, unknown
  auth jsonb,                              -- { dkim: pass|fail|none, dkimDomain, spf, dmarc }
  business_id uuid references fw_fin_businesses(id) on delete set null,
  bank_account_id uuid references fw_bank_mail_accounts(id) on delete set null,
  status text not null default 'received'
    check (status in ('received','quarantined','unmatched','needs_attention','parsed','ignored')),
  reason text,                             -- why it was quarantined / unmatched / needs attention
  tx_count int not null default 0,
  resolved_by uuid,                        -- admin who cleared it from a queue
  resolved_at timestamptz
);
create index if not exists fw_inbound_emails_status on fw_inbound_emails (status, received_at desc);
create index if not exists fw_inbound_emails_business on fw_inbound_emails (business_id, received_at desc);

-- 5. Normalised bank lines from alerts and statements
create table if not exists fw_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  bank_account_id uuid not null references fw_bank_mail_accounts(id) on delete cascade,
  date date not null,
  amount numeric not null check (amount > 0),
  dr_cr text not null check (dr_cr in ('dr','cr')),   -- dr = money out of the bank, cr = money in
  ref text,                                -- UTR / RRN / cheque number
  narration text,
  balance numeric,
  source text not null check (source in ('alert','statement')),
  source_email_id uuid references fw_inbound_emails(id) on delete set null,
  confirmed_by_statement boolean not null default false, -- an alert line later matched by a statement line
  balance_gap boolean not null default false,            -- running balance doesn't follow from the previous line
  status text not null default 'new'
    check (status in ('new','classified','asked','approved','posted','ignored','duplicate')),
  suggestion jsonb,                        -- { ledger, party, confidence } from FrePilot
  journal_id uuid references fw_fin_journals(id) on delete set null,   -- the voucher it became (audit trail)
  created_at timestamptz not null default now()
);
create index if not exists fw_bank_tx_account_date on fw_bank_transactions (bank_account_id, date);
create index if not exists fw_bank_tx_status on fw_bank_transactions (business_id, status);
-- The same reference can't be imported twice on one account and side
create unique index if not exists fw_bank_tx_ref_unique on fw_bank_transactions (bank_account_id, dr_cr, ref, amount) where ref is not null;

-- Row level security: owners read their own; nothing is written from the browser
alter table fw_bank_sender_whitelist enable row level security;
alter table fw_bank_email_sources enable row level security;
alter table fw_bank_mail_accounts enable row level security;
alter table fw_inbound_emails enable row level security;
alter table fw_bank_transactions enable row level security;

drop policy if exists "bank_sources_owner_read" on fw_bank_email_sources;
create policy "bank_sources_owner_read" on fw_bank_email_sources for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);
drop policy if exists "bank_accounts_owner_read" on fw_bank_mail_accounts;
create policy "bank_accounts_owner_read" on fw_bank_mail_accounts for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);
drop policy if exists "bank_tx_owner_read" on fw_bank_transactions;
create policy "bank_tx_owner_read" on fw_bank_transactions for select using (
  business_id in (select id from fw_fin_businesses where owner_id = auth.uid())
);
-- fw_inbound_emails and fw_bank_sender_whitelist: no select policy, so only the server (admin screens) reads them.
-- The sealed statement password column is hidden from the owner's browser too:
revoke select (statement_password_sealed) on fw_bank_mail_accounts from anon, authenticated;

-- Starter whitelist. Sender addresses change: confirm each against a real forwarded email before launch.
insert into fw_bank_sender_whitelist (bank_code, bank_name, sender_domain, sender_patterns) values
  ('sbi',     'State Bank of India', 'sbi.co.in',          '{donotreply.sbiatm@alerts.sbi.co.in,cbssbi.cas@alerts.sbi.co.in,*@alerts.sbi.co.in,*@sbi.co.in}'),
  ('federal', 'Federal Bank',        'federalbank.co.in',  '{*@federalbank.co.in,*@alerts.federalbank.co.in}'),
  ('hdfc',    'HDFC Bank',           'hdfcbank.net',       '{alerts@hdfcbank.net,*@hdfcbank.net}'),
  ('hdfc',    'HDFC Bank',           'hdfcbank.com',       '{*@hdfcbank.com}'),
  ('icici',   'ICICI Bank',          'icicibank.com',      '{alert@icicibank.com,customercare@icicibank.com,*@icicibank.com}'),
  ('sib',     'South Indian Bank',   'sib.bank.in',        '{*@sib.bank.in}'),
  ('sib',     'South Indian Bank',   'southindianbank.com','{*@southindianbank.com}'),
  ('canara',  'Canara Bank',         'canarabank.com',     '{*@canarabank.com,*@canarabank.in}'),
  ('canara',  'Canara Bank',         'canarabank.in',      '{*@canarabank.in}')
on conflict (bank_code, sender_domain) do nothing;

-- Private bucket for the encrypted raw emails (created from the dashboard if this insert isn't allowed)
insert into storage.buckets (id, name, public) values ('bankmail', 'bankmail', false) on conflict (id) do nothing;
