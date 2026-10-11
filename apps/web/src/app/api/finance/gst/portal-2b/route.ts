import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { PortalError, GSTIN_RE } from "@/lib/portals/types";
import { sandboxTaxpayerOtp, sandboxTaxpayerVerify, sandboxGstr2b } from "@/lib/portals/sandbox";
import { parse2BJson, type TwoBDoc } from "@/lib/itcMatch";

// "Fetch 2B from portal" on ITC Match, through Sandbox's taxpayer APIs.
// Step 1 (otp): the GST portal sends an OTP to the taxpayer. Step 2 (fetch): verify it and read GSTR-2B for the month.
// The taxpayer token (which could also file returns) lives only inside step 2 and is never stored.
export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Body = { business_id?: string; action?: "otp" | "fetch"; username?: string; otp?: string; month?: string };

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as Body;
  const gate = await requireBusiness(req, b.business_id, { action: "integrate" });
  if (gate instanceof NextResponse) return gate;
  if ((process.env.GSP_PROVIDER ?? "").trim().toLowerCase() !== "sandbox") {
    return NextResponse.json({ error: "Fetching GSTR-2B from the portal needs the Sandbox GST connection on the server. Upload the GSTR-2B file instead.", code: "NOT_CONFIGURED" }, { status: 409 });
  }
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
      const session = await sandboxTaxpayerVerify(gstin, username, (b.otp ?? "").trim());
      const parts = await sandboxGstr2b(session.token, b.month ?? "");
      const docs: TwoBDoc[] = parts.flatMap(p => parse2BJson(p));
      await logAudit(supabase, { businessId: b.business_id!, actor: gate.user.id, action: "gstr2b_fetch", source: "portals", detail: { month: b.month, documents: docs.length, provider: "sandbox" } });
      return NextResponse.json({ ok: true, docs, month: b.month });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) {
      const status = e.code === "OTP_INVALID" || e.code === "INVALID" ? 400 : e.code === "SESSION_EXPIRED" ? 401 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return serverError("gst/portal-2b", e, "The GST portal didn't respond. Please try again, or upload the GSTR-2B file.");
  }
}
