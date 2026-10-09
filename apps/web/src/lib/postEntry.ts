"use client";
// Browser helper: every form posts through /api/finance/journals/post (validated, numbered, audit-logged).

export type EntryLine = { account_id?: string | null; account_name?: string | null; dr: number; cr: number; narration?: string };
export type EntryInput = {
  business_id: string; mode?: "post" | "draft"; date: string; type: string; narration: string;
  reference_no?: string | null; party_name?: string | null; contact_id?: string | null; source?: string;
  lines: EntryLine[]; metadata?: Record<string, unknown>; account_heads?: Record<string, string>;
};

/** Thrown when new ledgers need a group before the entry can be posted. */
export class NeedsHeadsError extends Error {
  constructor(public needs: { account: string; suggested: string }[]) {
    super(`Choose a group for: ${needs.map(n => n.account).join(", ")}`);
  }
}

export async function saveEntry(input: EntryInput): Promise<{ id: string; entry_no: string; status: string }> {
  const res = await fetch("/api/finance/journals/post", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, lines: input.lines.filter(l => (Number(l.dr) || 0) > 0 || (Number(l.cr) || 0) > 0) }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.needs_heads) throw new NeedsHeadsError(data.needs_heads);
  if (!res.ok) throw new Error(data.error ?? "We couldn't save this entry. Please try again.");
  return data;
}
