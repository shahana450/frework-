// The single way the server posts accounting entries.
// Validation here mirrors fw_fin_post_journal in the database, which is the final authority.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PostingLine = { accountId: string; dr: number; cr: number; narration?: string; fcDr?: number; fcCr?: number };
export type PostingRequest = {
  businessId: string;
  actorId: string;
  date: string;                 // YYYY-MM-DD
  type: string;                 // journal | payment | receipt | sales | purchase | contra | debit_note | credit_note
  narration: string;
  referenceNo?: string | null;
  partyName?: string | null;
  contactId?: string | null;
  source: string;               // ai_copilot | statement | manual | whatsapp | bank_import …
  aiGenerated?: boolean;
  metadata?: Record<string, unknown>;
  lines: PostingLine[];
  force?: boolean;              // post into a locked year (owner/admin only — caller must check)
  currency?: string | null;     // transaction currency when not the base currency
  exchangeRate?: number | null; // base units per 1 unit of currency (required with currency)
  entryNo?: string | null;      // imports only: keep the source system's number (e.g. "TLY-Sales 105")
  checkDuplicate?: boolean;     // stop if a near-identical entry exists (the user can confirm and re-send)
};
export type DuplicateHit = { id: string; entry_no: string; date: string; narration: string; total: number };
export type PostingResult = { id: string; entryNo: string; total: number };

export class PostingError extends Error {
  constructor(public code: "UNBALANCED" | "INVALID" | "ACCOUNT" | "LOCKED" | "NOT_FOUND" | "DUPLICATE" | "POSSIBLE_DUPLICATE" | "FAILED", message: string, public duplicate?: DuplicateHit) { super(message); }
}

// The database lock trigger lets a forced post through only when it's marked in metadata
const withForce = (req: PostingRequest) => (req.force ? { ...(req.metadata ?? {}), force_locked: true } : req.metadata ?? null);

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Pure checks shared by every posting path. Returns cleaned lines or throws PostingError. */
export function validateEntry(lines: PostingLine[], date: string): PostingLine[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) throw new PostingError("INVALID", `Invalid date "${date}"`);
  const clean = lines.map(l => ({ ...l, dr: round2(l.dr), cr: round2(l.cr) })).filter(l => l.dr !== 0 || l.cr !== 0);
  if (clean.length < 2) throw new PostingError("INVALID", "An entry needs at least two lines");
  for (const l of clean) {
    if (!l.accountId) throw new PostingError("ACCOUNT", "Every line needs an account");
    if (l.dr < 0 || l.cr < 0) throw new PostingError("INVALID", "Amounts cannot be negative");
    if (l.dr > 0 && l.cr > 0) throw new PostingError("INVALID", "A line cannot be both debit and credit");
  }
  const dr = round2(clean.reduce((s, l) => s + l.dr, 0));
  const cr = round2(clean.reduce((s, l) => s + l.cr, 0));
  if (dr <= 0 || dr !== cr) throw new PostingError("UNBALANCED", `Debits ₹${dr.toFixed(2)} do not equal credits ₹${cr.toFixed(2)}`);
  return clean;
}

/** Maps a described transaction onto the voucher types used across the books. */
export function voucherTypeFor(transactionType: string): string {
  const t = (transactionType ?? "").toLowerCase();
  if (["journal", "payment", "receipt", "sales", "purchase", "contra", "debit_note", "credit_note"].includes(t)) return t;
  if (/credit_note/.test(t)) return "credit_note";
  if (/debit_note/.test(t)) return "debit_note";
  if (/sale/.test(t)) return "sales";
  if (/purchase/.test(t)) return "purchase";
  if (t === "bank_transfer" || /contra/.test(t)) return "contra";
  if (/receipt|received|income|advance_from|capital|loan_received/.test(t)) return "receipt";
  if (/payment|salary|drawings|advance_to|repayment|expense/.test(t)) return "payment";
  return "journal";
}

function toPostingError(message: string): PostingError {
  const m = message.match(/FW_(UNBALANCED|INVALID|ACCOUNT|LOCKED|NOT_FOUND|DUPLICATE):\s*(.*)/);
  if (m) return new PostingError(m[1] as PostingError["code"], m[2]);
  return new PostingError("FAILED", message);
}

const isMissingFunction = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(e.message ?? ""));

