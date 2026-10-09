// FreWork AI access grants — shared by the admin route and the first-sign-in claim.
import type { SupabaseClient } from "@supabase/supabase-js";

export type GrantAction = "grant_trial" | "activate";

/** Writes the subscription row for a user who exists. */
export async function applyGrant(sb: SupabaseClient, userId: string, action: GrantAction, plan: string, days: number) {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + days);
  const row: Record<string, unknown> = action === "grant_trial"
    ? { user_id: userId, plan, amount: 0, status: "trial", trial_ends_at: endsAt.toISOString(), subscription_ends_at: endsAt.toISOString(), granted_by_admin: true, payment_id: null, updated_at: new Date().toISOString() }
    : { user_id: userId, plan, amount: 0, status: "active", subscription_ends_at: endsAt.toISOString(), granted_by_admin: true, payment_id: "admin_grant", updated_at: new Date().toISOString() };
  const { error } = await sb.from("fw_fin_subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return endsAt.toISOString();
}

/** Finds an existing account by email (case-insensitive), paging through all users. */
export async function findUserIdByEmail(sb: SupabaseClient, email: string): Promise<string | null> {
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find(u => (u.email ?? "").toLowerCase() === want);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}
