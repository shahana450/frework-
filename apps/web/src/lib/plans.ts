// FreWork has one FreBook plan. The server charges and verifies against PLAN_PRICES; pages only display it.
export const FREBOOK_PLAN = {
  id: "frebook",
  name: "FreBook",
  price: 1499, // INR per month, + GST
  features: [
    "FreBook chat bookkeeping — AI drafts, you confirm",
    "GST invoicing, purchase bills and journals",
    "Ledgers, receivables & payables by party",
    "Bank statement import (CSV / Excel) and reconciliation",
    "GSTR-1 & GSTR-3B preparation",
    "TDS tracker",
    "Tally push and import",
    "P&L, Balance Sheet and trial balance",
  ],
} as const;

export const PLAN_PRICES: Record<string, number> = { [FREBOOK_PLAN.id]: FREBOOK_PLAN.price };

// Plan ids sold before the single FreBook plan. Subscription rows may still carry them; they display, they are never sold.
export const LEGACY_PLAN_IDS = ["starter", "professional", "growth", "business", "enterprise", "basic", "pro"] as const;

export function isLegacyPlan(id: string | null | undefined): boolean {
  return !!id && (LEGACY_PLAN_IDS as readonly string[]).includes(id.toLowerCase());
}

/** Display name for any stored plan id — never throws, never shows a raw id as if it were current. */
export function planLabel(id: string | null | undefined): string {
  if (!id) return "Free";
  const k = id.trim().toLowerCase();
  if (k === FREBOOK_PLAN.id) return FREBOOK_PLAN.name;
  const old = k ? k[0].toUpperCase() + k.slice(1) : "";
  return isLegacyPlan(k) ? `${FREBOOK_PLAN.name} (earlier plan: ${old})` : `${FREBOOK_PLAN.name} (${id})`;
}

/** "₹1,499" — the one way pages show the FreBook price. */
export const FREBOOK_PRICE_LABEL = `₹${FREBOOK_PLAN.price.toLocaleString("en-IN")}`;