/** Same total, same ledgers, dated within 3 days of each other. */
export function isLikelyDuplicate(a: { date: string; total: number; accountIds: string[] }, b: { date: string; total: number; accountIds: string[] }): boolean {
  if (Math.abs(round2(a.total) - round2(b.total)) >= 0.01) return false;
  if (Math.abs(Date.parse(a.date) - Date.parse(b.date)) > 3 * 86400000) return false;
  const sa = new Set(a.accountIds), sb = new Set(b.accountIds);
  return sa.size === sb.size && [...sa].every(id => sb.has(id));
}

const shiftDate = (d: string, days: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); };

/** Finds a posted entry that looks like the one about to be posted. */
export async function findLikelyDuplicate(sb: SupabaseClient, businessId: string, date: string, lines: PostingLine[]): Promise<DuplicateHit | null> {
  const total = round2(lines.reduce((s, l) => s + l.dr, 0));
  const { data } = await sb.from("fw_fin_journals").select("id,entry_no,date,narration,total_debit,fw_fin_journal_lines(account_id)")
    .eq("business_id", businessId).eq("status", "posted").is("reversed_by", null).gte("date", shiftDate(date, -3)).lte("date", shiftDate(date, 3)).eq("total_debit", total).limit(20);
  const mine = { date, total, accountIds: lines.map(l => l.accountId) };
  for (const j of (data ?? []) as { id: string; entry_no: string; date: string; narration: string | null; total_debit: number; fw_fin_journal_lines: { account_id: string }[] }[]) {
    if (/^REV|reversal/i.test(j.entry_no) || /^Reversal of/i.test(j.narration ?? "")) continue;
    if (isLikelyDuplicate(mine, { date: String(j.date).slice(0, 10), total: Number(j.total_debit), accountIds: (j.fw_fin_journal_lines ?? []).map(l => l.account_id) }))
      return { id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), narration: j.narration ?? "", total: Number(j.total_debit) };
  }
  return null;
}

/** Posts one balanced entry atomically through the database posting function. */
export async function postJournal(sb: SupabaseClient, req: PostingRequest): Promise<PostingResult> {
  const lines = validateEntry(req.lines, req.date);
  if (req.checkDuplicate) {
    const hit = await findLikelyDuplicate(sb, req.businessId, req.date, lines);
    if (hit) throw new PostingError("POSSIBLE_DUPLICATE", `This looks like a duplicate of ${hit.entry_no} (${hit.date}${hit.narration ? ` — ${hit.narration.slice(0, 80)}` : ""}), same amount and same ledgers.`, hit);
  }
  const header = {
    date: req.date, type: req.type, narration: req.narration.slice(0, 500), reference_no: req.referenceNo ?? null,
    party_name: req.partyName ?? null, contact_id: req.contactId ?? null, source: req.source, ai_generated: !!req.aiGenerated, metadata: withForce(req), force: !!req.force,
    currency: req.currency ?? null, exchange_rate: req.exchangeRate ?? null, entry_no: req.entryNo ?? null,
  };
  const { data, error } = await sb.rpc("fw_fin_post_journal", {
    p_business: req.businessId, p_actor: req.actorId, p_header: header,
    p_lines: lines.map(l => ({ account_id: l.accountId, dr: l.dr, cr: l.cr, narration: l.narration ?? null, fc_dr: l.fcDr ?? null, fc_cr: l.fcCr ?? null })),
  });
  if (error) {
    if (isMissingFunction(error)) return legacyPost(sb, req, lines);
    throw toPostingError(error.message);
  }
  return { id: data.id, entryNo: data.entry_no, total: Number(data.total) };
}

/** Reverses a posted entry with an equal-and-opposite entry. History is never rewritten. */
export async function reverseJournal(sb: SupabaseClient, businessId: string, actorId: string, journalId: string, reason: string, date?: string): Promise<PostingResult> {
  if (!reason?.trim()) throw new PostingError("INVALID", "A reason is required to reverse an entry");
  const { data, error } = await sb.rpc("fw_fin_reverse_journal", { p_business: businessId, p_actor: actorId, p_journal: journalId, p_reason: reason.trim(), p_date: date ?? null });
  if (error) {
    if (isMissingFunction(error)) throw new PostingError("FAILED", "Reversals need the Phase 1 database update. Run 2026-10-03_phase1_posting_engine.sql in Supabase.");
    throw toPostingError(error.message);
  }
  return { id: data.id, entryNo: data.entry_no, total: Number(data.total) };
}

