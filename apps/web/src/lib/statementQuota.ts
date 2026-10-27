// Monthly allowance of bank-statement pages read by the AI, charged to the business owner's plan.
// If the usage table isn't set up yet, nothing is blocked (the allowance simply isn't enforced).
import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAllowance, planLabel, upgradeFor, planById, FREBOOK_PLAN, PAYMENTS_LIVE } from "./plans";
import { isAdminEmail } from "./apiAuth";

const monthKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

export type QuotaCheck =
  | { ok: true; ownerId: string | null }
  | { ok: false; error: string; used: number; allowance: number; upgrade: { id: string; name: string; price: number; pages: number } | null };

export async function checkStatementPages(sb: SupabaseClient, businessId: string | null, userEmail: string | null | undefined, pages: number): Promise<QuotaCheck> {
  if (!businessId || pages <= 0 || isAdminEmail(userEmail)) return { ok: true, ownerId: null };
  const { data: biz } = await sb.from("fw_fin_businesses").select("owner_id").eq("id", businessId).maybeSingle();
  const ownerId = (biz?.owner_id as string | undefined) ?? null;
  if (!ownerId) return { ok: true, ownerId: null };
  const [{ data: sub }, usage] = await Promise.all([
    sb.from("fw_fin_subscriptions").select("plan,status,subscription_ends_at").eq("user_id", ownerId).maybeSingle(),
    sb.from("fw_fin_statement_usage").select("pages").eq("owner_id", ownerId).eq("month", monthKey()).maybeSingle(),
  ]);
  if (usage.error) return { ok: true, ownerId: null };          // table not created yet → don't block
  const live = !!sub && (sub.status === "active" || sub.status === "trial") && (!sub.subscription_ends_at || sub.subscription_ends_at > new Date().toISOString());
  // No plan yet: the Starter allowance, so anyone can try one statement
  // Before payments go live everyone gets the trial allowance
  const allowance = !PAYMENTS_LIVE ? pageAllowance(FREBOOK_PLAN.id, "trial") : live ? pageAllowance(sub!.plan, sub!.status) : (planById("fb_starter")?.pages ?? 100);
  const used = Number(usage.data?.pages ?? 0);
  if (used + pages <= allowance) return { ok: true, ownerId };
  const cur = live ? sub!.plan : null;
  const next = upgradeFor(0, cur && planById(cur)?.sold ? cur : null);
  const nextUp = next && next.pages > allowance ? next : null;
  return {
    ok: false, used, allowance,
    upgrade: nextUp ? { id: nextUp.id, name: nextUp.name, price: nextUp.price, pages: nextUp.pages } : null,
    error: `This month's statement reading allowance is used up (${used.toLocaleString("en-IN")} of ${allowance.toLocaleString("en-IN")} pages on ${live ? planLabel(sub!.plan) : "the free start"}).`
      + (nextUp ? ` Upgrade to ${nextUp.name} (₹${nextUp.price.toLocaleString("en-IN")}/month) for ${nextUp.pages.toLocaleString("en-IN")} pages a month.` : "")
      + " Excel or CSV statements are read without using the allowance.",
  };
}

export async function addStatementPages(sb: SupabaseClient, ownerId: string | null, pages: number) {
  if (!ownerId || pages <= 0) return;
  await sb.rpc("fw_fin_add_statement_pages", { p_owner: ownerId, p_month: monthKey(), p_pages: pages }).then(() => null, () => null);
}
