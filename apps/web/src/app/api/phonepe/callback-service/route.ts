import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MERCHANT_ID, PHONEPE_BASE_URL, SALT_KEY, SALT_INDEX } from "@/lib/phonepe";
import { SERVICE_PAISE, verifyFields } from "@/lib/phonepeOrder";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PhonePe returns the buyer here. The link is signed at order time, PhonePe confirms payment and amount
// server-to-server, the amount must be the service's price, and a transaction is recorded once.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const f = {
    txnId: sp.get("txnId") ?? "", service: sp.get("service") ?? "", amount: sp.get("amount") ?? "", userId: sp.get("userId") ?? "",
    name: sp.get("name") ?? "", phone: sp.get("phone") ?? "", email: sp.get("email") ?? "", business: sp.get("business") ?? "", notes: sp.get("notes") ?? "",
  };
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";
  const fail = (reason: string) => NextResponse.redirect(`${baseUrl}/order/failed?reason=${reason}`);

  try {
    if (!verifyFields([f.txnId, f.service, f.amount, f.userId, f.name, f.phone, f.email, f.business, f.notes], sp.get("sig") ?? "")) return fail("invalid_link");
    if (SERVICE_PAISE[f.service] !== Number(f.amount)) return fail("unknown_service");

    const endpoint   = `/pg/v1/status/${MERCHANT_ID}/${f.txnId}`;
    const checksum   = crypto.createHash("sha256").update(endpoint + SALT_KEY).digest("hex") + "###" + SALT_INDEX;
    const statusRes = await fetch(`${PHONEPE_BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": MERCHANT_ID },
    });
    const status = await statusRes.json();
    if (!(status.success && status.data?.state === "COMPLETED")) return fail("payment_failed");
    if (Number(status.data.amount) !== Number(f.amount)) { console.error("[PhonePe service] amount mismatch", f.txnId); return fail("amount_mismatch"); }

    // Recorded once per transaction, however many times the link is opened
    const { data: existing } = await supabaseAdmin.from("fw_orders").select("id").eq("phonepe_txn_id", f.txnId).maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("fw_orders").insert({
        user_id: f.userId || null, service_key: f.service, service_name: f.service, amount_paise: Number(status.data.amount),
        status: "paid", phonepe_txn_id: f.txnId, phonepe_payment_id: status.data.transactionId ?? "",
        customer_name: f.name, customer_phone: f.phone, customer_email: f.email, business_name: f.business || null, notes: f.notes || null,
        paid_at: new Date().toISOString(),
      });
    }
    return NextResponse.redirect(`${baseUrl}/order/success?service=${encodeURIComponent(f.service)}&amount=${Math.floor(Number(f.amount) / 100)}`);
  } catch {
    return fail("server_error");
  }
}
