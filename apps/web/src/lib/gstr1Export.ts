// GSTR-1 for a month, from posted sales and credit notes: the portal JSON, the issues to fix, and a copy filed on the
// Shelf (GST rack). Used by the GST page download and by WhatsApp ("GSTR1 JSON August 2026").
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGstr1, type Gstr1 } from "./gstr1";
import { docsFromJournals, type SrcJournal } from "./gstr1Source";
import { fileToShelf, fyOfDate } from "./shelf";

export type GstRow = {
  id: string; entry_no: string; date: string; type: string; reference_no: string | null; party_name?: string | null; contact_id?: string | null;
  total_debit: number; metadata?: Record<string, unknown> | null;
  fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string } | null }[];
};

// Older databases may lack the optional columns (party_name, contact_id, metadata) — fall back instead of failing
const COLS = [
  "id,entry_no,date,type,reference_no,party_name,contact_id,total_debit,metadata,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
  "id,entry_no,date,type,reference_no,party_name,total_debit,metadata,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
  "id,entry_no,date,type,reference_no,total_debit,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
];

/** Posted entries in a date range, page by page. */
export async function monthJournals(sb: SupabaseClient, bizId: string, from: string, to: string, types?: string[]): Promise<GstRow[]> {
  let lastErr: unknown = null;
  for (const cols of COLS) {
    const rows: GstRow[] = [];
    let failed = false;
    for (let off = 0; ; off += 500) {
      let q = sb.from("fw_fin_journals").select(cols)
        .eq("business_id", bizId).eq("status", "posted").gte("date", from).lte("date", to).order("date").range(off, off + 499);
      if (types) q = q.in("type", types);
      const { data, error } = await q;
      if (error) { lastErr = error; failed = true; break; }
      rows.push(...((data ?? []) as unknown as GstRow[]));
      if (!data || data.length < 500) break;
    }
    if (!failed) return rows;
  }
  throw lastErr;
}

