import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, isAdminEmail, serverError } from "@/lib/apiAuth";
import { FREBOOK_PLAN, PLAN_PRICES } from "@/lib/plans";

// Admin overview: users, businesses, FreBook subscriptions and revenue, product activity. Staff only.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString();

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = Date.now(), d7 = iso(now - 7 * DAY), d30 = iso(now - 30 * DAY);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    // Users (auth) — paged
    const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; app_metadata?: { provider?: string } }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      users.push(...(data.users as typeof users));
      if (data.users.length < 1000) break;
    }
    const signups = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now - (29 - i) * DAY).toISOString().slice(0, 10);
      return { day, n: users.filter(u => u.created_at.slice(0, 10) === day).length };
    });

    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const [bizRows, subsRes, posted7, posted30, viaWa30, waLinked] = await Promise.all([
      sb.from("fw_fin_businesses").select("id,owner_id,created_at,is_test,country").limit(20000),
      sb.from("fw_fin_subscriptions").select("user_id,plan,amount,status,payment_id,order_id,subscription_ends_at,granted_by_admin,updated_at,created_at").limit(20000),
      count(sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("status", "posted").gte("created_at", d7)),
      count(sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("status", "posted").gte("created_at", d30)),
      count(sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("status", "posted").eq("source", "whatsapp").gte("created_at", d30)),
      count(sb.from("fw_fin_wa_links").select("id", { count: "exact", head: true }).eq("verified", true)),
    ]);
    const biz = ((bizRows.data ?? []) as { id: string; owner_id: string; created_at: string; is_test?: boolean; country?: string }[]).filter(b => !b.is_test);
    const owners = new Set(biz.map(b => b.owner_id));
    const subs = (subsRes.data ?? []) as { user_id: string; plan: string; amount: number; status: string; payment_id: string | null; order_id: string | null; subscription_ends_at: string | null; granted_by_admin: boolean; updated_at: string }[];
    const live = subs.filter(s => ["active", "trial"].includes(s.status) && s.subscription_ends_at && Date.parse(s.subscription_ends_at) > now);
    const paying = live.filter(s => !s.granted_by_admin && !!s.payment_id && Number(s.amount) > 0);
    const free = live.filter(s => !paying.includes(s));
    const revenueMonth = subs.filter(s => s.payment_id && !s.granted_by_admin && Date.parse(s.updated_at) >= monthStart.getTime()).reduce((a, s) => a + (Number(s.amount) || 0), 0);
    const emailOf = new Map(users.map(u => [u.id, u.email ?? ""]));
    const expiring = live.filter(s => Date.parse(s.subscription_ends_at!) - now < 7 * DAY)
      .sort((a, b) => Date.parse(a.subscription_ends_at!) - Date.parse(b.subscription_ends_at!))
      .slice(0, 15).map(s => ({ email: emailOf.get(s.user_id) ?? s.user_id, ends: s.subscription_ends_at, paying: paying.includes(s), auto: (s.order_id ?? "").startsWith("sub_") }));

    return NextResponse.json({
      users: { total: users.length, new7: users.filter(u => u.created_at >= d7).length, new30: users.filter(u => u.created_at >= d30).length, active7: users.filter(u => (u.last_sign_in_at ?? "") >= d7).length },
      signups,
      businesses: { total: biz.length, new30: biz.filter(b => b.created_at >= d30).length, outsideIndia: biz.filter(b => b.country && b.country !== "IN").length },
      frebook: { paying: paying.length, free: free.length, mrr: paying.reduce((s: number, p: { plan?: string | null }) => s + (PLAN_PRICES[p.plan ?? ""] ?? FREBOOK_PLAN.price), 0), revenueMonth: Math.round(revenueMonth * 100) / 100, autoRenew: paying.filter(s => (s.order_id ?? "").startsWith("sub_")).length },
      activity: { posted7, posted30, viaWhatsApp30: viaWa30, waLinked },
      expiring,
      recent: [...users].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10)
        .map(u => ({ email: u.email ?? "", created: u.created_at, via: u.app_metadata?.provider ?? "email", hasBusiness: owners.has(u.id) })),
      // Most recent sign-ins (Supabase records the time of each sign-in; open sessions are not tracked)
      logins: users.filter(u => u.last_sign_in_at).sort((a, b) => (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? "")).slice(0, 25)
        .map(u => ({ email: u.email ?? "", at: u.last_sign_in_at as string, via: u.app_metadata?.provider ?? "email" })),
    });
  } catch (e) {
    return serverError("admin/metrics", e, "Couldn't load the admin overview.");
  }
}
