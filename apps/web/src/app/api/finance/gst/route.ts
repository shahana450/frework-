import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { docsFromJournals, type SrcJournal } from "@/lib/gstr1Source";
import { buildMonthGstr1, fileGstr1, monthJournals as sharedMonthJournals, type GstRow } from "@/lib/gstr1Export";
import { gstSummary } from "@/lib/gstSummary";
import { table3, type Tax } from "@/lib/gstReturns";
import { gst3bByMonth } from "@/lib/gst3b";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Row = GstRow;

// Output tax ledgers are named in several ways ("Output CGST", "GST Payable - CGST", "CGST Output"); input/ITC ledgers are excluded
const outKind = (n: string) => /input|itc|reverse|rcm/i.test(n) ? null : /igst/i.test(n) ? "igst" : /cgst/i.test(n) ? "cgst" : /sgst|utgst/i.test(n) ? "sgst" : null;
const isInput = (n: string) => /gst/i.test(n) && /input|itc/i.test(n);

const monthJournals = (bizId: string, from: string, to: string, types?: string[]) => sharedMonthJournals(supabase, bizId, from, to, types);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bizId = searchParams.get("business_id");
    let month = searchParams.get("month"); // YYYY-MM
    const fyStart = searchParams.get("fy");   // annual: start year, e.g. 2025 for FY 2025-26
    if (fyStart && /^\d{4}$/.test(fyStart)) month = month ?? `${fyStart}-04`;
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
      const annual = report === "annual" && fyStart && /^\d{4}$/.test(fyStart);
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
      let booksCash: number | null = null;
      if (!annual && month) {
        const fyY = Number(month.slice(5, 7)) >= 4 ? Number(month.slice(0, 4)) : Number(month.slice(0, 4)) - 1;
        const yearRows = await monthJournals(bizId!, `${fyY}-04-01`, pTo);
        const names = new Set<string>(), gl: { account_id: string; dr: number; cr: number; date: string }[] = [];
        for (const j of yearRows) for (const l of j.fw_fin_journal_lines ?? []) {
          const n = l.fw_fin_chart_of_accounts?.name ?? ""; names.add(n);
          gl.push({ account_id: n, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, date: String(j.date).slice(0, 10) });
        }
        booksCash = gst3bByMonth([...names].map(n => ({ id: n, name: n })), gl).get(month)?.cash ?? 0;
      }
      return NextResponse.json({ books_cash: booksCash, period: annual ? `FY ${fyStart}-${String(Number(fyStart) + 1).slice(2)}` : month, gstin: (biz?.gstin ?? "").toUpperCase(), state: home,
        table3: t3, itc: round(itc), rcm: round(rcm), months, outward: { b2b: total(b2b), b2c: total(b2c), creditNotes: total(notes) }, derivedDocs: all.filter(d => d.derived).length });
    }

    if (report === "gstr1" || report === "gstr1_json") {
      const result = await buildMonthGstr1(supabase, bizId!, month);
      if (report === "gstr1_json") {
        await fileGstr1(supabase, bizId!, gate.user.id, month, result);
        return new NextResponse(JSON.stringify(result.json, null, 2), {
          headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${result.fileName}"` },
        });
      }
      const { fileName: _f, ...rest } = result; void _f;
      return NextResponse.json({ month, ...rest });
    }

    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  } catch (e) {
    return serverError("gst", e, "We couldn't prepare the GST figures right now.");
  }
}
