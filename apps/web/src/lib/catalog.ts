// One place for product names and prices (B8). Pages should read from here instead of hard-coding them.
// Software (FreBook subscription) and professional services are shown SEPARATELY; services reserved to Chartered
// Accountants (statutory / tax / internal audit) are never bundled into software tiers.
import { PLAN_PRICES } from "./plans";
import { SERVICE_PAISE } from "./phonepeOrder";

export const PRODUCT = {
  company: "FreWork",
  app: "FreBook",               // the accounting app (chat bookkeeping)
  virtualCa: "FrePilot",        // the AI/virtual-CA assistant
} as const;

/** FreBook software plans, ₹ per month — the single source for every pricing surface. */
export const FREBOOK_PLANS = PLAN_PRICES;

/** One-off professional services, ₹ — the same list the payment server charges. */
export const SERVICE_PRICES: Record<string, number> = Object.fromEntries(Object.entries(SERVICE_PAISE).map(([k, p]) => [k, p / 100]));

/** Shown instead of a price for work that must be quoted (incl. anything reserved to Chartered Accountants). */
export const QUOTED_SEPARATELY = "Quoted separately";
