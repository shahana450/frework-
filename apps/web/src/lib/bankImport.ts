// Bank statement imports: the bank side of every row comes from the import batch's bank account (a cash/bank ledger),
// never from a ledger assigned to the row. Rows that look already imported are held as "possible duplicate".
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCashBankAccount, type RuleAccount } from "./journalRules";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Cheque number / UTR / reference in a bank narration: "CTS CL011206", "UTR: HDFCR52026032600123", "NEFT-N12345678". */
export function extractBankRef(description: string): string | null {
  const d = String(description ?? "").toUpperCase();
  const tagged = d.match(/\b(?:CHQ|CHEQUE|CL|UTR|REF|RRN|NEFT|RTGS|IMPS|UPI)[\s:./#-]*(?:NO\.?\s*)?([A-Z0-9]{6,22})\b/);
  if (tagged && /\d{4,}/.test(tagged[1])) return tagged[1];
  const cl = d.match(/\b(CL\d{5,})\b/);
  if (cl) return cl[1];
  const longNum = d.match(/\b(\d{10,22})\b/);
  return longNum ? longNum[1] : null;
}

export type BankRow = { key: string; date: string; amount: number; ref: string | null };
export type ImportedBankEntry = { id: string; entryNo: string; date: string; amount: number; ref: string | null };

/**
 * Possible duplicates of rows about to be imported: same date + amount (+ same ref when both have one) as an entry
 * already on this bank account, or the same cheque/UTR ref seen before on this account (whatever its date/amount),
 * or a repeat within the batch itself.
 */
export function findDuplicates(rows: BankRow[], existing: ImportedBankEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Map<string, string>();      // within-batch: date|amount|ref → row key
  const seenRef = new Set<string>();            // within-batch: cheque/UTR refs
  for (const r of rows) {
    const amt = r2(r.amount);
    const hit = existing.find(e => e.date === r.date && Math.abs(r2(e.amount) - amt) < 0.01 && (!r.ref || !e.ref || e.ref === r.ref));
    if (hit) { out.set(r.key, `Already imported as ${hit.entryNo} (${hit.date}, ₹${amt.toLocaleString("en-IN")})`); continue; }
    const sameRef = r.ref ? existing.find(e => e.ref === r.ref) : undefined;
    if (sameRef) { out.set(r.key, `Reference ${r.ref} was already imported as ${sameRef.entryNo} (${sameRef.date}, ₹${r2(sameRef.amount).toLocaleString("en-IN")})`); continue; }
    const k = `${r.date}|${amt}|${r.ref ?? ""}`;
    if (seen.has(k)) out.set(r.key, "Appears twice in this file");
    else if (r.ref && seenRef.has(r.ref)) out.set(r.key, `Reference ${r.ref} appears twice in this file`);
    seen.set(k, r.key); if (r.ref) seenRef.add(r.ref);
  }
  return out;
}

/** The import's bank account — must be one of this business's cash/bank ledgers. */
export const isCardAccount = (a?: RuleAccount | null) => !!a && /credit\s*card/i.test(a.name) && !/charges?|interest|fees?/i.test(a.name);
export async function loadBankAccount(sb: SupabaseClient, businessId: string, accountId: string, opts: { card?: boolean } = {}): Promise<RuleAccount> {
  const { data } = await sb.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type,is_group").eq("business_id", businessId).eq("id", accountId).maybeSingle();
  const a = data as RuleAccount | null;
  const ok = !!a && !a.is_group && (isCashBankAccount(a) || (opts.card && isCardAccount(a)));
  if (!ok) throw new Error(`Choose a ${opts.card ? "credit card" : "bank or cash"} ledger for this statement${a ? ` — "${a.name}" is not one` : ""}.`);
  return a!;
}

/** Entries already imported on this bank account, for duplicate checks (bank_account_id + ref live in metadata). */
export async function importedOnAccount(sb: SupabaseClient, businessId: string, accountId: string, from: string, to: string, refs: string[]): Promise<ImportedBankEntry[]> {
  const rows: ImportedBankEntry[] = [];
  const add = (data: unknown) => {
    for (const j of (data ?? []) as { id: string; entry_no: string; date: string; total_debit: number; metadata: { bank_ref?: string | null } | null }[])
      if (!rows.some(x => x.id === j.id)) rows.push({ id: j.id, entryNo: j.entry_no, date: String(j.date).slice(0, 10), amount: Number(j.total_debit), ref: j.metadata?.bank_ref ?? null });
  };
  const base = () => sb.from("fw_fin_journals").select("id,entry_no,date,total_debit,metadata").eq("business_id", businessId).neq("status", "voided").is("reversed_by", null).eq("metadata->>bank_account_id", accountId);
  add((await base().gte("date", from).lte("date", to).limit(5000)).data);
  if (refs.length) for (let i = 0; i < refs.length; i += 100) add((await base().in("metadata->>bank_ref", refs.slice(i, i + 100)).limit(1000)).data);
  return rows;
}

/** Records the import batch; returns its id, or null when the table isn't installed yet. */
export async function createBatch(sb: SupabaseClient, b: { businessId: string; bankAccountId: string; fileName: string | null; rows: number; actorId: string }): Promise<string | null> {
  const { data, error } = await sb.from("fw_fin_bank_import_batches").insert({ business_id: b.businessId, bank_account_id: b.bankAccountId, file_name: b.fileName, row_count: b.rows, created_by: b.actorId }).select("id").single();
  return error ? null : (data as { id: string }).id;
}
