import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      service,
      serviceName,
      amount,
      userId,
      customerName,
      customerPhone,
      customerEmail,
      businessName,
      notes,
    } = await req.json();

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Save order to Supabase
    const { error } = await supabaseAdmin.from("fw_orders").insert({
      user_id:         userId ?? null,
      service_key:     service,
      service_name:    serviceName,
      amount_paise:    amount,
      status:          "paid",
      razorpay_order_id,
      razorpay_payment_id,
      customer_name:   customerName,
      customer_phone:  customerPhone,
      customer_email:  customerEmail,
      business_name:   businessName ?? null,
      notes:           notes ?? null,
      paid_at:         new Date().toISOString(),
    });

    if (error) console.error("Supabase insert error:", error.message);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
