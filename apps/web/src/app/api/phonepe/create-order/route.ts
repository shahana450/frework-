import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_ID, PHONEPE_BASE_URL, encodePayload, generateChecksum } from "@/lib/phonepe";
import { requireUser } from "@/lib/apiAuth";
import { PLAN_PAISE, signOrder } from "@/lib/phonepeOrder";

export async function POST(req: NextRequest) {
  try {
    // The payer is the signed-in user — never a userId sent by the browser
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { plan: rawPlan, billing: rawBilling } = await req.json();
    const plan = String(rawPlan ?? "").toLowerCase();
    const billing = rawBilling === "yearly" ? "yearly" : "monthly";

    const amount = PLAN_PAISE[plan];
    if (!amount) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const merchantTransactionId = `FW_${plan}_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";
    // Bind transaction, user, plan and amount so the redirect back can't be edited
    const sig = signOrder({ txnId: merchantTransactionId, userId: user.id, plan, billing, amount });
    const q = new URLSearchParams({ txnId: merchantTransactionId, plan, billing, userId: user.id, sig });

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: user.id,
      amount,
      redirectUrl: `${baseUrl}/api/phonepe/callback?${q}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${baseUrl}/api/phonepe/webhook`,
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
    return NextResponse.json({ redirectUrl, merchantTransactionId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
