// FreBook plans: the same features on every plan; they differ only in how many businesses one login can keep.
// The server charges and verifies against PLAN_PRICES; pages only display them.
const FEATURES = [
  "FreBook chat bookkeeping — AI drafts, you confirm",
  "GST invoicing, purchase bills and journals",
  "Ledgers, receivables & payables by party",
  "Bank statement import (CSV / Excel) and reconciliation",
  "GSTR-1 & GSTR-3B preparation",
  "TDS tracker",
  "Tally push and import",
  "P&L, Balance Sheet and trial balance",
] as const;

export type FreBookPlan = { id: string; name: string; price: number; businesses: number | null; features: readonly string[]; badge?: string };

/** Basic ₹699 (2 businesses) · Pro ₹999 (5) · Unlimited ₹1,499 — ₹ per month, + GST. */
export const FREBOOK_PLANS_LIST: readonly FreBookPlan[] = [
  { id: "fb_basic", name: "Basic", price: 699, businesses: 2, features: FEATURES },
  { id: "fb_pro", name: "Pro", price: 999, businesses: 5, features: FEATURES, badge: "Most popular" },
  // Keeps the original id, so everyone already paying ₹1,499 is on Unlimited without any change
  { id: "frebook", name: "Unlimited", price: 1499, businesses: null, features: FEATURES },
];

/** The top plan (₹1,499, unlimited businesses). Older code and existing subscriptions use this id. */
export const FREBOOK_PLAN = FREBOOK_PLANS_LIST[2];
export const LOWEST_PLAN = FREBOOK_PLANS_LIST[0];

export const PLAN_PRICES: Record<string, number> = Object.fromEntries(FREBOOK_PLANS_LIST.map(p => [p.id, p.price]));
export const planById = (id: string | null | undefined) => FREBOOK_PLANS_LIST.find(p => p.id === (id ?? "").trim().toLowerCase());

/** How many businesses a login may keep on this plan. null = unlimited. A free trial gets Unlimited, to try everything. */
export function businessLimit(plan: string | null | undefined, status?: string | null): number | null {
  if (status === "trial") return null;
  const p = planById(plan);
  if (p) return p.businesses;
  return isLegacyPlan(plan) ? null : LOWEST_PLAN.businesses;   // earlier paid plans keep unlimited
}

/** Referral: the new user's first paid month and the referrer's next payment are both half price. */
export const REFERRAL_DISCOUNT_PCT = 50;

/** GST charged on the FreBook subscription (SAC 9983, 18%). Prices are shown "+ GST", so GST is added at checkout. */
export const SUBSCRIPTION_GST_RATE = 18;

/** What the customer pays for one month, in paise: plan price (less any referral discount) + GST. ₹1,499 → 176882 (₹1,768.82). */
export function chargePaise(plan: string, discountPct = 0): number | null {
  const price = PLAN_PRICES[plan];
  return price ? Math.round(price * (1 - discountPct / 100) * 100 * (1 + SUBSCRIPTION_GST_RATE / 100)) : null;
}

// Plan ids sold before the single FreBook plan. Subscription rows may still carry them; they display, they are never sold.

export const LEGACY_PLAN_IDS = ["starter", "professional", "growth", "business", "enterprise", "basic", "pro"] as const;   // not the fb_basic / fb_pro plans

export function isLegacyPlan(id: string | null | undefined): boolean {
  return !!id && (LEGACY_PLAN_IDS as readonly string[]).includes(id.toLowerCase());
}

/** Display name for any stored plan id — never throws, never shows a raw id as if it were current. */
export function planLabel(id: string | null | undefined): string {
  if (!id) return "Free";
  const k = id.trim().toLowerCase();
  const cur = planById(k);
  if (cur) return `FreBook ${cur.name}`;
  const old = k ? k[0].toUpperCase() + k.slice(1) : "";
  return isLegacyPlan(k) ? `FreBook (earlier plan: ${old})` : `FreBook (${id})`;
}

/** "₹699" — the starting price, as pages show it ("from ₹699/month"). */
export const FREBOOK_PRICE_LABEL = `₹${LOWEST_PLAN.price.toLocaleString("en-IN")}`;
export const priceLabel = (n: number) => `₹${n.toLocaleString("en-IN")}`;
