import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { getAI } from "@/lib/ai";
import { readAttachmentBuffer } from "@/lib/attachments";

// GST returns reconciliation from the Shelf: the filed GSTR-1 / GSTR-3B already saved there for the chosen months.
// JSON returns are used as they are (invoice by invoice); PDFs are read by the AI — 3B table by table, GSTR-1 by section totals.
export const maxDuration = 300;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Amt = { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
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
const amt = (o: unknown): Amt => { const x = (o ?? {}) as Record<string, unknown>; return { taxable: r2(x.taxable ?? x.txval), igst: r2(x.igst ?? x.iamt), cgst: r2(x.cgst ?? x.camt), sgst: r2(x.sgst ?? x.samt), cess: r2(x.cess ?? x.csamt) }; };
const flat = (a: Amt) => ({ txval: a.taxable, iamt: a.igst, camt: a.cgst, samt: a.sgst, csamt: a.cess });

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; months?: string[] };
    const gate = await requireBusiness(req, b.business_id);
    if (gate instanceof NextResponse) return gate;
    const months = new Set((b.months ?? []).filter(m => /^\d{4}-\d{2}$/.test(m)));
    if (!months.size) return NextResponse.json({ error: "Pick a period." }, { status: 400 });
    const { data: items, error } = await sb.from("fw_fin_shelf_items").select("id,title,doc_type,period,file_path,file_name,mime")
      .eq("business_id", b.business_id!).eq("rack", "gst").is("deleted_at", null).limit(500);
    if (error) return serverError("gst shelf-returns", error, "Couldn't read the Shelf.");
    const pick = (re: RegExp) => (items ?? []).filter(i => re.test(`${i.doc_type ?? ""} ${i.title}`) && months.has(ymOf(`${i.period ?? ""} ${i.title}`)));
    const g1Files = pick(/GSTR-?1(?!\d)/i), g3Files = pick(/GSTR-?3B/i);
    const gstr1: Record<string, unknown[]> = {}; const gstr1Summary: Record<string, Amt> = {}; const gstr3b: unknown[] = [];
    const used: { title: string; kind: string; how: string; ok: boolean }[] = [];
    const add1 = (k: string, a: Amt) => { const c = gstr1Summary[k] ?? { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }; gstr1Summary[k] = { taxable: r2(c.taxable + a.taxable), igst: r2(c.igst + a.igst), cgst: r2(c.cgst + a.cgst), sgst: r2(c.sgst + a.sgst), cess: r2(c.cess + a.cess) }; };
    const all = [...g1Files.map(f => ({ ...f, kind: "gstr1" })), ...g3Files.map(f => ({ ...f, kind: "gstr3b" }))];
    for (let k = 0; k < all.length; k += 4) {
      await Promise.all(all.slice(k, k + 4).map(async it => {
        let ok = false, how = "";
        try {
          const { data: blob } = await sb.storage.from("shelf").download(it.file_path);
          if (!blob) throw new Error("missing");
          const bytes = Buffer.from(await blob.arrayBuffer());
          const isJson = /\.json$/i.test(it.file_name ?? "") || /json/i.test(it.mime ?? "");
          if (isJson) {
            const j = JSON.parse(bytes.toString("utf8"));
            const body = j?.data?.data ?? j?.data ?? j;
            if (it.kind === "gstr3b" && (body.sup_details || body.itc_elg)) { gstr3b.push(body); ok = true; }
            if (it.kind === "gstr1") { for (const [key, v] of Object.entries(body)) if (Array.isArray(v)) gstr1[key] = [...(gstr1[key] ?? []), ...v]; ok = true; }
            how = "JSON";
          } else if (it.kind === "gstr3b") {
            const j = await aiJson(bytes, it.file_name ?? "gstr3b.pdf", it.mime ?? "application/pdf",
              'This is a filed GSTR-3B. Give {"a":{taxable,igst,cgst,sgst,cess} for 3.1(a),"b":{...} 3.1(b),"c":{...} 3.1(c),"d":{...} 3.1(d),"e":{...} 3.1(e),"itc":{igst,cgst,sgst,cess} for 4(C) net ITC}. Use 0 where blank.');
            if (j) { gstr3b.push({ sup_details: { osup_det: flat(amt(j.a)), osup_zero: flat(amt(j.b)), osup_nil_exmp: flat(amt(j.c)), isup_rev: flat(amt(j.d)), osup_nongst: flat(amt(j.e)) }, itc_elg: { itc_net: flat(amt(j.itc)) } }); ok = true; }
            how = "PDF read by AI";
          } else {
            const j = await aiJson(bytes, it.file_name ?? "gstr1.pdf", it.mime ?? "application/pdf",
              'This is a filed GSTR-1 (summary). Give the section totals: {"b2b":{taxable,igst,cgst,sgst,cess},"b2cl":{...},"b2cs":{...},"exp":{...},"cdnr":{...} (credit minus debit notes, as a positive number)}. Use 0 where absent.');
            if (j) {
              const M: [string, string, number][] = [["b2b", "B2B invoices (4A)", 1], ["b2cl", "B2C large (5)", 1], ["b2cs", "B2C small (7)", 1], ["exp", "Exports (6A)", 1], ["cdnr", "Credit/debit notes — registered (9B)", -1]];
              for (const [key, label, sign] of M) { const a = amt(j[key]); if (a.taxable || a.igst || a.cgst || a.sgst) add1(label, sign < 0 ? { taxable: -a.taxable, igst: -a.igst, cgst: -a.cgst, sgst: -a.sgst, cess: -a.cess } : a); }
              ok = true;
            }
            how = "PDF read by AI (section totals)";
          }
        } catch { /* reported as not read */ }
        used.push({ title: `${it.title}${it.period ? ` · ${it.period}` : ""}`, kind: it.kind, how, ok });
      }));
    }
    return NextResponse.json({ gstr1: Object.keys(gstr1).length ? gstr1 : null, gstr1Summary: Object.keys(gstr1Summary).length ? gstr1Summary : null, gstr3b, files: used });
  } catch (e) { return serverError("gst shelf-returns", e, "Couldn't read the returns on the Shelf."); }
}
