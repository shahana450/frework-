import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { getAI } from "@/lib/ai";
import { readAttachmentBuffer } from "@/lib/attachments";
import { parse2BGrid } from "@/lib/itcMatch";
import type { PortalData } from "@/lib/auditPortal";

// 360° audit: read the returns already on the Shelf (GSTR-1, GSTR-3B, GSTR-2B, 26AS) for the year and turn them into the
// portal figures the audit compares with the books. Read-only; PDFs are read by the AI, Excel 2B directly.
export const maxDuration = 300;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Tax = { igst: number; cgst: number; sgst: number; cess: number };
const Z = (): Tax => ({ igst: 0, cgst: 0, sgst: 0, cess: 0 });
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const tx = (o: Partial<Tax> | undefined): Tax => ({ igst: r2(o?.igst), cgst: r2(o?.cgst), sgst: r2(o?.sgst), cess: r2(o?.cess) });
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function ymOf(t: string): string {
  const s = t.toLowerCase();
  const iso = s.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/); if (iso) return `${iso[1]}-${iso[2]}`;
  const mm = s.match(/\b(0[1-9]|1[0-2])(20\d{2})\b/); if (mm) return `${mm[2]}-${mm[1]}`;
  const nm = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-'.,]*(\d{4}|\d{2})\b/);
  return nm ? `${nm[2].length === 2 ? "20" + nm[2] : nm[2]}-${String(MON.indexOf(nm[1]) + 1).padStart(2, "0")}` : "";
}
async function aiJson(bytes: Buffer, name: string, mime: string, ask: string): Promise<Record<string, unknown> | null> {
  const att = readAttachmentBuffer(bytes, name, mime);
  const res = await getAI().messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: [...att.blocks, { type: "text", text: `${ask}${att.text ? `\n\nFile text:\n${att.text.slice(0, 30000)}` : ""}\nReply with JSON only.` }] }] as never });
  const t = res.content[0]?.type === "text" ? res.content[0].text : "";
  try { return JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; fy?: string };
    const gate = await requireBusiness(req, b.business_id);
    if (gate instanceof NextResponse) return gate;
    const fy = String(b.fy ?? "").replace(/^FY\s*/i, "");
    const { data: items, error } = await sb.from("fw_fin_shelf_items").select("id,rack,title,doc_type,period,file_path,file_name,mime,fy")
      .eq("business_id", b.business_id!).is("deleted_at", null).in("rack", ["gst", "income_tax", "tds"]).eq("fy", fy).limit(200);
    if (error) return serverError("audit360 shelf", error, "Couldn't read the Shelf.");
    const kindOf = (i: { doc_type: string | null; title: string }) => { const t = `${i.doc_type ?? ""} ${i.title}`; return /GSTR-?3B/i.test(t) ? "gstr3b" : /GSTR-?2B/i.test(t) ? "gstr2b" : /GSTR-?1(?!\d)/i.test(t) ? "gstr1" : /26\s?AS|annual tax statement/i.test(t) ? "tds26as" : null; };
    const wanted = (items ?? []).map(i => ({ ...i, kind: kindOf(i) })).filter(i => i.kind);
    const p: PortalData = {};
    const used: { title: string; kind: string; ok: boolean }[] = [];
    // A few files at a time: each PDF is one AI read
    for (let k = 0; k < wanted.length; k += 4) {
      await Promise.all(wanted.slice(k, k + 4).map(async it => {
        let ok = false;
        try {
          const { data: blob } = await sb.storage.from("shelf").download(it.file_path);
          if (!blob) throw new Error("missing");
          const bytes = Buffer.from(await blob.arrayBuffer());
          const ym = ymOf(`${it.period ?? ""} ${it.title}`);
          const excel = /\.(xlsx|xls|csv)$/i.test(it.file_name ?? "") || /sheet|excel|csv/i.test(it.mime ?? "");
          if (it.kind === "gstr2b" && excel) {
            const wb = XLSX.read(bytes, { type: "buffer" });
            const docs = wb.SheetNames.filter(n => /b2b/i.test(n)).flatMap(n => parse2BGrid(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: true }) as unknown[][]));
            if (docs.length && ym) {
              p.gstr2b ??= { months: {}, suppliers: [] };
              const m = p.gstr2b.months[ym] ?? Z();
              for (const d of docs) {
                const s = d.note ? -1 : 1;
                m.igst = r2(m.igst + s * d.igst); m.cgst = r2(m.cgst + s * d.cgst); m.sgst = r2(m.sgst + s * d.sgst); m.cess = r2(m.cess + s * d.cess);
                let sup = p.gstr2b.suppliers.find(x => x.ctin === d.gstin);
                if (!sup) { sup = { ctin: d.gstin, name: d.supplier, tax: Z(), taxable: 0, invoices: 0 }; p.gstr2b.suppliers.push(sup); }
                sup.tax.igst = r2(sup.tax.igst + s * d.igst); sup.tax.cgst = r2(sup.tax.cgst + s * d.cgst); sup.tax.sgst = r2(sup.tax.sgst + s * d.sgst); sup.tax.cess = r2(sup.tax.cess + s * d.cess);
                sup.taxable = r2(sup.taxable + s * d.taxable); sup.invoices++;
              }
              p.gstr2b.months[ym] = m; ok = true;
            }
          } else if (it.kind === "gstr3b") {
            const j = await aiJson(bytes, it.file_name ?? "gstr3b.pdf", it.mime ?? "application/pdf", 'This is a filed GSTR-3B. Give {"period":"YYYY-MM","taxable":<3.1(a) taxable value>,"out":{"igst":0,"cgst":0,"sgst":0,"cess":0} (3.1(a) tax),"itc":{"igst":0,"cgst":0,"sgst":0,"cess":0} (4(C) net ITC)}.');
            const per = String(j?.period ?? "") || ym;
            if (j && /^\d{4}-\d{2}$/.test(per)) { p.gstr3b ??= { months: {} }; p.gstr3b.months[per] = { taxable: r2(j.taxable), out: tx(j.out as Partial<Tax>), itc: tx(j.itc as Partial<Tax>) }; ok = true; }
          } else if (it.kind === "gstr1") {
            const j = await aiJson(bytes, it.file_name ?? "gstr1.pdf", it.mime ?? "application/pdf", 'This is a filed GSTR-1 (or its summary). Give {"period":"YYYY-MM","taxable":<total taxable value of outward supplies, net of credit notes>,"igst":0,"cgst":0,"sgst":0,"cess":0}.');
            const per = String(j?.period ?? "") || ym;
            if (j && /^\d{4}-\d{2}$/.test(per)) { p.gstr1 ??= { months: {}, b2b: [] }; p.gstr1.months[per] = { taxable: r2(j.taxable), ...tx(j as Partial<Tax>) }; ok = true; }
          } else if (it.kind === "tds26as") {
            const j = await aiJson(bytes, it.file_name ?? "26as.pdf", it.mime ?? "application/pdf", 'This is Form 26AS / Annual Tax Statement. Give {"deductors":[{"name":"","tan":"","paid":<total amount paid/credited>,"tds":<total TDS deposited>}]} from Part I (TDS).');
            const list = Array.isArray(j?.deductors) ? j!.deductors as { name: string; tan: string; paid: number; tds: number }[] : [];
            if (list.length) { p.tds26as = { deductors: list.map(d => ({ name: String(d.name ?? ""), tan: String(d.tan ?? ""), paid: r2(d.paid), tds: r2(d.tds) })) }; ok = true; }
          }
        } catch { /* reported as not read */ }
        used.push({ title: `${it.title}${it.period ? ` · ${it.period}` : ""}`, kind: it.kind!, ok });
      }));
    }
    return NextResponse.json({ portal: p, files: used });
  } catch (e) { return serverError("audit360 shelf", e, "Couldn't read the returns on the Shelf."); }
}
