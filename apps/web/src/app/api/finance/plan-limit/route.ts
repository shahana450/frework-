import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError, isAdminEmail } from "@/lib/apiAuth";
import { businessLimit, planLabel, upgradeFor, PAYMENTS_LIVE } from "@/lib/plans";

// How many businesses this login may keep on its plan, and how many it has. Used before adding a business.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const [{ data: sub }, { count }] = await Promise.all([
      sb.from("fw_fin_subscriptions").select("plan,status,subscription_ends_at").eq("user_id", user.id).maybeSingle(),
      sb.from("fw_fin_businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id).is("deleted_at", null),
    ]);
    const live = !!sub && (sub.status === "active" || sub.status === "trial") && (!sub.subscription_ends_at || sub.subscription_ends_at > new Date().toISOString());
    // No plan yet (or expired): the first business is always allowed, so anyone can start
    const limit = isAdminEmail(user.email) || !PAYMENTS_LIVE ? null : live ? businessLimit(sub!.plan, sub!.status) : 1;   // FreWork staff, or before payments go live: no limit
    const used = count ?? 0;
    // The cheapest plan above the current one that fits one more business
    const next = limit === null ? null : upgradeFor(used + 1, live ? sub!.plan : null);
    return NextResponse.json({
      plan: live ? sub!.plan : null, plan_label: live ? planLabel(sub!.plan) : "No plan", status: live ? sub!.status : null,
      limit, used, can_add: limit === null || used < limit,
      upgrade_to: next ? { id: next.id, name: next.name, price: next.price, yearly: next.yearly, businesses: next.businesses } : null,
    });
  } catch (e) {
    return serverError("plan-limit", e, "Couldn't check your plan.");
  }
}
