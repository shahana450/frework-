// PhonePe subscription orders are bound to (transaction, user, plan, billing, amount) with an HMAC, so the redirect
// back can't be edited to another plan or another user, and the paid amount must match. Server-only.
import crypto from "crypto";
import { FREBOOK_PLAN } from "./plans";

// One plan, monthly only. Old ids (professional, growth, ...) are no longer sold.
export const PLAN_PAISE: Record<string, number> = { [FREBOOK_PLAN.id]: FREBOOK_PLAN.price * 100 };
export type OrderClaim = { txnId: string; userId: string; plan: string; billing: string; amount: number };

const secret = () => {
  const s = process.env.PHONEPE_ORDER_SECRET || process.env.PHONEPE_SALT_KEY;
  if (!s) throw new Error("PHONEPE_ORDER_SECRET (or PHONEPE_SALT_KEY) is not set");
  return s;
};
const payload = (c: OrderClaim) => [c.txnId, c.userId, c.plan, c.billing, c.amount].join("|");

export function signOrder(c: OrderClaim, key = secret()): string {
  return crypto.createHmac("sha256", key).update(payload(c)).digest("base64url");
}

// One-off service orders: price ONLY from this list (the browser never sets the amount)
export const SERVICE_PAISE: Record<string, number> = {
  "gst-registration": 99900, "income-tax": 79900, "accounting": 149900, "company-reg": 99900, "gst-audit": 499900, "roc-compliance": 199900,
};
/** HMAC over any ordered list of fields (used for service orders and their customer details). */
export function signFields(fields: (string | number)[], key = secret()): string {
  return crypto.createHmac("sha256", key).update(fields.map(String).join("|")).digest("base64url");
}
export function verifyFields(fields: (string | number)[], sig: string, key = secret()): boolean {
  const want = Buffer.from(signFields(fields, key)), got = Buffer.from(sig || "");
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Checks the signed redirect and PhonePe's confirmed amount. Returns the reason when it must be refused. */
export function verifyOrder(c: OrderClaim, sig: string, paidPaise: number | null | undefined, key = secret()): { ok: true } | { ok: false; reason: string } {
  const want = Buffer.from(signOrder(c, key)), got = Buffer.from(sig || "");
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return { ok: false, reason: "tampered" };
  if (PLAN_PAISE[c.plan] !== c.amount) return { ok: false, reason: "unknown_plan" };
  if (Number(paidPaise) !== c.amount) return { ok: false, reason: "amount_mismatch" };
  return { ok: true };
}
