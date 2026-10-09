import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MERCHANT_ID, PHONEPE_BASE_URL, encodePayload, generateChecksum } from "@/lib/phonepe";
import { SERVICE_PAISE, signFields } from "@/lib/phonepeOrder";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// One-off professional-service orders. The price comes ONLY from SERVICE_PAISE — never from the browser.
// Guests may order; a signed-in buyer is taken from their token, not from the request body.
export async function POST(req: NextRequest) {
  try {
    const { service, serviceName, customerName, customerPhone, customerEmail, businessName, notes } = await req.json();
    const amount = SERVICE_PAISE[String(service ?? "")];
    if (!amount) return NextResponse.json({ error: "This service is quoted separately — please contact us." }, { status: 400 });

    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const userId = token ? (await supabaseAdmin.auth.getUser(token)).data.user?.id ?? "" : "";

    const merchantTransactionId = `FW_SVC_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";
    const f = {
      txnId: merchantTransactionId, service: String(service), amount: String(amount), userId,
      name: String(customerName ?? "").slice(0, 120), phone: String(customerPhone ?? "").slice(0, 20), email: String(customerEmail ?? "").slice(0, 160),
      business: String(businessName ?? "").slice(0, 160), notes: String(notes ?? "").slice(0, 500),
    };
    // Everything the callback will record is signed, so the return link can't be edited
    const sig = signFields([f.txnId, f.service, f.amount, f.userId, f.name, f.phone, f.email, f.business, f.notes]);
    const params = new URLSearchParams({ ...f, sig });

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: userId || "GUEST",
      amount,
      redirectUrl: `${baseUrl}/api/phonepe/callback-service?${params.toString()}`,
      redirectMode: "REDIRECT",
      callbackUrl:  `${baseUrl}/api/phonepe/webhook`,
      paymentInstrument: { type: "PAY_PAGE" },
    };
    const base64Payload = encodePayload(payload);
    const checksum      = generateChecksum(base64Payload, "/pg/v1/pay");
    const response = await fetch(`${PHONEPE_BASE_URL}/pg/v1/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": MERCHANT_ID },
      body: JSON.stringify({ request: base64Payload }),
    });
    const data = await response.json();
    if (!data.success) return NextResponse.json({ error: data.message ?? "PhonePe order failed" }, { status: 400 });

    const redirectUrl = data.data?.instrumentResponse?.redirectInfo?.url;
    return NextResponse.json({ redirectUrl, merchantTransactionId, amount, serviceName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