export const monthRange = (month: string) => ({ from: `${month}-01`, to: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10) });
export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** GSTR-1 for the month (YYYY-MM): the return plus any issues to fix before filing. */
export async function buildMonthGstr1(sb: SupabaseClient, bizId: string, month: string): Promise<Gstr1 & { gstin: string; fileName: string }> {
  const { from, to } = monthRange(month);
  const [rows, { data: biz }, { data: contacts }] = await Promise.all([
    monthJournals(sb, bizId, from, to),
    sb.from("fw_fin_businesses").select("gstin,state").eq("id", bizId).single(),
    sb.from("fw_fin_contacts").select("id,name,gstin,state").eq("business_id", bizId),
  ]);
  // A sale is any entry that charges output GST against a sales / income ledger — a sales invoice, or a sale booked as a
  // journal (bulk templates, Tally, older entries). Output GST credited = a sale; debited = a credit note.
  const isOutput = (n: string) => /\b(output|payable)\b/i.test(n) && /\b(cgst|sgst|igst|utgst|cess)\b/i.test(n) && !/\b(rcm|reverse)\b/i.test(n);
  const saleLike = rows.filter(j => {
    if (j.type === "sales" || j.type === "credit_note") return true;
    const ls = j.fw_fin_journal_lines ?? [];
    return ls.some(l => isOutput(l.fw_fin_chart_of_accounts?.name ?? "")) && ls.some(l => l.fw_fin_chart_of_accounts?.type === "income");
  }).map(j => {
    if (j.type === "sales" || j.type === "credit_note") return j;
    const out = (j.fw_fin_journal_lines ?? []).filter(l => isOutput(l.fw_fin_chart_of_accounts?.name ?? "")).reduce((s, l) => s + (Number(l.cr_amount) || 0) - (Number(l.dr_amount) || 0), 0);
    return { ...j, type: out >= 0 ? "sales" : "credit_note" };
  });
  // A month-end GST computation entry (receipts booked GST-inclusive to income, then Dr Income / Cr Output GST) holds the
  // tax but not the sale: the sales value is the income those receipts credited. Such an entry becomes one B2C summary
  // line — taxable = the month's net credit to that income ledger, tax = the output GST it carves out.
  type Row = typeof rows[number];
  const incomeNet = (j: Row) => (j.fw_fin_journal_lines ?? []).filter(l => l.fw_fin_chart_of_accounts?.type === "income").reduce((s, l) => s + (Number(l.cr_amount) || 0) - (Number(l.dr_amount) || 0), 0);
  const computations = saleLike.filter(j => !rows.find(r => r.id === j.id && (r.type === "sales" || r.type === "credit_note")) && incomeNet(j) < 0 && j.type === "sales");
  const computedNotes: string[] = [];
  const computed = computations.map(j => {
    const incomes = new Set((j.fw_fin_journal_lines ?? []).filter(l => l.fw_fin_chart_of_accounts?.type === "income").map(l => l.fw_fin_chart_of_accounts?.name ?? ""));
    let taxable = rows.filter(r => !saleLike.some(s => s.id === r.id && !computations.includes(s))).reduce((s, r) => s + (r.fw_fin_journal_lines ?? []).filter(l => incomes.has(l.fw_fin_chart_of_accounts?.name ?? "")).reduce((t, l) => t + (Number(l.cr_amount) || 0) - (Number(l.dr_amount) || 0), 0), 0);
    const taxLines = (j.fw_fin_journal_lines ?? []).filter(l => isOutput(l.fw_fin_chart_of_accounts?.name ?? ""));
    const tax = taxLines.reduce((s, l) => s + (Number(l.cr_amount) || 0) - (Number(l.dr_amount) || 0), 0);
    // The rate is in the ledger names ("Output CGST @ 9%" → 18%) or the narration ("@18%"). Taxable = tax ÷ rate: often
    // only part of the receipts is taxable (pass-through fees), so the month's income can't be used directly.
    const names = taxLines.map(l => l.fw_fin_chart_of_accounts?.name ?? "");
    const pct = (s: string) => Number((s.match(/@\s*(\d+(?:\.\d+)?)\s*%/) ?? [])[1]) || 0;
    const half = names.filter(n => /cgst|sgst|utgst/i.test(n)).map(pct).find(Boolean), full = names.filter(n => /igst/i.test(n)).map(pct).find(Boolean);
    const rate = full || (half ? half * 2 : 0) || pct(String((j as { narration?: string }).narration ?? ""));
    const fromRate = rate > 0 ? Math.round(tax / (rate / 100) * 100) / 100 : 0;
    if (fromRate > 0) {
      if (taxable - fromRate > 1) computedNotes.push(`${j.entry_no}: output GST at ${rate}% covers ₹${fromRate.toLocaleString("en-IN")} of the month's ₹${(Math.round(taxable * 100) / 100).toLocaleString("en-IN")} income — report the remaining ₹${(Math.round((taxable - fromRate) * 100) / 100).toLocaleString("en-IN")} as exempt / nil-rated / non-GST if that's what it is.`);
      taxable = fromRate;
    }
    return { ...j, party_name: null, contact_id: null, reference_no: j.reference_no || j.entry_no, total_debit: Math.round((taxable + tax) * 100) / 100,
      fw_fin_journal_lines: [{ dr_amount: 0, cr_amount: Math.round(taxable * 100) / 100, fw_fin_chart_of_accounts: { name: [...incomes][0] ?? "Sales", type: "income" } }, ...taxLines] } as Row;
  });
  const docsSrc = [...saleLike.filter(j => !computations.includes(j)), ...computed];
  const src: SrcJournal[] = docsSrc.map(j => ({
    id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), type: j.type, reference_no: j.reference_no, party_name: j.party_name ?? null,
    contact_id: j.contact_id ?? null, total: Number(j.total_debit) || 0, metadata: j.metadata ?? null,
    lines: (j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "" })),
  }));
  const gstin = ((biz as { gstin?: string } | null)?.gstin ?? "").toUpperCase();
  // GSTR-1 reports invoices: only the INV series (and CN/DN notes). Old-format numbers are listed as issues.
  const inSeries = (s: SrcJournal) => /^(INV|CN|DN)\//.test(s.entry_no ?? "");
  const left = src.filter(s => !inSeries(s));
  // Every sale is reported; ones outside the INV / CN / DN series are flagged so their invoice numbers get checked
  const result = buildGstr1(gstin, (biz as { state?: string } | null)?.state ?? null, month, docsFromJournals(src, contacts ?? []));
  for (const t of computedNotes) result.issues.push({ level: "warn", text: t });
  if (left.length) result.issues.push({ level: "warn", text: `${left.length} sale${left.length === 1 ? " was" : "s were"} booked outside the INV invoice series (e.g. ${left.slice(0, 3).map(s => s.entry_no).join(", ")}). They're included — check each one's invoice number (its reference) before filing.` });
  return { ...result, gstin, fileName: `GSTR1_${gstin || "GSTIN"}_${month.slice(5, 7)}${month.slice(0, 4)}.json` };
}

/** Files the exported JSON on the Shelf (GST rack); a newer export of the same month replaces the older copy. */
export async function fileGstr1(sb: SupabaseClient, bizId: string, actorId: string | null, month: string, r: Gstr1 & { fileName: string }): Promise<string | null> {
  const label = monthLabel(month);
  const title = `GSTR-1 JSON · ${label}`;
  await sb.from("fw_fin_shelf_items").update({ deleted_at: new Date().toISOString() }).eq("business_id", bizId).eq("source", "gstr1").eq("title", title).is("deleted_at", null);
  const saved = await fileToShelf(sb, { businessId: bizId, actorId, rack: "gst", title, fileName: r.fileName, mime: "application/json",
    bytes: new TextEncoder().encode(JSON.stringify(r.json, null, 2)), source: "gstr1", docType: "GSTR-1", period: label, fy: fyOfDate(`${month}-01`),
    notes: r.issues.length ? `${r.issues.length} item(s) flagged to check before filing.` : null });
  return saved?.id ?? null;
}
