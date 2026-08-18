import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { plan, amount, user_id, email } = await req.json();
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: "INR",
        receipt: `fp_${plan}_${user_id?.slice(0, 8)}_${Date.now()}`,
        notes: { plan, user_id, email },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const order = await res.json();
    return NextResponse.json({ order_id: order.id, key_id: keyId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
