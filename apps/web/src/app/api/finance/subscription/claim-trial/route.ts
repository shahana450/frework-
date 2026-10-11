import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";

// One free month of the FreBook plan, once per account. The user claims it themselves from the pricing page.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const TRIAL_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { data: existing } = await supabase.from("fw_fin_subscriptions").select("status,plan,subscription_ends_at").eq("user_id", user.id).maybeSingle();
    if (existing) {
      const live = (existing.status === "active" || existing.status === "trial") && (!existing.subscription_ends_at || existing.subscription_ends_at > new Date().toISOString());
      return NextResponse.json({ error: live ? "You already have access — no need to claim again." : "The free month has already been used on this account." }, { status: 409 });
    }
    const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    const { error } = await supabase.from("fw_fin_subscriptions").insert({
      user_id: user.id, plan: "frebook", amount: 0, status: "trial", trial_ends_at: ends, subscription_ends_at: ends,
      granted_by_admin: false, payment_id: null, updated_at: new Date().toISOString(),
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "The free month has already been used on this account." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true, ends_at: ends });
  } catch (e) {
    return serverError("subscription/claim-trial", e, "Couldn't start your free month. Please try again.");
  }
}
