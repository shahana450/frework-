import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, requireUser, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { deleteConfirmed, PURGE_AFTER_DAYS } from "@/lib/dataExport";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const needsMigration = (m: string) => /deleted_at|column .* does not exist|schema cache/i.test(m);

// POST { business_id, confirm_name } → soft-delete (owner only). The business disappears for everyone at once and is
// erased for good after 30 days by fw_fin_purge_deleted_businesses() (see 2026-10-20_t5_business_delete.sql).
// POST { business_id, action: "restore" } → undo within those 30 days (owner only).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { business_id?: string; confirm_name?: string; action?: "delete" | "restore" };
    const bizId = body.business_id ?? null;

    if (body.action === "restore") {
      // A deleted business is invisible to requireBusiness, so check ownership directly
      const user = await requireUser(req);
      if (user instanceof NextResponse) return user;
      if (!bizId || !/^[0-9a-f-]{36}$/i.test(bizId)) return NextResponse.json({ error: "You don't have access to this business." }, { status: 403 });
      const { data: biz } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId).maybeSingle();
      if (!biz || biz.owner_id !== user.id) return NextResponse.json({ error: "Only the owner can restore this business." }, { status: 403 });
      if (!biz.deleted_at) return NextResponse.json({ ok: true, restored: false, message: "This business isn't deleted." });
      const { error } = await supabase.from("fw_fin_businesses").update({ deleted_at: null, deleted_by: null }).eq("id", bizId);
      if (error) return needsMigration(error.message) ? NextResponse.json({ error: "Deleting businesses isn't switched on yet." }, { status: 503 }) : serverError("business/delete restore", error);
      await logAudit(supabase, { businessId: bizId, actor: user.id, action: "business_restore", source: "settings", detail: {} });
      return NextResponse.json({ ok: true, restored: true });
    }

    const gate = await requireBusiness(req, bizId, { action: "delete_business" });
    if (gate instanceof NextResponse) return gate;
    const { data: biz } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).single();
    if (!deleteConfirmed(body.confirm_name, biz?.name)) {
      return NextResponse.json({ error: `Type the business name exactly as shown ("${biz?.name ?? ""}") to confirm.` }, { status: 400 });
    }
    const now = new Date();
    const { error } = await supabase.from("fw_fin_businesses").update({ deleted_at: now.toISOString(), deleted_by: gate.user.id }).eq("id", bizId!);
    if (error) return needsMigration(error.message) ? NextResponse.json({ error: "Deleting businesses isn't switched on yet." }, { status: 503 }) : serverError("business/delete", error);
    await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "business_delete", source: "settings", detail: { purge_after_days: PURGE_AFTER_DAYS } });
    const purgeOn = new Date(now.getTime() + PURGE_AFTER_DAYS * 86400000);
    return NextResponse.json({ ok: true, deleted_at: now.toISOString(), purge_on: purgeOn.toISOString().slice(0, 10) });
  } catch (e) {
    return serverError("business/delete", e, "We couldn't delete this business. Nothing was changed.");
  }
}
