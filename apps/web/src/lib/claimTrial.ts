// One free FreBook month per account, claimed by the user. Pure logic over a small store so it can be tested without a database.
import { FREBOOK_PLAN } from "./plans";

export const TRIAL_DAYS = 30;

export type SubscriptionRow = { status: string | null; plan: string | null; subscription_ends_at: string | null };

export interface TrialStore {
  /** Any subscription row this user has ever had (paid, trial, expired), or null when there is none. */
  findAny(userId: string): Promise<SubscriptionRow | null>;
  /** Insert the trial row. Returns an error message on failure (a unique violation means a parallel claim won). */
  insertTrial(row: Record<string, unknown>): Promise<{ error: string | null }>;
}

export type ClaimResult =
  | { status: 200; body: { ok: true; ends_at: string } }
  | { status: 409; body: { error: string } };

export const ALREADY_USED = "The free month has already been used on this account.";
export const ALREADY_ACTIVE = "You already have access — no need to claim again.";

export async function claimTrial(store: TrialStore, userId: string, now: Date = new Date()): Promise<ClaimResult> {
  const existing = await store.findAny(userId);
  if (existing) {
    const live = (existing.status === "active" || existing.status === "trial")
      && (!existing.subscription_ends_at || existing.subscription_ends_at > now.toISOString());
    return { status: 409, body: { error: live ? ALREADY_ACTIVE : ALREADY_USED } };
  }
  const ends = new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString();
  const { error } = await store.insertTrial({
    user_id: userId, plan: FREBOOK_PLAN.id, amount: 0, status: "trial", trial_ends_at: ends, subscription_ends_at: ends,
    granted_by_admin: false, payment_id: null, updated_at: now.toISOString(),
  });
  if (error) {
    if (/duplicate|unique/i.test(error)) return { status: 409, body: { error: ALREADY_USED } };
    throw new Error(error);
  }
  return { status: 200, body: { ok: true, ends_at: ends } };
}
