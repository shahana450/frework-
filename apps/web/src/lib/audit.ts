// Best-effort audit trail for actions outside the posting function (which logs its own posts and reversals).
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEvent = {
  businessId: string; actor: string; action: string; source?: string;
  journalId?: string | null; reason?: string | null; detail?: Record<string, unknown>;
};

export async function logAudit(sb: SupabaseClient, e: AuditEvent): Promise<void> {
  const { error } = await sb.from("fw_fin_audit_log").insert({
    business_id: e.businessId, actor: e.actor, action: e.action, source: e.source ?? "app",
    journal_id: e.journalId ?? null, reason: e.reason ?? null, detail: e.detail ?? null,
  });
  // Missing table (Phase 1 SQL not run) must not block the user's action
  if (error && !/fw_fin_audit_log|does not exist|schema cache/i.test(error.message)) console.error("audit log write failed", error.message);
}
