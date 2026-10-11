import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { buildGstr1 } from "@/lib/gstr1";
import { fileToShelf, fyOfDate } from "@/lib/shelf";
import { docsFromJournals, type SrcJournal } from "@/lib/gstr1Source";
import { gstSummary } from "@/lib/gstSummary";
import { table3, type Tax } from "@/lib/gstReturns";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Row = {
  id: string; entry_no: string; date: string; type: string; reference_no: string | null; party_name?: string | null; contact_id?: string | null;
  total_debit: number; metadata?: Record<string, unknown> | null;
  fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string } | null }[];
};

// Output tax ledgers are named in several ways ("Output CGST", "GST Payable - CGST", "CGST Output"); input/ITC ledgers are excluded
const outKind = (n: string) => /input|itc|reverse|rcm/i.test(n) ? null : /igst/i.test(n) ? "igst" : /cgst/i.test(n) ? "cgst" : /sgst|utgst/i.test(n) ? "sgst" : null;
const isInput = (n: string) => /gst/i.test(n) && /input|itc/i.test(n);

// Older databases may lack the optional columns (party_name, contact_id, metadata) — fall back instead of failing
const COLS = [
  "id,entry_no,date,type,reference_no,party_name,contact_id,total_debit,metadata,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
  "id,entry_no,date,type,reference_no,party_name,total_debit,metadata,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
  "id,entry_no,date,type,reference_no,total_debit,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
];
async function monthJournals(bizId: string, from: string, to: string, types?: string[]) {
  let lastErr: unknown = null;
  for (const cols of COLS) {
    const rows: Row[] = [];
    let failed = false;
    for (let off = 0; ; off += 500) {
      let q = supabase.from("fw_fin_journals").select(cols)
        .eq("business_id", bizId).eq("status", "posted").gte("date", from).lte("date", to).order("date").range(off, off + 499);
      if (types) q = q.in("type", types);
      const { data, error } = await q;
      if (error) { lastErr = error; failed = true; break; }
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < 500) break;
    }
    if (!failed) return rows;
  }
  throw lastErr;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bizId = searchParams.get("business_id");
    let month = searchParams.get("month"); // YYYY-MM
    const fyStart = searchParams.get("fy");   // annual: start year, e.g. 2025 for FY 2025-26
    if (fyStart && /^d{4}$/.test(fyStart)) month = month ?? `${fyStart}-04`;
    const report = searchParams.get("report") ?? "summary";
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Choose a month." }, { status: 400 });

    const from = `${month}-01`;
    const to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);

    if (report === "summary") {
      const rows = await monthJournals(bizId!, from, to);
      // Sales are classified per entry: taxable only when that entry charged output GST
      const s = gstSummary(rows.map(j => ({ metadata: (j.metadata ?? null) as never, lines: (j.fw_fin_journal_lines ?? []).map(l => ({ account: l.fw_fin_chart_of_accounts?.name ?? "", dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })) })));
      return NextResponse.json({ month, ...s });
    }

    // GSTR-3B (month) and the annual summary (GSTR-9): outward supplies from sales documents, ITC and reverse charge from the books
    if (report === "gstr3b" || report === "annual") {
      const annual = report === "annual" && fyStart && /^d{4}$/.test(fyStart);
      const pFrom = annual ? `${fyStart}-04-01` : from, pTo = annual ? `${Number(fyStart) + 1}-03-31` : to;
      const [rows, { data: biz }, { data: contacts }] = await Promise.all([
        monthJournals(bizId!, pFrom, pTo),
        supabase.from("fw_fin_businesses").select("gstin,state").eq("id", bizId!).single(),
        supabase.from("fw_fin_contacts").select("id,name,gstin,state").eq("business_id", bizId!),
      ]);
      const toSrc = (j: Row): SrcJournal => ({ id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), type: j.type, reference_no: j.reference_no, party_name: j.party_name ?? null,
        contact_id: j.contact_id ?? null, total: Number(j.total_debit) || 0, metadata: j.metadata ?? null,
        lines: (j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "" })) });
      const kindOf = (n: string): keyof Tax | null => /igst|integrated/i.test(n) ? "igst" : /cgst|central/i.test(n) ? "cgst" : /sgst|utgst|state/i.test(n) ? "sgst" : /cess/i.test(n) ? "cess" : null;
      const itc: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 }, rcm: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
      let rcmTaxable = 0;
      const byMonth = new Map<string, { sales: SrcJournal[]; itc: Tax }>();
      for (const j of rows) {
        const ym = String(j.date).slice(0, 7);
        const m = byMonth.get(ym) ?? { sales: [], itc: { igst: 0, cgst: 0, sgst: 0, cess: 0 } };
        if (j.type === "sales" || j.type === "credit_note") m.sales.push(toSrc(j));
        for (const l of j.fw_fin_journal_lines ?? []) {
          const name = l.fw_fin_chart_of_accounts?.name ?? ""; const k = kindOf(name);
          if (!k || !/gst|cess/i.test(name)) continue;
          const dr = Number(l.dr_amount) || 0, cr = Number(l.cr_amount) || 0;
          if (/reverse|rcm/i.test(name) && !/input|itc/i.test(name)) { rcm[k] += cr - dr; continue; }
          if (/input|itc|receivable/i.test(name)) { itc[k] += dr - cr; m.itc[k] += dr - cr; }
        }
        byMonth.set(ym, m);
      }
      for (const j of rows) if (j.fw_fin_journal_lines?.some(l => /reverse|rcm/i.test(l.fw_fin_chart_of_accounts?.name ?? ""))) rcmTaxable += (j.fw_fin_journal_lines ?? []).filter(l => !/gst|cess|bank|cash|creditor|payable/i.test(l.fw_fin_chart_of_accounts?.name ?? "")).reduce((s, l) => s + (Number(l.dr_amount) || 0), 0);
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const round = (t: Tax): Tax => ({ igst: r2(t.igst), cgst: r2(t.cgst), sgst: r2(t.sgst), cess: r2(t.cess) });
      const home = biz?.state ?? null;
      const all = docsFromJournals(rows.filter(j => j.type === "sales" || j.type === "credit_note").map(toSrc), contacts ?? []);
      const t3 = table3(all, home, { taxable: r2(rcmTaxable), ...round(rcm) });
      const months = annual ? [...byMonth.keys()].sort().map(ym => ({ month: ym, ...table3(docsFromJournals(byMonth.get(ym)!.sales, contacts ?? []), home).a, itc: round(byMonth.get(ym)!.itc) })) : undefined;
      const b2b = all.filter(d => d.gstin && d.kind !== "credit_note"), b2c = all.filter(d => !d.gstin && d.kind !== "credit_note"), notes = all.filter(d => d.kind === "credit_note");
      const total = (ds: typeof all) => ds.reduce((s, d) => ({ taxable: r2(s.taxable + d.items.reduce((a, i) => a + i.taxable, 0)), tax: r2(s.tax + d.items.reduce((a, i) => a + i.igst + i.cgst + i.sgst + (i.cess ?? 0), 0)), count: s.count + 1 }), { taxable: 0, tax: 0, count: 0 });
      return NextResponse.json({ period: annual ? `FY ${fyStart}-${String(Number(fyStart) + 1).slice(2)}` : month, gstin: (biz?.gstin ?? "").toUpperCase(), state: home,
        table3: t3, itc: round(itc), rcm: round(rcm), months, outward: { b2b: total(b2b), b2c: total(b2c), creditNotes: total(notes) }, derivedDocs: all.filter(d => d.derived).length });
    }

    if (report === "gstr1" || report === "gstr1_json") {
      const [rows, { data: biz }, { data: contacts }] = await Promise.all([
        monthJournals(bizId!, from, to, ["sales", "credit_note"]),
        supabase.from("fw_fin_businesses").select("gstin,state").eq("id", bizId!).single(),
        supabase.from("fw_fin_contacts").select("id,name,gstin,state").eq("business_id", bizId!),
      ]);
      const src: SrcJournal[] = rows.map(j => ({
        id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), type: j.type, reference_no: j.reference_no, party_name: j.party_name ?? null,
        contact_id: j.contact_id ?? null, total: Number(j.total_debit) || 0, metadata: j.metadata ?? null,
        lines: (j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "" })),
      }));
      const gstin = (biz?.gstin ?? "").toUpperCase();
      const result = buildGstr1(gstin, biz?.state ?? null, month, docsFromJournals(src, contacts ?? []));
      if (report === "gstr1_json") {
        // File the exported return on the Shelf (GST rack); a newer export of the same month replaces the older copy
        const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
        const title = `GSTR-1 JSON · ${label}`;
        await supabase.from("fw_fin_shelf_items").update({ deleted_at: new Date().toISOString() }).eq("business_id", bizId!).eq("source", "gstr1").eq("title", title).is("deleted_at", null);
        await fileToShelf(supabase, { businessId: bizId!, actorId: gate.user.id, rack: "gst", title, fileName: `GSTR1_${gstin || "GSTIN"}_${month.slice(5, 7)}${month.slice(0, 4)}.json`, mime: "application/json",
          bytes: new TextEncoder().encode(JSON.stringify(result.json, null, 2)), source: "gstr1", docType: "GSTR-1", period: label, fy: fyOfDate(`${month}-01`),
          notes: result.issues.length ? `${result.issues.length} item(s) flagged to check before filing.` : null });
        return new NextResponse(JSON.stringify(result.json, null, 2), {
          headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="GSTR1_${gstin || "GSTIN"}_${month.slice(5, 7)}${month.slice(0, 4)}.json"` },
        });
      }
      return NextResponse.json({ month, gstin, ...result });
    }

    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  } catch (e) {
    return serverError("gst", e, "We couldn't prepare the GST figures right now.");
  }
}
