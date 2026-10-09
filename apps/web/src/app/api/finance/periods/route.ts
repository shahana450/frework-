import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Lock or unlock a financial year. Locked years accept no new postings from any path.
export async function POST(req: NextRequest) {
  try {
    const { business_id, fy_id, locked, reason } = await req.json() as { business_id: string; fy_id: string; locked: boolean; reason?: string };
    const gate = await requireBusiness(req, business_id, { action: "lock" });
    if (gate instanceof NextResponse) return gate;
    if (!fy_id) return NextResponse.json({ error: "Choose a financial year." }, { status: 400 });
    if (!locked && !reason?.trim()) return NextResponse.json({ error: "Give a reason for unlocking a year — it's kept in the audit log." }, { status: 400 });

    const { data: fy } = await supabase.from("fw_fin_financial_years").select("id,label,is_locked").eq("id", fy_id).eq("business_id", business_id).maybeSingle();
    if (!fy) return NextResponse.json({ error: "Financial year not found." }, { status: 404 });

    const full = { is_locked: !!locked, is_closed: !!locked, locked_at: locked ? new Date().toISOString() : null, locked_by: locked ? gate.user.id : null };
    let { error } = await supabase.from("fw_fin_financial_years").update(full).eq("id", fy_id);
    if (error && /is_closed|locked_at|locked_by/.test(error.message)) ({ error } = await supabase.from("fw_fin_financial_years").update({ is_locked: !!locked }).eq("id", fy_id));
    if (error) return serverError("periods", error, "We couldn't change the lock. Please try again.");

    await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: locked ? "lock_year" : "unlock_year", source: "settings", reason: reason ?? null, detail: { fy: fy.label } });
    return NextResponse.json({ ok: true, fy_id, locked: !!locked });
  } catch (e) {
    return serverError("periods", e, "We couldn't change the lock. Please try again.");
  }
}
