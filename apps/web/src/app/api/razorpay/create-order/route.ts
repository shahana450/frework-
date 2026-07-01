import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const PLAN_AMOUNTS: Record<string, number> = {
  professional: 99900,   // ₹999 in paise
  growth:       299900,  // ₹2999
  business:     499900,  // ₹4999
  enterprise:   999900,  // ₹9999
};

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, billing } = await req.json();
    const amount = PLAN_AMOUNTS[plan?.toLowerCase()];
    if (!amount) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `fw_${plan}_${Date.now()}`,
      notes: { plan, user_id: userId ?? "", billing: billing ?? "monthly" },
    });

    return NextResponse.json({ orderId: order.id, amount, currency: "INR" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
