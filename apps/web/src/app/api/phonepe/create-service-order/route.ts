import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_ID, PHONEPE_BASE_URL, encodePayload, generateChecksum } from "@/lib/phonepe";

const SERVICE_AMOUNTS: Record<string, number> = {
  "gst-registration":  99900,
  "income-tax":        79900,
  "accounting":       149900,
  "company-reg":       99900,
  "gst-audit":        499900,
  "roc-compliance":   199900,
};

export async function POST(req: NextRequest) {
  try {
    const { service, serviceName, amount, userId, customerName, customerPhone, customerEmail, businessName, notes } =
      await req.json();

    const finalAmount = amount ? amount * 100 : SERVICE_AMOUNTS[service];
    if (!finalAmount) return NextResponse.json({ error: "Invalid service or amount" }, { status: 400 });

    const merchantTransactionId = `FW_SVC_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online";

    const params = new URLSearchParams({
      txnId:    merchantTransactionId,
      service:  service ?? "",
      userId:   userId  ?? "",
      name:     customerName  ?? "",
      phone:    customerPhone ?? "",
      email:    customerEmail ?? "",
      business: businessName  ?? "",
      notes:    notes         ?? "",
    });

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: userId ?? "GUEST",
      amount: finalAmount,
      redirectUrl: `${baseUrl}/api/phonepe/callback-service?${params.toString()}`,
      redirectMode: "REDIRECT",
      callbackUrl:  `${baseUrl}/api/phonepe/webhook`,
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
    return NextResponse.json({ redirectUrl, merchantTransactionId, amount: finalAmount, serviceName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
