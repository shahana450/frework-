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
  const txnId    = searchParams.get("txnId")    ?? "";
  const service  = searchParams.get("service")  ?? "";
  const userId   = searchParams.get("userId")   ?? "";
  const name     = searchParams.get("name")     ?? "";
  const phone    = searchParams.get("phone")    ?? "";
  const email    = searchParams.get("email")    ?? "";
  const business = searchParams.get("business") ?? "";
  const notes    = searchParams.get("notes")    ?? "";
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";

  try {
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
      const amountRupees = Math.floor((paymentData.amount ?? 0) / 100);

      await supabaseAdmin.from("fw_orders").insert({
        user_id:            userId   || null,
        service_key:        service,
        service_name:       service,
        amount_paise:       paymentData.amount ?? 0,
        status:             "paid",
        phonepe_txn_id:     txnId,
        phonepe_payment_id: paymentData.transactionId ?? "",
        customer_name:      name,
        customer_phone:     phone,
        customer_email:     email,
        business_name:      business || null,
        notes:              notes    || null,
        paid_at:            new Date().toISOString(),
      });

      return NextResponse.redirect(`${baseUrl}/order/success?service=${service}&amount=${amountRupees}`);
    }

    return NextResponse.redirect(`${baseUrl}/order/failed?reason=payment_failed`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/order/failed?reason=server_error`);
  }
}
