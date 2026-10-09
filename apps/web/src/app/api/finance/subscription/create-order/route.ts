import { NextRequest, NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/apiAuth";
import { PLAN_PRICES } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { plan } = await req.json();
    const price = PLAN_PRICES[plan];
    if (!price) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Payment not configured" }, { status: 503 });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: price * 100,
        currency: "INR",
        receipt: `fp_${plan}_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { plan, user_id: user.id, email: user.email ?? "" },
      }),
    });
    if (!res.ok) return serverError("subscription/create-order", await res.text(), "Couldn't start the payment. Please try again.");

    const order = await res.json();
    return NextResponse.json({ order_id: order.id, key_id: keyId, amount: price });
  } catch (e) {
    return serverError("subscription/create-order", e, "Couldn't start the payment. Please try again.");
  }
}
