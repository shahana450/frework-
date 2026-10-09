-- FreWork Phase 4 — review queue details. Safe to run more than once.
alter table fw_fin_ai_suggestions add column if not exists details jsonb;
alter table fw_fin_ai_suggestions add column if not exists reviewed_by uuid;
alter table fw_fin_ai_suggestions add column if not exists reject_reason text;
create index if not exists fw_fin_ai_suggestions_biz_status on fw_fin_ai_suggestions (business_id, status, created_at desc);
create index if not exists fw_fin_documents_biz on fw_fin_documents (business_id, created_at desc);
create index if not exists fw_fin_documents_summary on fw_fin_documents using gin (ai_summary jsonb_path_ops);
