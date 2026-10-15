// The single way the server posts accounting entries.
// Validation here mirrors fw_fin_post_journal in the database, which is the final authority.
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateJournal, type RuleAccount, type RuleFy } from "./journalRules";

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
  reviewed?: boolean;           // the user has seen and accepted the review warnings — post anyway
  againstInvoiceId?: string | null; // receipts/payments: the invoice or bill this settles
};
export type DuplicateHit = { id: string; entry_no: string; date: string; narration: string; total: number };
export type PostingResult = { id: string; entryNo: string; total: number };

export class PostingError extends Error {
  constructor(public code: "UNBALANCED" | "INVALID" | "ACCOUNT" | "LOCKED" | "NOT_FOUND" | "DUPLICATE" | "POSSIBLE_DUPLICATE" | "NEEDS_REVIEW" | "FAILED", message: string, public duplicate?: DuplicateHit, public draftId?: string) { super(message); }
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
  const m = message.match(/FW_(UNBALANCED|INVALID|ACCOUNT|LOCKED|NOT_FOUND|DUPLICATE|POSSIBLE_DUPLICATE):\s*(.*)/);
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

/** A control ledger ("Debtors Control", "Sundry Creditors" …) — a group total, never a posting ledger. */
export const isControlLedger = (name: string) => /^(sundry\s+)?(debtors|creditors|trade\s+(receivables|payables))(\s+control)?$/i.test(name.trim());

/**
 * Lines aimed at a control ledger go to the party's own ledger (created under Sundry Debtors / Creditors if needed),
 * whenever the entry names its customer or supplier. Without a party they stay put and validateJournal refuses
 * them once the control ledger is a group.
 */
async function routeToParty(sb: SupabaseClient, req: PostingRequest): Promise<PostingRequest> {
  const party = (req.partyName ?? "").trim();
  if (!party && !req.contactId) return req;
  const ids = [...new Set(req.lines.map(l => l.accountId).filter(Boolean))];
  if (!ids.length) return req;
  const { data } = await sb.from("fw_fin_chart_of_accounts").select("id,name,sub_type,is_group").eq("business_id", req.businessId).in("id", ids);
  const controls = ((data ?? []) as { id: string; name: string; sub_type: string | null; is_group: boolean | null }[]).filter(a => isControlLedger(a.name));
  if (!controls.length) return req;
  const swap = new Map<string, string>();
  for (const a of controls) {
    const kind = /debtor|receivable/i.test(a.name) ? "customer" : "supplier";
    let name = party;
    if (!name && req.contactId) { const { data: ct } = await sb.from("fw_fin_contacts").select("name").eq("id", req.contactId).maybeSingle(); name = (ct?.name ?? "").trim(); }
    if (!name) continue;
    const { data: acc, error } = await sb.rpc("fw_fin_ensure_party_ledger", { p_business: req.businessId, p_name: name, p_kind: kind, p_contact: req.contactId ?? null });
    if (!error && acc) swap.set(a.id, acc as string);
  }
  return swap.size ? { ...req, lines: req.lines.map(l => swap.has(l.accountId) ? { ...l, accountId: swap.get(l.accountId)! } : l) } : req;
}

/**
 * An entry dated after the last financial year (but not in the future) opens the next year(s) automatically,
 * same start day as the existing years — the way a new year simply begins. Earlier/future gaps still need Settings.
 */
async function ensureFinancialYear(sb: SupabaseClient, businessId: string, date: string) {
  const { data } = await sb.from("fw_fin_financial_years").select("start_date,end_date").eq("business_id", businessId).order("end_date", { ascending: false });
  const fys = (data ?? []) as { start_date: string; end_date: string }[];
  const today = new Date().toISOString().slice(0, 10);
  if (!fys.length || date > today || fys.some(f => date >= f.start_date && date <= f.end_date) || date <= fys[0].end_date) return;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let start = new Date(fys[0].end_date + "T00:00:00Z"); start.setUTCDate(start.getUTCDate() + 1);
  for (let i = 0; i < 3; i++) {
    const end = new Date(start); end.setUTCFullYear(end.getUTCFullYear() + 1); end.setUTCDate(end.getUTCDate() - 1);
    const s = iso(start), e = iso(end), y = start.getUTCFullYear();
    const label = s.slice(5) === "01-01" ? String(y) : `${y}-${String(y + 1).slice(2)}`;
    const current = today >= s && today <= e;
    const { data: row } = await sb.from("fw_fin_financial_years").insert({ business_id: businessId, label, start_date: s, end_date: e, is_current: current }).select("id").single();
    if (current && row) await sb.from("fw_fin_financial_years").update({ is_current: false }).eq("business_id", businessId).neq("id", row.id);
    if (date <= e) return;
    start = new Date(end); start.setUTCDate(start.getUTCDate() + 1);
  }
}

/** What validateJournal needs about this business: the ledgers used, the financial years and GST registration. */
async function ruleContext(sb: SupabaseClient, req: PostingRequest) {
  const ids = [...new Set(req.lines.map(l => l.accountId).filter(Boolean))];
  try { await ensureFinancialYear(sb, req.businessId, req.date); } catch { /* the rule below still reports it */ }
  const [{ data: accs }, { data: fys }, { data: biz }] = await Promise.all([
    sb.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type,is_group").eq("business_id", req.businessId).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    sb.from("fw_fin_financial_years").select("start_date,end_date,is_locked").eq("business_id", req.businessId),
    sb.from("fw_fin_businesses").select("gstin").eq("id", req.businessId).maybeSingle(),
  ]);
  return { accounts: new Map(((accs ?? []) as RuleAccount[]).map(a => [a.id, a])), fys: (fys ?? []) as RuleFy[], gstRegistered: !!(biz?.gstin ?? "").trim(), force: !!req.force };
}

/** Saves an entry that needs a look as a draft (not in the books) with the reasons, and returns its id. */
async function saveForReview(sb: SupabaseClient, req: PostingRequest, lines: PostingLine[], reasons: string[]) {
  const total = round2(lines.reduce((s, l) => s + l.dr, 0));
  const { data: j, error } = await sb.from("fw_fin_journals").insert({
    business_id: req.businessId, entry_no: `DRAFT-${Date.now().toString(36).toUpperCase()}`, date: req.date, type: req.type,
    narration: req.narration.slice(0, 500), reference_no: req.referenceNo ?? null, status: "draft", total_debit: total, total_credit: total,
    created_by: req.actorId, contact_id: req.contactId ?? null, party_name: req.partyName ?? null, source: req.source,
    metadata: { ...(req.metadata ?? {}), needs_review: reasons },
  }).select("id").single();
  if (error || !j) throw new PostingError("FAILED", error?.message ?? "Could not save the draft");
  await sb.from("fw_fin_journal_lines").insert(lines.map((l, i) => ({ journal_id: j.id, account_id: l.accountId, dr_amount: l.dr, cr_amount: l.cr, narration: l.narration ?? null, sort_order: i + 1 })));
  return j.id as string;
}

/** Posts one balanced entry atomically through the database posting function. */
export async function postJournal(sb: SupabaseClient, reqIn: PostingRequest): Promise<PostingResult> {
  validateEntry(reqIn.lines, reqIn.date);
  const req = await routeToParty(sb, reqIn);
  const { lines, review } = validateJournal({ type: req.type, date: req.date, lines: req.lines }, await ruleContext(sb, req));
  if (review.length && !req.reviewed) {
    const draftId = await saveForReview(sb, req, lines, review);
    throw new PostingError("NEEDS_REVIEW", `Saved as a draft for review, not posted: ${review.join("; ")}`, undefined, draftId);
  }
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
  if (req.againstInvoiceId) await sb.from("fw_fin_journals").update({ against_invoice_id: req.againstInvoiceId }).eq("id", data.id).eq("business_id", req.businessId);
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
    const status = e.code === "LOCKED" ? 403 : e.code === "DUPLICATE" || e.code === "POSSIBLE_DUPLICATE" ? 409 : e.code === "NEEDS_REVIEW" ? 422 : e.code === "FAILED" ? 500 : 422;
    return { status, code: e.code, duplicate: e.duplicate, message: e.code === "FAILED" ? "We couldn't post this entry. Nothing was saved — please try again." : e.message };
  }
  return { status: 500, message: "We couldn't post this entry. Nothing was saved — please try again." };
}
