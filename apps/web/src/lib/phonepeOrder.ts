// PhonePe subscription orders are bound to (transaction, user, plan, billing, amount) with an HMAC, so the redirect
// back can't be edited to another plan or another user, and the paid amount must match. Server-only.
import crypto from "crypto";

export const PLAN_PAISE: Record<string, number> = { professional: 99900, growth: 299900, business: 499900, enterprise: 999900 };
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

/** Checks the signed redirect and PhonePe's confirmed amount. Returns the reason when it must be refused. */
export function verifyOrder(c: OrderClaim, sig: string, paidPaise: number | null | undefined, key = secret()): { ok: true } | { ok: false; reason: string } {
  const want = Buffer.from(signOrder(c, key)), got = Buffer.from(sig || "");
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return { ok: false, reason: "tampered" };
  if (PLAN_PAISE[c.plan] !== c.amount) return { ok: false, reason: "unknown_plan" };
  if (Number(paidPaise) !== c.amount) return { ok: false, reason: "amount_mismatch" };
  return { ok: true };
}
