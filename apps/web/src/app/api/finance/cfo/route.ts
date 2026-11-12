import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks } from "@/lib/intentEngine";
import { computeCfo } from "@/lib/cfo";

// Business analysis (CFO view) for one financial year, from posted entries. Read-only.
export const runtime = "nodejs";
export const maxDuration = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams; const bizId = sp.get("business_id"); const fyId = sp.get("fy_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const q = sb.from("fw_fin_financial_years").select("label,start_date,end_date").eq("business_id", bizId!);
    const { data: fy } = fyId ? await q.eq("id", fyId).maybeSingle() : await q.lte("start_date", today).gte("end_date", today).maybeSingle();
    const y = today.slice(5) >= "04-01" ? +today.slice(0, 4) : +today.slice(0, 4) - 1;
    const from = fy?.start_date ?? `${y}-04-01`, to = fy?.end_date ?? `${y + 1}-03-31`;
    const books = await loadQueryBooks(sb, bizId!, to);
    if (books.error) return serverError("cfo", books.error, "Couldn't read the books.");
    return NextResponse.json({ fy: fy?.label ?? `${y}-${String(y + 1).slice(2)}`, ...computeCfo(books.accounts, books.journals, from, to, today) });
  } catch (e) { return serverError("cfo", e, "Couldn't build the analysis."); }
}