// Used only until the Phase 1 SQL is installed. Same checks; not atomic, so lines failing removes the header.
async function legacyPost(sb: SupabaseClient, req: PostingRequest, lines: PostingLine[]): Promise<PostingResult> {
  const ids = [...new Set(lines.map(l => l.accountId))];
  const { data: accs } = await sb.from("fw_fin_chart_of_accounts").select("id,is_group").eq("business_id", req.businessId).in("id", ids);
  const ok = new Map((accs ?? []).map(a => [a.id, !a.is_group]));
  if (ids.some(id => !ok.get(id))) throw new PostingError("ACCOUNT", "An account does not belong to this business or is a group account");

  const { data: fy } = await sb.from("fw_fin_financial_years").select("id,is_locked").eq("business_id", req.businessId)
    .lte("start_date", req.date).gte("end_date", req.date).order("start_date", { ascending: false }).limit(1).maybeSingle();
  if (fy?.is_locked && !req.force) throw new PostingError("LOCKED", `The financial year containing ${req.date} is locked`);

  if (req.entryNo && /^TLY-/.test(req.entryNo)) {
    const { data: dup } = await sb.from("fw_fin_journals").select("id").eq("business_id", req.businessId).eq("entry_no", req.entryNo).limit(1);
    if (dup?.length) throw new PostingError("DUPLICATE", `${req.entryNo} is already imported`);
  }
  const prefix = `JV-${req.date.slice(0, 4)}`;
  const { data: nos } = await sb.from("fw_fin_journals").select("entry_no").eq("business_id", req.businessId).like("entry_no", `${prefix}-%`);
  let next = Math.max(0, ...(nos ?? []).map(n => parseInt(n.entry_no.split("-").pop() ?? "0", 10) || 0)) + 1;
  const total = round2(lines.reduce((s, l) => s + l.dr, 0));

  const row: Record<string, unknown> = {
    business_id: req.businessId, financial_year_id: fy?.id ?? null, entry_no: req.entryNo && /^TLY-/.test(req.entryNo) ? req.entryNo : `${prefix}-${String(next).padStart(4, "0")}`,
    date: req.date, type: req.type, narration: req.narration.slice(0, 500), reference_no: req.referenceNo ?? null,
    status: "posted", total_debit: total, total_credit: total, created_by: req.actorId, ai_generated: !!req.aiGenerated,
    party_name: req.partyName ?? null, contact_id: req.contactId ?? null, source: req.source, metadata: withForce(req), confirmed_at: new Date().toISOString(),
  };
  const optional = ["metadata", "source", "party_name", "contact_id", "confirmed_at", "ai_generated", "created_by"];
  let journal: { id: string } | null = null;
  for (let attempt = 0; attempt < optional.length + 3; attempt++) {
    const { data, error } = await sb.from("fw_fin_journals").insert(row).select("id").single();
    if (!error) { journal = data; break; }
    const col = error.message.match(/'(\w+)' column|column "?(\w+)"? .*does not exist/)?.slice(1).find(Boolean);
    if (col && optional.includes(col) && col in row) { delete row[col]; continue; }
    if (/client_key/i.test(error.message)) throw new PostingError("DUPLICATE", `This entry is already posted (client_key): ${error.message}`);
    if (/duplicate|unique/i.test(error.message)) { next++; row.entry_no = `${prefix}-${String(next).padStart(4, "0")}`; continue; }
    throw new PostingError("FAILED", error.message);
  }
  if (!journal) throw new PostingError("FAILED", "Could not create the entry");

  const { error: lErr } = await sb.from("fw_fin_journal_lines").insert(lines.map((l, i) => ({
    journal_id: journal!.id, account_id: l.accountId, dr_amount: l.dr, cr_amount: l.cr, narration: l.narration ?? req.narration.slice(0, 200), sort_order: i + 1,
  })));
  if (lErr) {
    await sb.from("fw_fin_journals").delete().eq("id", journal.id);
    throw new PostingError("FAILED", lErr.message);
  }
  return { id: journal.id, entryNo: row.entry_no as string, total };
}

/** Plain-language message for a posting failure. */
export function postingErrorMessage(e: unknown): { status: number; message: string; code?: string; duplicate?: DuplicateHit } {
  if (e instanceof PostingError) {
    const status = e.code === "LOCKED" ? 403 : e.code === "DUPLICATE" || e.code === "POSSIBLE_DUPLICATE" ? 409 : e.code === "FAILED" ? 500 : 422;
    return { status, code: e.code, duplicate: e.duplicate, message: e.code === "FAILED" ? "We couldn't post this entry. Nothing was saved — please try again." : e.message };
  }
  return { status: 500, message: "We couldn't post this entry. Nothing was saved — please try again." };
}
