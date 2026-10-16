import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { chargePaise, planById } from "@/lib/plans";
import { discountFor } from "@/lib/referrals";

// Starts a FreBook payment for Basic / Pro / Unlimited.
//  • A referral discount applies (new user's first month, or a referrer's earned credit) → a one-time order at half price.
//  • RAZORPAY_PLAN_ID_<BASIC|PRO|UNLIMITED> set (or RAZORPAY_PLAN_ID for Unlimited) → a Razorpay Subscription (autopay).
//  • Otherwise → a one-time order for one month (price + GST).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RZP_PLAN_ENV: Record<string, string> = { fb_basic: "RAZORPAY_PLAN_ID_BASIC", fb_pro: "RAZORPAY_PLAN_ID_PRO", frebook: "RAZORPAY_PLAN_ID_UNLIMITED" };

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { plan } = await req.json();
    if (!planById(plan)) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const discount = await discountFor(sb, user.id).catch(() => null);   // referral tables missing → full price
    const paise = chargePaise(plan, discount?.pct ?? 0)!;

    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) return NextResponse.json({ error: "Payments aren't set up yet. Please contact support." }, { status: 503 });
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const notes: Record<string, string> = { plan, user_id: user.id, email: user.email ?? "" };
    if (discount) Object.assign(notes, { discount_pct: String(discount.pct), ref_kind: discount.kind, ref_id: discount.referralId });

    const planId = (process.env[RZP_PLAN_ENV[plan]] ?? (plan === "frebook" ? process.env.RAZORPAY_PLAN_ID : "") ?? "").trim();
    if (planId && !discount) {
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
    return NextResponse.json({ mode: "order", order_id: order.id, key_id: keyId, amount_paise: paise, discount_pct: discount?.pct ?? 0, discount_reason: discount?.kind ?? null });
  } catch (e) {
    return serverError("subscription/create-order", e, "Couldn't start the payment. Please try again.");
  }
}
