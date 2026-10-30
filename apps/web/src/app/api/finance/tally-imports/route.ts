import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Tally-imported copies (entry_no TLY-…) can be removed and re-imported because Tally stays their source.
// This is the ONLY way the app deletes them (B6: the browser has no delete rights on journals).
//   action "clear"    — every TLY- entry of the business (before a fresh re-import)
//   action "orphans"  — TLY- entries that have no lines (broken earlier imports)
//   action "dedupe"   — repeated TLY- numbers: keep the oldest, remove the rest
export async function POST(req: NextRequest) {
  try {
    const { business_id, action } = await req.json().catch(() => ({}));
    const gate = await requireBusiness(req, business_id, { action: "integrate" });
    if (gate instanceof NextResponse) return gate;
    if (!["clear", "orphans", "dedupe"].includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const all: { id: string; entry_no: string; created_at: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("fw_fin_journals").select("id,entry_no,created_at").eq("business_id", business_id).like("entry_no", "TLY-%").order("created_at").range(from, from + 999);
      if (error) return serverError("tally-imports", error);
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    let ids: string[] = [];
    if (action === "clear") ids = all.map(j => j.id);
    if (action === "dedupe") {
      const seen = new Set<string>();
      for (const j of all) { if (seen.has(j.entry_no)) ids.push(j.id); else seen.add(j.entry_no); }
    }
    if (action === "orphans") {
      for (let i = 0; i < all.length; i += 200) {
        const chunk = all.slice(i, i + 200).map(j => j.id);
        const { data: withLines } = await supabase.from("fw_fin_journal_lines").select("journal_id").in("journal_id", chunk);
        const has = new Set((withLines ?? []).map(l => l.journal_id));
        ids.push(...chunk.filter(id => !has.has(id)));
      }
    }
    // Other entries can point at these (a receipt settling an invoice, a reversal pair). Unlink them first — otherwise
    // the entry delete is refused after its lines are already gone, leaving empty entries behind.
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      for (const col of ["against_invoice_id", "reversal_of", "reversed_by"]) {
        const u = await supabase.from("fw_fin_journals").update({ [col]: null }).eq("business_id", business_id).in(col, batch);
        if (u.error && !/column .* does not exist|schema cache/i.test(u.error.message)) return serverError("tally-imports", u.error);
      }
    }
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const a = await supabase.from("fw_fin_journal_lines").delete().in("journal_id", batch);
      if (a.error) return serverError("tally-imports", a.error);
      const b = await supabase.from("fw_fin_journals").delete().in("id", batch).like("entry_no", "TLY-%");
      if (b.error) return serverError("tally-imports", b.error);
    }
    if (ids.length) await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: `tally_imports_${action}`, source: "integration", detail: { removed: ids.length } });
    return NextResponse.json({ ok: true, removed: ids.length });
  } catch (e) {
    return serverError("tally-imports", e);
  }
}
