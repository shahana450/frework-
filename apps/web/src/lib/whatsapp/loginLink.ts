// Sign-in through WhatsApp. A number linked to FreWork (proved earlier by the LINK code) can ask for a
// one-time sign-in: Supabase issues a single-use magic-link token for that user, and /auth/wa exchanges it
// for a session in the browser. No passwords, and nothing long-lived is sent.
import type { SupabaseClient } from "@supabase/supabase-js";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://frework.online").replace(/\/$/, "");

/** Single-use token for this FreWork user, or null if the account has no email to sign in with. */
export async function loginToken(sb: SupabaseClient, userId: string): Promise<string | null> {
  const { data: u } = await sb.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return null;
  const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (error) { console.error("whatsapp login link", error.message); return null; }
  return data?.properties?.hashed_token ?? null;
}

/** Sign-in link; `next` opens a FreWork page straight after (e.g. an invoice), in business `biz`. */
export const loginUrl = (token: string, next?: string, biz?: string) =>
  `${SITE}/auth/wa?t=${encodeURIComponent(token)}${next ? `&next=${encodeURIComponent(next)}` : ""}${biz ? `&biz=${encodeURIComponent(biz)}` : ""}`;

/** The FreWork user behind a verified WhatsApp number — only when exactly one user has linked it. */
export async function userForPhone(sb: SupabaseClient, phone: string): Promise<{ userId: string; businessId: string } | "none" | "many"> {
  const { data } = await sb.from("fw_fin_wa_links").select("user_id,business_id").eq("phone", phone).eq("verified", true);
  const rows = (data ?? []) as { user_id: string; business_id: string }[];
  const users = [...new Set(rows.map(r => r.user_id))];
  if (!users.length) return "none";
  if (users.length > 1) return "many";
  return { userId: users[0], businessId: rows[0].business_id };
}
