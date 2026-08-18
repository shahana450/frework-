import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan, user_id, amount } = await req.json();
    const secret = process.env.RAZORPAY_KEY_SECRET!;

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Save subscription — active for 30 days
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 30);

    await supabaseAdmin.from("fw_fin_subscriptions").upsert({
      user_id,
      plan,
      amount,
      status: "active",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      subscription_ends_at: endsAt.toISOString(),
      granted_by_admin: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
