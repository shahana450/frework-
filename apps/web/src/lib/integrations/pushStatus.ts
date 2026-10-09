// Tally push status is per company: an entry pushed to "ABC Traders" is not in "ABC Traders 2025" just because it was pushed once.
// The company is stored in fw_fin_integration_sync.target and in the browser copy.

export type PushState = { at: string; target?: string | null } | { error: string; target?: string | null };

export const sameCompany = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export type PushView =
  | { kind: "none" }
  | { kind: "failed"; error: string }
  | { kind: "pushed"; at: string; companyKnown: boolean }  // pushed to the company open now (or the company wasn't recorded)
  | { kind: "elsewhere"; at: string; company: string };    // pushed, but to another company — counts as not pushed here

/**
 * How a push mark reads for the company open in Tally now.
 * - No company recorded (older rows): still counts as pushed, so Push all never sends a duplicate; Check Tally confirms it.
 * - No company open (unknown): we can't compare, so a recorded push counts as pushed.
 */
export function pushView(p: PushState | undefined | null, openCompany: string | null | undefined): PushView {
  if (!p) return { kind: "none" };
  if ("error" in p) return { kind: "failed", error: p.error };
  const target = p.target?.trim() || null;
  const open = openCompany?.trim() || null;
  if (!target) return { kind: "pushed", at: p.at, companyKnown: false };
  if (!open || sameCompany(target, open)) return { kind: "pushed", at: p.at, companyKnown: true };
  return { kind: "elsewhere", at: p.at, company: target };
}

export const isPushedHere = (p: PushState | undefined | null, openCompany: string | null | undefined) =>
  pushView(p, openCompany).kind === "pushed";

/** Server rows → browser map. */
export function fromSyncRows(rows: { journal_id: string; status: string; error: string | null; synced_at: string; target?: string | null }[]): Record<string, PushState> {
  const out: Record<string, PushState> = {};
  for (const r of rows) out[r.journal_id] = r.status === "failed" ? { error: r.error ?? "Failed", target: r.target ?? null } : { at: r.synced_at, target: r.target ?? null };
  return out;
}
