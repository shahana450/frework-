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
    monthJournals(sb, bizId, from, to, ["sales", "credit_note"]),
    sb.from("fw_fin_businesses").select("gstin,state").eq("id", bizId).single(),
    sb.from("fw_fin_contacts").select("id,name,gstin,state").eq("business_id", bizId),
  ]);
  const src: SrcJournal[] = rows.map(j => ({
    id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), type: j.type, reference_no: j.reference_no, party_name: j.party_name ?? null,
    contact_id: j.contact_id ?? null, total: Number(j.total_debit) || 0, metadata: j.metadata ?? null,
    lines: (j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "" })),
  }));
  const gstin = ((biz as { gstin?: string } | null)?.gstin ?? "").toUpperCase();
  // GSTR-1 reports invoices: only the INV series (and CN/DN notes). Old-format numbers are listed as issues.
  const inSeries = (s: SrcJournal) => /^(INV|CN|DN)\//.test(s.entry_no ?? "");
  const left = src.filter(s => !inSeries(s));
  const result = buildGstr1(gstin, (biz as { state?: string } | null)?.state ?? null, month, docsFromJournals(src.filter(inSeries), contacts ?? []));
  if (left.length) result.issues.push({ level: "warn", text: `${left.length} sale entr${left.length === 1 ? "y is" : "ies are"} not in the INV invoice series (e.g. ${left.slice(0, 3).map(s => s.entry_no).join(", ")}) and ${left.length === 1 ? "was" : "were"} left out. Renumber them (Phase 2 repair) or raise proper invoices.` });
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
