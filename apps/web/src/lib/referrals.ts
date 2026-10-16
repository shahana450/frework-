// Referral rules, shared by checkout, payment verification and the referral page. Server-only (service key).
import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERRAL_DISCOUNT_PCT } from "./plans";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O, 1/I
const makeCode = () => Array.from({ length: 7 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/** This user's referral code, created the first time it's asked for. */
export async function codeFor(sb: SupabaseClient, userId: string): Promise<string> {
  const { data } = await sb.from("fw_referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (data?.code) return data.code;
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const { error } = await sb.from("fw_referral_codes").insert({ user_id: userId, code });
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    const again = await sb.from("fw_referral_codes").select("code").eq("user_id", userId).maybeSingle();
    if (again.data?.code) return again.data.code;   // a parallel request made it
  }
  throw new Error("Couldn't make a referral code");
}

export type Discount = { pct: number; kind: "referred" | "referrer"; referralId: string } | null;

/** Half price for this payment? First paid month of a referred user, else one earned referrer credit. */
export async function discountFor(sb: SupabaseClient, userId: string): Promise<Discount> {
  const { data: mine } = await sb.from("fw_referrals").select("id,referred_discount_used").eq("referred_id", userId).maybeSingle();
  if (mine && !mine.referred_discount_used) {
    const { data: paidBefore } = await sb.from("fw_fin_subscriptions").select("amount").eq("user_id", userId).gt("amount", 0).limit(1);
    if (!paidBefore?.length) return { pct: REFERRAL_DISCOUNT_PCT, kind: "referred", referralId: mine.id };
  }
  const { data: credit } = await sb.from("fw_referrals").select("id").eq("referrer_id", userId)
    .not("referred_paid_at", "is", null).eq("referrer_credit_used", false).order("referred_paid_at").limit(1).maybeSingle();
  return credit ? { pct: REFERRAL_DISCOUNT_PCT, kind: "referrer", referralId: credit.id } : null;
}

/** After a successful payment: use up the discount that was applied, and give the referrer their credit. */
export async function afterPayment(sb: SupabaseClient, userId: string, applied?: { kind?: string; referralId?: string }) {
  const now = new Date().toISOString();
  if (applied?.kind === "referred" && applied.referralId) await sb.from("fw_referrals").update({ referred_discount_used: true }).eq("id", applied.referralId).eq("referred_id", userId);
  if (applied?.kind === "referrer" && applied.referralId) await sb.from("fw_referrals").update({ referrer_credit_used: true }).eq("id", applied.referralId).eq("referrer_id", userId);
  // The new user's first payment of any kind earns the referrer a half-price month
  await sb.from("fw_referrals").update({ referred_paid_at: now }).eq("referred_id", userId).is("referred_paid_at", null);
}
