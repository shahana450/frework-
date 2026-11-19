import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { parse2BJson, parse2BGrid, type TwoBDoc } from "@/lib/itcMatch";

// ITC Match from the Shelf: every GSTR-2B (Excel or JSON) saved in the GST rack for the chosen months, read as documents.
export const maxDuration = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function ymOf(t: string): string {
  const s = t.toLowerCase();
  const iso = s.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/); if (iso) return `${iso[1]}-${iso[2]}`;
  const mm = s.match(/\b(0[1-9]|1[0-2])(20\d{2})\b/); if (mm) return `${mm[2]}-${mm[1]}`;
  const nm = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-'.,]*(\d{4}|\d{2})\b/);
  return nm ? `${nm[2].length === 2 ? "20" + nm[2] : nm[2]}-${String(MON.indexOf(nm[1]) + 1).padStart(2, "0")}` : "";
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; months?: string[] };
    const gate = await requireBusiness(req, b.business_id);
    if (gate instanceof NextResponse) return gate;
    const months = new Set((b.months ?? []).filter(m => /^\d{4}-\d{2}$/.test(m)));
    const { data: items, error } = await sb.from("fw_fin_shelf_items").select("title,doc_type,period,file_path,file_name,mime")
      .eq("business_id", b.business_id!).eq("rack", "gst").is("deleted_at", null).limit(500);
    if (error) return serverError("gst shelf-2b", error, "Couldn't read the Shelf.");
    const files = (items ?? []).filter(i => /GSTR-?2B/i.test(`${i.doc_type ?? ""} ${i.title}`) && months.has(ymOf(`${i.period ?? ""} ${i.title}`)));
    const docs: TwoBDoc[] = []; const used: { title: string; ok: boolean; docs: number }[] = [];
    for (const it of files) {
      let n = 0;
      try {
        const { data: blob } = await sb.storage.from("shelf").download(it.file_path);
        if (!blob) throw new Error("missing");
        const bytes = Buffer.from(await blob.arrayBuffer());
        if (/\.json$/i.test(it.file_name ?? "") || /json/i.test(it.mime ?? "")) { const d = parse2BJson(JSON.parse(bytes.toString("utf8"))); docs.push(...d); n = d.length; }
        else {
          const wb = XLSX.read(bytes, { type: "buffer" });
          for (const name of wb.SheetNames.filter(s => /b2b/i.test(s))) { const d = parse2BGrid(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][]); docs.push(...d); n += d.length; }
        }
      } catch { /* reported as not read */ }
      used.push({ title: `${it.title}${it.period ? ` · ${it.period}` : ""}`, ok: n > 0, docs: n });
    }
    return NextResponse.json({ docs, files: used });
  } catch (e) { return serverError("gst shelf-2b", e, "Couldn't read GSTR-2B from the Shelf."); }
}
