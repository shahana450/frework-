// Exception workflow: allowed status moves, and how a fresh scan is merged into the stored exceptions.
import type { Finding } from "./detective";

export const STATUSES = ["detected", "under_review", "awaiting_documents", "correction_proposed", "awaiting_approval", "resolved", "rejected", "false_positive", "reopened"] as const;
export type ExStatus = typeof STATUSES[number];
export const STATUS_LABEL: Record<ExStatus, string> = {
  detected: "Detected", under_review: "Under review", awaiting_documents: "Awaiting documents", correction_proposed: "Correction proposed",
  awaiting_approval: "Awaiting approval", resolved: "Resolved", rejected: "Rejected", false_positive: "False positive", reopened: "Reopened",
};
export const CLOSED: ExStatus[] = ["resolved", "rejected", "false_positive"];
export const isOpen = (s: ExStatus) => !CLOSED.includes(s);

const MOVES: Record<ExStatus, ExStatus[]> = {
  detected: ["under_review", "awaiting_documents", "correction_proposed", "resolved", "rejected", "false_positive"],
  under_review: ["awaiting_documents", "correction_proposed", "resolved", "rejected", "false_positive"],
  awaiting_documents: ["under_review", "correction_proposed", "resolved", "false_positive"],
  correction_proposed: ["awaiting_approval", "under_review", "rejected"],
  awaiting_approval: ["resolved", "rejected", "under_review"],
  resolved: ["reopened"], rejected: ["reopened"], false_positive: ["reopened"],
  reopened: ["under_review", "awaiting_documents", "correction_proposed", "resolved", "rejected", "false_positive"],
};
export const canMove = (from: ExStatus, to: ExStatus) => MOVES[from]?.includes(to) ?? false;

export type StoredException = { id: string; fingerprint: string; status: ExStatus; rule_id: string; confidence: string };
export type SyncPlan = {
  insert: Finding[];                                  // new issues
  refresh: { id: string; finding: Finding }[];        // still there: update amount/evidence, keep status and owner
  autoResolve: string[];                              // a definite issue that no longer exists (e.g. suspense cleared)
  reopen: { id: string; finding: Finding }[];         // resolved earlier, but a definite rule fires again
};

/** Idempotent merge: one exception per fingerprint. False positives and rejections stay closed when seen again. */
export function planSync(stored: StoredException[], found: Finding[]): SyncPlan {
  const byFp = new Map(stored.map(s => [s.fingerprint, s]));
  const seen = new Set(found.map(f => f.fingerprint));
  const plan: SyncPlan = { insert: [], refresh: [], autoResolve: [], reopen: [] };
  for (const f of found) {
    const s = byFp.get(f.fingerprint);
    if (!s) plan.insert.push(f);
    else if (isOpen(s.status)) plan.refresh.push({ id: s.id, finding: f });
    else if (s.status === "resolved" && f.confidence === "definite") plan.reopen.push({ id: s.id, finding: f });
  }
  for (const s of stored) if (isOpen(s.status) && !seen.has(s.fingerprint) && s.confidence === "definite" && s.status !== "awaiting_approval") plan.autoResolve.push(s.id);
  return plan;
}
