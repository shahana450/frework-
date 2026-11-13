import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { PortalError, GSTIN_RE } from "@/lib/portals/types";
import { sandboxTaxpayerOtp, sandboxTaxpayerVerify, sandboxGstr1, sandboxGstr3b } from "@/lib/portals/sandbox";
import { buildMonthGstr1 } from "@/lib/gstr1Export";

// GST Returns Reconciliation: download the month's filed GSTR-1 and GSTR-3B from the portal (Sandbox taxpayer APIs) with one
// OTP, and return them with the GSTR-1 FreBook builds from the books. Read-only; the taxpayer token is never stored.
// GET ?business_id&month → books' GSTR-1 only (works without the portal, e.g. with an uploaded return).
export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams, bizId = sp.get("business_id"), month = sp.get("month") ?? "";
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Pick a month." }, { status: 400 });
  try {
    const g = await buildMonthGstr1(supabase, bizId!, month);
    return NextResponse.json({ books1: g.json });
  } catch (e) { return serverError("gst/portal-returns books", e, "Couldn't build GSTR-1 from your books."); }
}

type Body = { business_id?: string; action?: "otp" | "fetch"; username?: string; otp?: string; month?: string };
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as Body;
  const gate = await requireBusiness(req, b.business_id, { action: "integrate" });
  if (gate instanceof NextResponse) return gate;
  if ((process.env.GSP_PROVIDER ?? "").trim().toLowerCase() !== "sandbox")
    return NextResponse.json({ error: "Downloading returns from the portal needs the Sandbox GST connection on the server. Upload the GSTR-1 / 3B JSON instead.", code: "NOT_CONFIGURED" }, { status: 409 });
  try {
    const { data: biz } = await supabase.from("fw_fin_businesses").select("gstin").eq("id", b.business_id!).maybeSingle();
    const gstin = String(biz?.gstin ?? "").toUpperCase();
    if (!GSTIN_RE.test(gstin)) return NextResponse.json({ error: "Add this business's GSTIN in Settings first." }, { status: 400 });
    const username = (b.username ?? "").trim();
    if (!username) return NextResponse.json({ error: "Enter your GST portal username." }, { status: 400 });
    if (b.action === "otp") {
      await sandboxTaxpayerOtp(gstin, username);
      return NextResponse.json({ ok: true, message: "OTP sent to the mobile and email registered on the GST portal." });
    }
    if (b.action === "fetch") {
      if (!/^\d{4}-\d{2}$/.test(b.month ?? "")) return NextResponse.json({ error: "Pick a month." }, { status: 400 });
      const session = await sandboxTaxpayerVerify(gstin, username, (b.otp ?? "").trim());
      const [gstr1, gstr3b] = await Promise.all([sandboxGstr1(session.token, b.month!), sandboxGstr3b(session.token, b.month!)]);
      await logAudit(supabase, { businessId: b.business_id!, actor: gate.user.id, action: "gst_returns_fetch", source: "portals", detail: { month: b.month, provider: "sandbox" } });
      return NextResponse.json({ ok: true, gstr1, gstr3b });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) {
      const status = e.code === "OTP_INVALID" || e.code === "INVALID" ? 400 : e.code === "SESSION_EXPIRED" ? 401 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return serverError("gst/portal-returns", e, "The GST portal didn't respond. Try again, or upload the return JSON.");
  }
}
