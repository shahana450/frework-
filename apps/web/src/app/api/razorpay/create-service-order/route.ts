import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

// Prices in paise (INR * 100)
const SERVICE_AMOUNTS: Record<string, number> = {
  "gst-registration":  99900,   // ₹999
  "income-tax":        79900,   // ₹799
  "accounting":       149900,   // ₹1,499
  "company-reg":       99900,   // ₹999
  "gst-audit":        499900,   // ₹4,999
  "roc-compliance":   199900,   // ₹1,999
};

export async function POST(req: NextRequest) {
  try {
    const { service, amount, userId, customerName, customerPhone, customerEmail } = await req.json();

    const finalAmount = amount ? amount * 100 : SERVICE_AMOUNTS[service];
    if (!finalAmount) return NextResponse.json({ error: "Invalid service or amount" }, { status: 400 });

    const razorpay = new Razorpay({
      key_id:    process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: finalAmount,
      currency: "INR",
      receipt: `fw_svc_${Date.now()}`,
      notes: {
        service,
        user_id:        userId ?? "",
        customer_name:  customerName ?? "",
        customer_phone: customerPhone ?? "",
        customer_email: customerEmail ?? "",
      },
    });

    return NextResponse.json({ orderId: order.id, amount: finalAmount, currency: "INR" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
