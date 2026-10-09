import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Who did what, when. Read-only; nothing in the app can edit or delete audit rows.
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId, { action: "view_audit" });
    if (gate instanceof NextResponse) return gate;

    const before = sp.get("before");
    const action = sp.get("action");
    let q = supabase.from("fw_fin_audit_log").select("id,at,actor,action,source,reason,detail,journal_id,fw_fin_journals(entry_no,narration)")
      .eq("business_id", bizId!).order("at", { ascending: false }).limit(100);
    if (before) q = q.lt("at", before);
    if (action) q = q.eq("action", action);
    const { data, error } = await q;
    if (error) {
      if (/fw_fin_audit_log|does not exist|schema cache/i.test(error.message)) return NextResponse.json({ rows: [], setup_needed: true });
      return serverError("audit-log", error, "We couldn't load the audit log right now.");
    }

    // Show people by email, never raw ids
    const ids = [...new Set((data ?? []).map(r => r.actor).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    await Promise.all(ids.map(async id => {
      const { data: u } = await supabase.auth.admin.getUserById(id);
      if (u?.user) names.set(id, u.user.email ?? id.slice(0, 8));
    }));
    return NextResponse.json({ rows: (data ?? []).map(r => ({ ...r, actor_name: r.actor ? names.get(r.actor) ?? "Unknown user" : "System" })) });
  } catch (e) {
    return serverError("audit-log", e, "We couldn't load the audit log right now.");
  }
}
