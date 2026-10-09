-- FreWork Phase 0 — speed + missing columns. Safe to run more than once.
-- Run in Supabase → SQL Editor.

-- ── Indexes: the cause of "statement timeout" on Books / Audit / Reports ─────
create index if not exists fw_fin_journals_biz_date     on fw_fin_journals (business_id, date desc);
create index if not exists fw_fin_journals_biz_status   on fw_fin_journals (business_id, status, date);
create index if not exists fw_fin_journals_biz_entry_no on fw_fin_journals (business_id, entry_no);
create index if not exists fw_fin_journal_lines_journal on fw_fin_journal_lines (journal_id);
create index if not exists fw_fin_journal_lines_account on fw_fin_journal_lines (account_id);
create index if not exists fw_fin_coa_biz               on fw_fin_chart_of_accounts (business_id, name);
create index if not exists fw_fin_fy_biz                on fw_fin_financial_years (business_id, start_date);
create index if not exists fw_fin_team_biz_email        on fw_fin_team_members (business_id, lower(invited_email));
create index if not exists fw_fin_businesses_owner      on fw_fin_businesses (owner_id);

-- ── Columns the posting code records for the audit trail ─────────────────────
alter table fw_fin_journals add column if not exists metadata     jsonb;
alter table fw_fin_journals add column if not exists source       text;
alter table fw_fin_journals add column if not exists party_name   text;
alter table fw_fin_journals add column if not exists confirmed_at timestamptz;

-- ── Chat history (sidebar "sessions") ────────────────────────────────────────
create table if not exists fw_fin_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  business_id uuid not null references fw_fin_businesses(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fw_fin_chat_sessions_user_biz on fw_fin_chat_sessions (user_id, business_id, created_at desc);
alter table fw_fin_chat_sessions enable row level security;
drop policy if exists "own chat sessions" on fw_fin_chat_sessions;
create policy "own chat sessions" on fw_fin_chat_sessions for select using (auth.uid() = user_id);

-- ── Fix ledgers created under the wrong group by the early naming rule ───────
update fw_fin_chart_of_accounts set type = 'expense', sub_type = 'indirect_expense'
where sub_type = 'bank' and name ~* '(bank|sms) (charges|commission|fees?)';

analyze fw_fin_journals;
analyze fw_fin_journal_lines;
