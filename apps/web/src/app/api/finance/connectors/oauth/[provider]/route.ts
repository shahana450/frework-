import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { roleOf } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { seal } from "@/lib/portals/secretBox";
import { finishOAuth, readState, type OAuthProvider } from "@/lib/connectors/oauth";

export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Zoho / QuickBooks send the browser back here after sign-in
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${url.origin}/finance/integrations?${q}`);
  if (provider !== "zoho_books" && provider !== "quickbooks") return back("error=" + encodeURIComponent("Unknown connector."));
  try {
    const st = readState(url.searchParams.get("state") ?? "");
    // The browser returns without the FreWork login header; the signed state names the user, so check their role now
    const { data: au } = await supabase.auth.admin.getUserById(st.u);
    const role = au?.user ? await roleOf({ id: au.user.id, email: au.user.email }, st.b) : null;
    if (!role || !can(role, "integrate")) return back("error=" + encodeURIComponent("Your role can't connect integrations for this business."));
    const { creds, label } = await finishOAuth(provider as OAuthProvider, url.origin, url.searchParams);
    const { error } = await supabase.from("fw_fin_connections").upsert({ business_id: st.b, provider, status: "connected", creds_enc: seal(JSON.stringify(creds), false), account_label: label, last_error: null, created_by: st.u }, { onConflict: "business_id,provider" });
    if (error) return back("error=" + encodeURIComponent("Couldn't save the connection — has 2026-10-13_connectors.sql been run?"));
    await logAudit(supabase, { businessId: st.b, actor: st.u, action: "connector_connect", source: "connectors", detail: { provider, account: label } });
    return back(`connected=${provider}`);
  } catch (e) {
    return back("error=" + encodeURIComponent((e as Error).message.slice(0, 200)));
  }
}
