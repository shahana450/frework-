import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MERCHANT_ID, PHONEPE_BASE_URL, SALT_KEY, SALT_INDEX } from "@/lib/phonepe";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const txnId   = searchParams.get("txnId")  ?? "";
  const plan    = searchParams.get("plan")    ?? "";
  const billing = searchParams.get("billing") ?? "monthly";
  const userId  = searchParams.get("userId")  ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";

  try {
    // Verify payment status with PhonePe
    const endpoint   = `/pg/v1/status/${MERCHANT_ID}/${txnId}`;
    const hashString = endpoint + SALT_KEY;
    const checksum   = crypto.createHash("sha256").update(hashString).digest("hex") + "###" + SALT_INDEX;

    const statusRes = await fetch(`${PHONEPE_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type":  "application/json",
        "X-VERIFY":      checksum,
        "X-MERCHANT-ID": MERCHANT_ID,
      },
    });
    const status = await statusRes.json();

    if (status.success && status.data?.state === "COMPLETED") {
      const paymentData = status.data;

      if (userId && plan) {
        const PLAN_AMOUNTS: Record<string, number> = {
          professional: 999,
          growth:       2999,
          business:     4999,
          enterprise:   9999,
        };
        await supabaseAdmin.from("fw_subscriptions").upsert({
          user_id:              userId,
          plan,
          billing,
          amount:               PLAN_AMOUNTS[plan] ?? 0,
          phonepe_txn_id:       txnId,
          phonepe_payment_id:   paymentData.transactionId ?? "",
          status:               "active",
          started_at:           new Date().toISOString(),
          updated_at:           new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      return NextResponse.redirect(`${baseUrl}/subscribe/success?plan=${plan}`);
    }

    return NextResponse.redirect(`${baseUrl}/subscribe/failed?reason=payment_failed`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/subscribe/failed?reason=server_error`);
  }
}
