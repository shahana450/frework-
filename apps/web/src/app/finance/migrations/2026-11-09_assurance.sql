-- FreBook Assurance: Accounting Detective exceptions, tax-rule registry, bank matches, document requests, corrections.
-- New tables only — no existing table or row is changed. Safe to run more than once.
-- Writes go through the server (service role); members of a business can read their own rows.

create table if not exists fw_fin_exceptions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references fw_fin_businesses(id) on delete cascade,
  fingerprint      text not null,                 -- rule + records it is about: one exception per issue
  rule_id          text not null,
  rule_version     int not null default 1,
  category         text not null,
  priority         text not null check (priority in ('high', 'medium', 'low')),
  confidence       text not null check (confidence in ('definite', 'likely', 'requires_review')),
  txn_date         date,
  amount           numeric,
  ledger           text,
  party            text,
  title            text not null,
  description      text not null,
  evidence         jsonb not null default '[]',
  provision        text,
  suggested_action text,
  journal_ids      uuid[] not null default '{}',
  assigned_to      text,                          -- email of the team member responsible
  status           text not null default 'detected' check (status in ('detected','under_review','awaiting_documents','correction_proposed','awaiting_approval','resolved','rejected','false_positive','reopened')),
  history          jsonb not null default '[]',   -- [{at, by, from, to, note}]
  ai_note          text,                          -- AI explanation (advice only)
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  resolved_at      timestamptz,
  unique (business_id, fingerprint)
);
create index if not exists fw_fin_exceptions_open on fw_fin_exceptions (business_id, status, priority);

create table if not exists fw_fin_tax_rules (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references fw_fin_businesses(id) on delete cascade,   -- null = applies to everyone
  rule_id         text not null,
  version         int not null default 1,
  area            text not null check (area in ('gst', 'tds', 'income_tax')),
  title           text not null,
  provision       text not null,
  effective_from  date not null,
  effective_to    date,
  fy              text,
  conditions      text not null,
  thresholds      jsonb,
  rates           jsonb,
  exceptions      text,
  keywords        text,
  source          text not null,
  verified_on     date,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  unique (rule_id, version, business_id)
);

create table if not exists fw_fin_bank_matches (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references fw_fin_businesses(id) on delete cascade,
  bank_journal_id uuid not null references fw_fin_journals(id) on delete cascade,
  doc_journal_id  uuid not null references fw_fin_journals(id) on delete cascade,
  allocated       numeric not null check (allocated > 0),
  charges         numeric not null default 0,
  split           boolean not null default false,   -- true when one bank line is allocated to several documents
  evidence        jsonb,
  status          text not null default 'confirmed' check (status in ('confirmed', 'unmatched')),
  confirmed_by    uuid,
  confirmed_at    timestamptz not null default now()
);
-- A bank line may appear once as a single match; several rows only when every row says split = true
create unique index if not exists fw_fin_bank_matches_single on fw_fin_bank_matches (bank_journal_id) where status = 'confirmed' and not split;
create unique index if not exists fw_fin_bank_matches_pair on fw_fin_bank_matches (bank_journal_id, doc_journal_id) where status = 'confirmed';
create index if not exists fw_fin_bank_matches_biz on fw_fin_bank_matches (business_id, status);

create table if not exists fw_fin_doc_requests (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references fw_fin_businesses(id) on delete cascade,
  exception_id    uuid references fw_fin_exceptions(id) on delete set null,
  journal_id      uuid references fw_fin_journals(id) on delete set null,
  party           text,
  txn_date        date,
  amount          numeric,
  doc_kind        text not null,
  message         text not null,
  status          text not null default 'open' check (status in ('open', 'received', 'fulfilled', 'insufficient', 'cancelled')),
  shelf_item_id   uuid references fw_fin_shelf_items(id) on delete set null,   -- the uploaded original, kept for audit
  extracted       jsonb,
  validation      jsonb,
  assigned_to     text,
  remind_count    int not null default 0,
  last_reminded_at timestamptz,
  due_on          date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, exception_id)
);
create index if not exists fw_fin_doc_requests_open on fw_fin_doc_requests (business_id, status);

create table if not exists fw_fin_corrections (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references fw_fin_businesses(id) on delete cascade,
  exception_id    uuid references fw_fin_exceptions(id) on delete set null,
  journal_id      uuid not null references fw_fin_journals(id),
  kind            text not null check (kind in ('reclass', 'reverse_and_repost')),
  reason          text not null,
  lines           jsonb not null,
  explanation     text,
  tax_note        text,
  status          text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'posted', 'failed')),
  proposed_by     uuid,
  proposed_at     timestamptz not null default now(),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  posted_journal_id uuid references fw_fin_journals(id),
  reversal_journal_id uuid references fw_fin_journals(id)
);
-- Only one live correction per entry at a time: prevents double posting
create unique index if not exists fw_fin_corrections_live on fw_fin_corrections (journal_id) where status in ('proposed', 'approved');

do $$ declare t text; begin
  foreach t in array array['fw_fin_exceptions', 'fw_fin_bank_matches', 'fw_fin_doc_requests', 'fw_fin_corrections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists member_read on public.%I', t);
    execute format('create policy member_read on public.%I for select to authenticated using (fw_fin_is_member(business_id))', t);
  end loop;
end $$;
alter table fw_fin_tax_rules enable row level security;
drop policy if exists rules_read on fw_fin_tax_rules;
create policy rules_read on fw_fin_tax_rules for select to authenticated using (business_id is null or fw_fin_is_member(business_id));
