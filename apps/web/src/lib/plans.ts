// FreBook plans: the same features on every plan; they differ in how many businesses one login can keep and how many
// bank-statement pages the AI reads each month (spreadsheets are read without AI and don't count).
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

export type FreBookPlan = {
  id: string; name: string; price: number; yearly: number; businesses: number | null; pages: number;
  audience: string; features: readonly string[]; badge?: string; sold: boolean;
};
export type Billing = "monthly" | "yearly";

/** ₹ per month / per year (2 months free), + GST. Starter 1 business · Basic 2 · Pro 5 · CA Practice 15. */
export const ALL_PLANS: readonly FreBookPlan[] = [
  { id: "fb_starter", name: "Starter", price: 399, yearly: 3999, businesses: 1, pages: 100, audience: "One shop or freelancer", features: FEATURES, sold: true },
  { id: "fb_basic", name: "Basic", price: 699, yearly: 6999, businesses: 2, pages: 500, audience: "Small business", features: FEATURES, sold: true },
  { id: "fb_pro", name: "Pro", price: 999, yearly: 9999, businesses: 5, pages: 2000, audience: "Growing business or small CA", features: FEATURES, badge: "Most popular", sold: true },
  { id: "fb_ca", name: "CA Practice", price: 2499, yearly: 24999, businesses: 15, pages: 6000, audience: "Accountants with many clients", features: FEATURES, sold: true },
  // Earlier "Unlimited ₹1,499": no longer sold; everyone already on it keeps unlimited businesses
  { id: "frebook", name: "Unlimited", price: 1499, yearly: 14990, businesses: null, pages: 6000, audience: "Earlier plan", features: FEATURES, sold: false },
];
/** Plans on sale, cheapest first. */
export const FREBOOK_PLANS_LIST: readonly FreBookPlan[] = ALL_PLANS.filter(p => p.sold);

/** The top plan on sale. Trials and staff grants use it. */
export const FREBOOK_PLAN = FREBOOK_PLANS_LIST[FREBOOK_PLANS_LIST.length - 1];
export const LOWEST_PLAN = FREBOOK_PLANS_LIST[0];

export const PLAN_PRICES: Record<string, number> = Object.fromEntries(ALL_PLANS.map(p => [p.id, p.price]));
export const planById = (id: string | null | undefined) => ALL_PLANS.find(p => p.id === (id ?? "").trim().toLowerCase());

/** Statement pages the AI may read per month on this plan. Trials get the top plan's allowance. */
export function pageAllowance(plan: string | null | undefined, status?: string | null): number {
  if (status === "trial") return FREBOOK_PLAN.pages;
  return planById(plan)?.pages ?? (isLegacyPlan(plan) ? FREBOOK_PLAN.pages : 0);
}

/** The cheapest plan on sale that fits this many businesses and is above the current plan. */
export function upgradeFor(businessesNeeded: number, currentPlan?: string | null): FreBookPlan | null {
  const cur = planById(currentPlan);
  return FREBOOK_PLANS_LIST.find(p => (p.businesses === null || p.businesses >= businessesNeeded) && (!cur || p.price > cur.price)) ?? null;
}

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

/** What the customer pays, in paise: the month's or year's price, less any referral discount, + GST.
 *  A referral takes half of ONE month's price off — on a yearly plan too. Monthly ₹699 → 82482 (₹824.82). */
export function chargePaise(plan: string, discountPct = 0, billing: Billing = "monthly"): number | null {
  const p = planById(plan);
  if (!p || !p.sold && billing === "yearly") return null;
  const base = billing === "yearly" ? p.yearly : p.price;
  const off = p.price * discountPct / 100;
  return Math.round((base - off) * 100 * (1 + SUBSCRIPTION_GST_RATE / 100));
}
export const billingDays = (billing: Billing) => (billing === "yearly" ? 365 : 30);

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

/** Payments are not switched on yet: until NEXT_PUBLIC_PAYMENTS_LIVE=true, every login gets the full free trial
 *  (no paywall, unlimited businesses, trial statement allowance). */
export const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "true";
