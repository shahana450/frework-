import { NextRequest, NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/apiAuth";
import { chargePaise } from "@/lib/plans";

// Starts a FreBook payment.
//  • RAZORPAY_PLAN_ID set (a ₹1,768.82/month plan made in the Razorpay dashboard) → a Razorpay Subscription: UPI AutoPay or card
//    mandate, charged automatically every month; renewals arrive on the webhook.
//  • Otherwise → a one-time order for one month (price + GST).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { plan } = await req.json();
    const paise = chargePaise(plan);
    if (!paise) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) return NextResponse.json({ error: "Payments aren't set up yet. Please contact support." }, { status: 503 });
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const notes = { plan, user_id: user.id, email: user.email ?? "" };

    const planId = process.env.RAZORPAY_PLAN_ID?.trim();
    if (planId) {
      const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST", headers,
        body: JSON.stringify({ plan_id: planId, total_count: 120, quantity: 1, customer_notify: 1, notes }),
      });
      if (!res.ok) return serverError("subscription/create-order (subscription)", await res.text(), "Couldn't start the payment. Please try again.");
      const sub = await res.json();
      return NextResponse.json({ mode: "subscription", subscription_id: sub.id, key_id: keyId, amount_paise: paise });
    }

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST", headers,
      body: JSON.stringify({ amount: paise, currency: "INR", receipt: `fp_${plan}_${user.id.slice(0, 8)}_${Date.now()}`, notes }),
    });
    if (!res.ok) return serverError("subscription/create-order", await res.text(), "Couldn't start the payment. Please try again.");
    const order = await res.json();
    return NextResponse.json({ mode: "order", order_id: order.id, key_id: keyId, amount_paise: paise });
  } catch (e) {
    return serverError("subscription/create-order", e, "Couldn't start the payment. Please try again.");
  }
}
