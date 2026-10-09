// Seed scripts write test data, so they run ONLY against local Supabase or the staging project you name.
// They refuse to start otherwise — there is no flag to point them at production.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function seedClient(): { sb: SupabaseClient; target: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const staging = (process.env.FW_STAGING_SUPABASE_REF ?? "").trim();   // e.g. abcdefghijklmnop (staging project ref)
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for local or STAGING (never production).");
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const isStaging = !!staging && host === `${staging}.supabase.co`;
  if (!local && !isStaging) {
    throw new Error(`Refusing to seed ${host}: only localhost or the staging project in FW_STAGING_SUPABASE_REF (${staging || "not set"}) are allowed.`);
  }
  return { sb: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), target: local ? "local" : `staging (${host})` };
}

export const MINIMAL_COA: { code: string; name: string; type: string; sub_type: string }[] = [
  { code: "1001", name: "Cash", type: "asset", sub_type: "cash" },
  { code: "1002", name: "Bank Account", type: "asset", sub_type: "bank" },
  { code: "1101", name: "Trade Receivables", type: "asset", sub_type: "trade_receivables" },
  { code: "2001", name: "Trade Payables", type: "liability", sub_type: "trade_payables" },
  { code: "2101", name: "Output GST", type: "liability", sub_type: "current_liability" },
  { code: "3001", name: "Capital", type: "equity", sub_type: "capital" },
  { code: "4001", name: "Sales", type: "income", sub_type: "revenue" },
  { code: "5001", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { code: "6001", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { code: "6002", name: "Bank Charges", type: "expense", sub_type: "indirect_expense" },
];

/** A user with a FreBook subscription and one business with a financial year and a small chart of accounts. */
export async function ensureUserWithBusiness(sb: SupabaseClient, email: string, password: string, business: string) {
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`create user ${email}: ${error?.message}`);
    user = data.user;
  }
  const year = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  await sb.from("fw_fin_subscriptions").upsert({ user_id: user.id, plan: "frebook", amount: 0, status: "active", subscription_ends_at: new Date(Date.now() + 365 * 86400000).toISOString(), granted_by_admin: true, payment_id: "seed" }, { onConflict: "user_id" });
  let { data: biz } = await sb.from("fw_fin_businesses").select("id").eq("owner_id", user.id).eq("name", business).maybeSingle();
  if (!biz) {
    const r = await sb.from("fw_fin_businesses").insert({ owner_id: user.id, name: business, state: "Kerala", currency: "INR", fiscal_year_start: "04-01", is_active: true }).select("id").single();
    if (r.error) throw new Error(`create business: ${r.error.message}`);
    biz = r.data;
    await sb.from("fw_fin_financial_years").insert({ business_id: biz!.id, label: `${year}-${String(year + 1).slice(2)}`, start_date: `${year}-04-01`, end_date: `${year + 1}-03-31`, is_current: true, is_locked: false });
    await sb.from("fw_fin_chart_of_accounts").insert(MINIMAL_COA.map(a => ({ ...a, business_id: biz!.id })));
  }
  return { userId: user.id, businessId: biz!.id as string, fyStartYear: year };
}
