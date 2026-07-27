import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_ID, PHONEPE_BASE_URL, encodePayload, generateChecksum } from "@/lib/phonepe";

const PLAN_AMOUNTS: Record<string, number> = {
  professional: 99900,
  growth:       299900,
  business:     499900,
  enterprise:   999900,
};

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, billing } = await req.json();

    const amount = PLAN_AMOUNTS[plan?.toLowerCase()];
    if (!amount) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const merchantTransactionId = `FW_${plan}_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: userId ?? "GUEST",
      amount,
      redirectUrl: `${baseUrl}/api/phonepe/callback?txnId=${merchantTransactionId}&plan=${plan}&billing=${billing ?? "monthly"}&userId=${userId ?? ""}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${baseUrl}/api/phonepe/webhook`,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const base64Payload = encodePayload(payload);
    const checksum      = generateChecksum(base64Payload, "/pg/v1/pay");

    const response = await fetch(`${PHONEPE_BASE_URL}/pg/v1/pay`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "X-VERIFY":      checksum,
        "X-MERCHANT-ID": MERCHANT_ID,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json({ error: data.message ?? "PhonePe order failed" }, { status: 400 });
    }

    const redirectUrl = data.data?.instrumentResponse?.redirectInfo?.url;
    return NextResponse.json({ redirectUrl, merchantTransactionId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
