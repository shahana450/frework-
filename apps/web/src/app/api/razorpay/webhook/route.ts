import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  // Verify signature
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const notes = payment.notes ?? {};
    const userId: string | undefined = notes.user_id;
    const plan: string | undefined = notes.plan;
    const billing: string | undefined = notes.billing;

    if (userId && plan) {
      await supabaseAdmin.from("fw_subscriptions").upsert({
        user_id: userId,
        plan,
        billing: billing ?? "monthly",
        amount: Math.floor(payment.amount / 100),
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
        status: "active",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
  }

  if (event.event === "subscription.cancelled" || event.event === "payment.failed") {
    const payment = event.payload.payment?.entity;
    const userId: string | undefined = payment?.notes?.user_id;
    if (userId) {
      await supabaseAdmin.from("fw_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
  }

  return NextResponse.json({ received: true });
}
