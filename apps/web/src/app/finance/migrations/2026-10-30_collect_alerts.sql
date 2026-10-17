-- Automatic overdue alerts to the owner on WhatsApp (Collect payments page → "Remind me on WhatsApp").
-- Per linked number and business. Run once in Supabase → SQL Editor. Safe to re-run.
alter table fw_fin_wa_links add column if not exists collect_alert      text not null default 'off';  -- off | daily | weekly
alter table fw_fin_wa_links add column if not exists collect_alert_days int  not null default 30;     -- overdue after this many days
alter table fw_fin_wa_links add column if not exists collect_alert_last date;                         -- last day an alert went out
