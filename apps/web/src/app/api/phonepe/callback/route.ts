import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MERCHANT_ID, PHONEPE_BASE_URL, SALT_KEY, SALT_INDEX } from "@/lib/phonepe";
import { verifyOrder } from "@/lib/phonepeOrder";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PhonePe sends the browser back here. Nothing in the URL is trusted on its own:
// the order is signed at creation, PhonePe confirms the payment and amount server-to-server,
// and a transaction can activate a plan only once.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const txnId   = searchParams.get("txnId")  ?? "";
  const plan    = (searchParams.get("plan") ?? "").toLowerCase();
  const billing = searchParams.get("billing") === "yearly" ? "yearly" : "monthly";
  const userId  = searchParams.get("userId")  ?? "";
  const sig     = searchParams.get("sig")     ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";
  const fail = (reason: string) => NextResponse.redirect(`${baseUrl}/subscribe/failed?reason=${reason}`);

  try {
    if (!txnId || !userId || !plan || !sig) return fail("invalid_link");

    // Confirm the payment with PhonePe, server to server
    const endpoint   = `/pg/v1/status/${MERCHANT_ID}/${txnId}`;
    const checksum   = crypto.createHash("sha256").update(endpoint + SALT_KEY).digest("hex") + "###" + SALT_INDEX;
    const statusRes = await fetch(`${PHONEPE_BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": MERCHANT_ID },
    });
    const status = await statusRes.json();
    if (!(status.success && status.data?.state === "COMPLETED")) return fail("payment_failed");

    // Signed link + amount actually paid must match the plan
    const check = verifyOrder({ txnId, userId, plan, billing, amount: Number(status.data?.amount) }, sig, status.data?.amount);
    if (!check.ok) { console.error("[PhonePe callback] refused", { txnId, reason: check.reason }); return fail(check.reason); }

    // Idempotent: a transaction activates a plan once, for the user it was created for
    const { data: used } = await supabaseAdmin.from("fw_subscriptions").select("user_id").eq("phonepe_txn_id", txnId).maybeSingle();
    if (used && used.user_id !== userId) return fail("already_used");
    if (!used) {
      await supabaseAdmin.from("fw_subscriptions").upsert({
        user_id:            userId,
        plan,
        billing,
        amount:             Number(status.data.amount) / 100,
        phonepe_txn_id:     txnId,
        phonepe_payment_id: status.data.transactionId ?? "",
        status:             "active",
        started_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    return NextResponse.redirect(`${baseUrl}/subscribe/success?plan=${plan}`);
  } catch {
    return fail("server_error");
  }
}
