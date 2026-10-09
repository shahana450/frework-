import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { PLAN_PRICES } from "@/lib/plans";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json();
    const keyId = process.env.RAZORPAY_KEY_ID!;
    const secret = process.env.RAZORPAY_KEY_SECRET!;

    const expected = crypto.createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const sigOk = typeof razorpay_signature === "string" && expected.length === razorpay_signature.length
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!sigOk) return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });

    // Plan, payer and amount come from Razorpay's copy of the order, not from the browser
    const auth = Buffer.from(`${keyId}:${secret}`).toString("base64");
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpay_order_id)}`, { headers: { Authorization: `Basic ${auth}` } });
    if (!orderRes.ok) return serverError("subscription/verify", await orderRes.text(), "Payment could not be verified. Contact support if money was deducted.");
    const order = await orderRes.json();
    const plan = order.notes?.plan as string;
    if (order.notes?.user_id !== user.id) return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 });
    if (!PLAN_PRICES[plan] || order.amount_paid < PLAN_PRICES[plan] * 100) {
      return NextResponse.json({ error: "Payment amount doesn't match the plan. Contact support." }, { status: 400 });
    }

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 30);
    await supabaseAdmin.from("fw_fin_subscriptions").upsert({
      user_id: user.id,
      plan,
      amount: order.amount_paid / 100,
      status: "active",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      subscription_ends_at: endsAt.toISOString(),
      granted_by_admin: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("subscription/verify", e, "Payment could not be verified. Contact support if money was deducted.");
  }
}
