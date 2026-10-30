"use client";
// Browser side of the Tally provider: reads from Tally through the local bridge and hands vouchers to the server.
import { tallyFetch, parseTallyVouchers, monthsInRange, type TallyVoucher } from "../tallyUtils";
import { ledgersXml, ledgersFrom, vouchersXml } from "./tally";

export type ImportSummary = { imported: number; repaired?: number; skipped: number; fromFreWork: number; failedCount: number; failed: { voucher: string; error: string }[]; newLedgers: number };

/** Ledger → Tally group, so imported ledgers land under the same head as in Tally. */
export async function readTallyLedgerGroups(tallyUrl: string, company?: string | null): Promise<Record<string, string>> {
  try {
    const text = await (await tallyFetch(tallyUrl, ledgersXml(company), 20000)).text();
    return Object.fromEntries(ledgersFrom(text).map(l => [l.name, l.parent]));
  } catch { return {}; }
}

/** Reads vouchers month by month (large books time out in one request). */
export async function readTallyVouchers(tallyUrl: string, from: string, to: string, company?: string | null, onProgress?: (msg: string) => void): Promise<TallyVoucher[]> {
  const out: TallyVoucher[] = [];
  const months = monthsInRange(from, to);
  for (let i = 0; i < months.length; i++) {
    onProgress?.(`Reading ${months[i].label} from Tally (${i + 1}/${months.length})…`);
    try { out.push(...parseTallyVouchers(await (await tallyFetch(tallyUrl, vouchersXml(months[i].from, months[i].to, company), 30000)).text())); }
    catch { /* skip a month that fails; the summary shows what was imported */ }
  }
  return out;
}

/** Sends vouchers to FreWork's import endpoint in batches. Nothing is written to the database from the browser. */
export async function importTallyVouchers(businessId: string, vouchers: TallyVoucher[], opts: { ledgerGroups?: Record<string, string>; company?: string | null; onProgress?: (msg: string) => void } = {}): Promise<ImportSummary> {
  const sum: ImportSummary = { imported: 0, skipped: 0, fromFreWork: 0, failedCount: 0, failed: [], newLedgers: 0 };
  // Vouchers without a number are told apart by type, date and their order that day — counted over the WHOLE import,
  // so two on the same day in different batches never get the same entry number (the second used to be skipped)
  const seen = new Map<string, number>();
  const numbered = vouchers.map(v => { const k = `${v.voucherType}|${v.date}`; const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return { ...v, seq: n }; });
  for (let i = 0; i < numbered.length; i += 100) {
    const batch = numbered.slice(i, i + 100);
    opts.onProgress?.(`Importing ${i + 1}–${i + batch.length} of ${vouchers.length}…`);
    const res = await fetch("/api/finance/integrations/tally/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: businessId, vouchers: batch, ledger_groups: opts.ledgerGroups ?? {}, company: opts.company ?? null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Import failed. Please try again.");
    sum.imported += d.imported ?? 0; sum.repaired = (sum.repaired ?? 0) + (d.repaired ?? 0); sum.skipped += d.skipped ?? 0; sum.fromFreWork += d.from_frework ?? 0; sum.failedCount += d.failed_count ?? 0;
    sum.failed.push(...(d.failed ?? [])); sum.newLedgers += (d.created_ledgers ?? []).length;
  }
  return sum;
}

export const summaryText = (s: ImportSummary) =>
  s.imported || s.repaired || s.skipped || s.fromFreWork || s.failedCount
    ? `✓ Imported ${s.imported} voucher${s.imported === 1 ? "" : "s"}${s.repaired ? `, ${s.repaired} corrected to match Tally` : ""}${s.skipped ? `, ${s.skipped} already imported earlier` : ""}${s.fromFreWork ? `, ${s.fromFreWork} skipped — pushed from FreWork, already in your books` : ""}${s.newLedgers ? `, ${s.newLedgers} new ledger${s.newLedgers > 1 ? "s" : ""}` : ""}${s.failedCount ? `. ${s.failedCount} not imported — e.g. ${s.failed[0]?.voucher}: ${s.failed[0]?.error}` : "."}`
    : "No vouchers found in Tally for this period.";
