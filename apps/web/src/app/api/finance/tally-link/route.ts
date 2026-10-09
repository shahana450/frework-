import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// B5 — remembers which Tally company THIS business pushes to (set when it connects on the Tally page).
// Tally push refuses any other company. Needs 2026-10-17_b5_tally_link.sql.
export async function POST(req: NextRequest) {
  try {
    const { business_id, company } = await req.json().catch(() => ({}));
    const gate = await requireBusiness(req, business_id, { action: "integrate" });
    if (gate instanceof NextResponse) return gate;
    const name = String(company ?? "").trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: "Choose a Tally company." }, { status: 400 });
    const { data: before } = await supabase.from("fw_fin_businesses").select("tally_company").eq("id", business_id).maybeSingle();
    const { error } = await supabase.from("fw_fin_businesses").update({ tally_company: name }).eq("id", business_id);
    if (error) return /tally_company/.test(error.message) ? NextResponse.json({ error: "Run 2026-10-17_b5_tally_link.sql to link Tally per business." }, { status: 503 }) : serverError("tally-link", error);
    const prev = (before as { tally_company?: string | null } | null)?.tally_company ?? null;
    if (prev !== name) await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "tally_link", source: "integration", detail: { from: prev, to: name } });
    return NextResponse.json({ ok: true, company: name });
  } catch (e) {
    return serverError("tally-link", e);
  }
}
