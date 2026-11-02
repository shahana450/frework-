import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks } from "@/lib/intentEngine";
import { runAudit360, scoreChecks } from "@/lib/audit360";
import { portalChecks, type PortalData } from "@/lib/auditPortal";

// 360° audit of one financial year, from posted entries — and, when the portal files are sent (POST), books against
// GSTR-1, GSTR-3B, GSTR-2B and 26AS. Read-only: nothing is changed or stored.
export const runtime = "nodejs";
export const maxDuration = 60;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function audit(req: NextRequest, bizId: string | null, fyId: string | null, portal: PortalData) {
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  const today = new Date().toLocaleDateString("en-CA");
  const { data: fy } = fyId
    ? await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date").eq("id", fyId).eq("business_id", bizId!).maybeSingle()
    : await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date").eq("business_id", bizId!).lte("start_date", today).gte("end_date", today).maybeSingle();
  if (!fy) return NextResponse.json({ error: "Choose a financial year first." }, { status: 400 });

  const [books, drafts, opening] = await Promise.all([
    loadQueryBooks(supabase, bizId!, fy.end_date),
    supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId!).eq("status", "draft").gte("date", fy.start_date).lte("date", fy.end_date),
    supabase.from("fw_fin_journals").select("id").eq("business_id", bizId!).eq("status", "posted").eq("date", fy.start_date).ilike("narration", "Opening balances%").limit(1),
  ]);
  if (books.error) return serverError("audit360", books.error, "Couldn't read the books for the audit.");
  const period = { from: fy.start_date, to: fy.end_date };
  const base = runAudit360(books.accounts, books.journals, period, { today, drafts: drafts.count ?? 0, openingPosted: (opening.data ?? []).length > 0 });
  const checks = [...base.checks, ...portalChecks(books.accounts, books.journals, period, portal ?? {})];
  return NextResponse.json({ fy: { id: fy.id, label: fy.label }, period, checks, ...scoreChecks(checks) });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    return await audit(req, sp.get("business_id"), sp.get("fy_id"), {});
  } catch (e) { return serverError("audit360", e, "Couldn't run the audit right now."); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { business_id?: string; fy_id?: string; portal?: PortalData };
    return await audit(req, body.business_id ?? null, body.fy_id ?? null, body.portal ?? {});
  } catch (e) { return serverError("audit360", e, "Couldn't run the audit right now."); }
}
