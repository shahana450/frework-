import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PLAN_PRICES } from "@/lib/plans";

// Razorpay → FreWork: monthly renewals of FreBook subscriptions.
//   Razorpay Dashboard → Webhooks → URL https://frework.online/api/finance/subscription/razorpay-webhook,
//   secret = RAZORPAY_WEBHOOK_SECRET, events: subscription.charged, subscription.cancelled, subscription.halted.
// A successful charge moves "subscription ends at" to the end of the newly paid month. Cancelled or halted mandates
// are not extended, so access simply runs to the end of the month already paid for.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = secret ? crypto.createHmac("sha256", secret).update(raw).digest("hex") : "";
  if (!secret || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    console.error("razorpay-webhook: rejected unsigned or mis-signed request", { hasSecret: !!secret });
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let evt: { event?: string; payload?: { subscription?: { entity?: { id: string; current_end?: number; notes?: Record<string, string> } }; payment?: { entity?: { id: string; amount: number } } } };
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const sub = evt.payload?.subscription?.entity;
  const userId = sub?.notes?.user_id, plan = sub?.notes?.plan;
  if (!sub || !userId || !plan || !PLAN_PRICES[plan]) return NextResponse.json({ ok: true });   // not a FreBook subscription

  if (evt.event === "subscription.charged") {
    const pay = evt.payload?.payment?.entity;
    const endsAt = sub.current_end ? new Date(sub.current_end * 1000) : new Date(Date.now() + 30 * 86400000);
    const { error } = await supabase.from("fw_fin_subscriptions").upsert({
      user_id: userId, plan, amount: (pay?.amount ?? 0) / 100, status: "active",
      payment_id: pay?.id ?? null, order_id: sub.id,
      subscription_ends_at: endsAt.toISOString(), granted_by_admin: false, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) { console.error("razorpay-webhook: save failed", error.message); return NextResponse.json({ error: "retry" }, { status: 500 }); }   // Razorpay retries
  } else if (evt.event === "subscription.cancelled" || evt.event === "subscription.halted") {
    console.info("razorpay-webhook:", evt.event, sub.id, "— access runs to the end of the paid month");
  }
  return NextResponse.json({ ok: true });
}
