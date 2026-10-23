import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { monthJournals } from "@/lib/gstr1Export";
import { buildTdsQuarter, quarterRange, type TdsJournal } from "@/lib/tdsReturn";

// Quarterly TDS return (non-salary) prepared from the books: deductees, sections, challans and what to fix.
//   GET ?business_id&quarter=2026-Q2
export const maxDuration = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get("business_id"), quarter = req.nextUrl.searchParams.get("quarter") ?? "";
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const range = quarterRange(quarter);
    if (!range) return NextResponse.json({ error: "Choose a quarter." }, { status: 400 });
    const [rows, { data: contacts }, { data: biz }] = await Promise.all([
      monthJournals(sb, bizId!, range.from, range.to),
      sb.from("fw_fin_contacts").select("name,pan").eq("business_id", bizId!),
      sb.from("fw_fin_businesses").select("*").eq("id", bizId!).maybeSingle(),
    ]);
    const pans = new Map(((contacts ?? []) as { name: string; pan: string | null }[]).filter(c => c.pan).map(c => [key(c.name), c.pan!.toUpperCase()]));
    const journals: TdsJournal[] = rows.map(j => ({ id: j.id, entry_no: j.entry_no, date: String(j.date).slice(0, 10), party_name: j.party_name ?? null, metadata: j.metadata ?? null,
      lines: (j.fw_fin_journal_lines ?? []).map(l => ({ account: l.fw_fin_chart_of_accounts?.name ?? "", dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })) }));
    const r = buildTdsQuarter(quarter, journals, p => pans.get(key(p)) ?? null)!;
    const b = (biz ?? {}) as { name?: string; tan?: string | null; pan?: string | null };
    if (!b.tan) r.issues.unshift({ level: "error", text: "Your TAN is missing — add it in Business Details. A TDS return can't be filed without it." });
    return NextResponse.json({ ...r, fy: range.fy, deductor: { name: b.name ?? "", tan: b.tan ?? null, pan: b.pan ?? null } });
  } catch (e) { return serverError("tds-return", e, "Couldn't prepare the TDS return."); }
}
