import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { PLAN_PRICES, chargePaise, billingDays, type Billing } from "@/lib/plans";
import { afterPayment } from "@/lib/referrals";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sigOk = (secret: string, payload: string, sig: unknown) => {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return typeof sig === "string" && expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
};

// Confirms the first payment in the browser. Monthly renewals of a subscription are confirmed by the webhook.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { razorpay_payment_id, razorpay_order_id, razorpay_subscription_id, razorpay_signature } = await req.json();
    const keyId = process.env.RAZORPAY_KEY_ID!.trim();
    const secret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const auth = Buffer.from(`${keyId}:${secret}`).toString("base64");
    const get = (path: string) => fetch(`https://api.razorpay.com/v1/${path}`, { headers: { Authorization: `Basic ${auth}` } });

    let plan: string, paid: number, ref: string, endsAt: Date;
    let applied: { kind?: string; referralId?: string } | undefined;
    if (razorpay_subscription_id) {
      // Subscription: signature is over payment_id|subscription_id
      if (!sigOk(secret, `${razorpay_payment_id}|${razorpay_subscription_id}`, razorpay_signature)) return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
      const [subRes, payRes] = await Promise.all([get(`subscriptions/${encodeURIComponent(razorpay_subscription_id)}`), get(`payments/${encodeURIComponent(razorpay_payment_id)}`)]);
      if (!subRes.ok || !payRes.ok) return serverError("subscription/verify", await subRes.text(), "Payment could not be verified. Contact support if money was deducted.");
      const sub = await subRes.json(), pay = await payRes.json();
      if (sub.notes?.user_id !== user.id) return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 });
      plan = sub.notes?.plan as string;
      // The mandate payment may be a small authorisation; the first charge follows. Trust Razorpay's period end.
      paid = Number(pay.amount) || 0;
      ref = razorpay_subscription_id;
      endsAt = sub.current_end ? new Date(sub.current_end * 1000) : new Date(Date.now() + 30 * 86400000);
      if (!PLAN_PRICES[plan]) return NextResponse.json({ error: "Unknown plan. Contact support." }, { status: 400 });
    } else {
      if (!sigOk(secret, `${razorpay_order_id}|${razorpay_payment_id}`, razorpay_signature)) return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
      // Plan, payer and amount come from Razorpay's copy of the order, not from the browser
      const orderRes = await get(`orders/${encodeURIComponent(razorpay_order_id)}`);
      if (!orderRes.ok) return serverError("subscription/verify", await orderRes.text(), "Payment could not be verified. Contact support if money was deducted.");
      const order = await orderRes.json();
      plan = order.notes?.plan as string;
      if (order.notes?.user_id !== user.id) return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 });
      // A referral discount was decided on the server when the order was made; it travels in the order's notes
      const pct = Number(order.notes?.discount_pct ?? 0);
      const billing: Billing = order.notes?.billing === "yearly" ? "yearly" : "monthly";
      const due = chargePaise(plan, pct === 50 ? 50 : 0, billing);
      if (!due || order.amount_paid < due) return NextResponse.json({ error: "Payment amount doesn't match the plan. Contact support." }, { status: 400 });
      if (pct) applied = { kind: order.notes?.ref_kind, referralId: order.notes?.ref_id };
      paid = order.amount_paid;
      ref = razorpay_order_id;
      // Paying again before the period ends adds on to it, so no paid days are lost
      const { data: cur } = await supabaseAdmin.from("fw_fin_subscriptions").select("plan,status,subscription_ends_at").eq("user_id", user.id).maybeSingle();
      const from = cur?.status === "active" && cur.plan === plan && cur.subscription_ends_at && Date.parse(cur.subscription_ends_at) > Date.now() ? Date.parse(cur.subscription_ends_at) : Date.now();
      endsAt = new Date(from + billingDays(billing) * 86400000);
    }

    await supabaseAdmin.from("fw_fin_subscriptions").upsert({
      user_id: user.id, plan, amount: paid / 100, status: "active",
      payment_id: razorpay_payment_id, order_id: ref,   // order_id holds the Razorpay subscription id (sub_…) for auto-renewing plans
      subscription_ends_at: endsAt.toISOString(), granted_by_admin: false, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await afterPayment(supabaseAdmin, user.id, applied).catch(e => console.error("referral after payment", e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("subscription/verify", e, "Payment could not be verified. Contact support if money was deducted.");
  }
}
