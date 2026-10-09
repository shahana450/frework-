import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { postJournal, reverseJournal, validateEntry, voucherTypeFor, postingErrorMessage, PostingError } from "@/lib/posting";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Body = { business_id: string; journal_id: string; reason: string; date: string; type: string; narration: string; reference_no?: string | null; lines: { account_id: string; dr: number; cr: number; narration?: string }[] };

// Corrects a posted entry without rewriting history, as one step:
// post the corrected entry, then reverse the original. If the reversal fails the corrected entry is voided,
// so the books are never left with both — or with neither.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json() as Body;
    const gate = await requireBusiness(req, b.business_id, { action: "reverse" });
    if (gate instanceof NextResponse) return gate;
    if (!b.journal_id || !b.reason?.trim()) return NextResponse.json({ error: "Give a reason for the correction." }, { status: 400 });

    const { data: orig } = await supabase.from("fw_fin_journals").select("id,entry_no,status,reversed_by").eq("id", b.journal_id).eq("business_id", b.business_id).maybeSingle();
    if (!orig) return NextResponse.json({ error: "That entry no longer exists." }, { status: 404 });
    if (orig.status !== "posted") return NextResponse.json({ error: "Only posted entries are corrected this way." }, { status: 400 });
    if (orig.reversed_by) return NextResponse.json({ error: `${orig.entry_no} was already reversed — open the corrected entry instead.` }, { status: 409 });

    const lines = (b.lines ?? []).map(l => ({ accountId: l.account_id, dr: Number(l.dr) || 0, cr: Number(l.cr) || 0, narration: l.narration }));
    let fixed;
    try {
      validateEntry(lines, b.date);
      fixed = await postJournal(supabase, {
        businessId: b.business_id, actorId: gate.user.id, date: b.date, type: voucherTypeFor(b.type), narration: b.narration || `Correction of ${orig.entry_no}`,
        referenceNo: b.reference_no || orig.entry_no, source: "correction", lines,
        metadata: { corrects: orig.entry_no, corrects_id: orig.id, reason: b.reason.trim() },
      });
    } catch (e) {
      const p = postingErrorMessage(e);
      console.error(JSON.stringify({ route: "journals/correct", step: "post", entry: orig.entry_no, error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json({ error: `The corrected entry couldn't be posted: ${e instanceof PostingError && e.code === "FAILED" ? (e as Error).message : p.message}. Nothing was changed.` }, { status: p.status === 500 ? 422 : p.status });
    }

    try {
      const rev = await reverseJournal(supabase, b.business_id, gate.user.id, orig.id, `Corrected by ${fixed.entryNo} — ${b.reason.trim()}`);
      await logAudit(supabase, { businessId: b.business_id, actor: gate.user.id, action: "correct", source: "correction", detail: { original: orig.entry_no, reversal: rev.entryNo, corrected: fixed.entryNo, reason: b.reason.trim() } });
      return NextResponse.json({ ok: true, corrected_entry_no: fixed.entryNo, corrected_id: fixed.id, reversal_entry_no: rev.entryNo });
    } catch (e) {
      // Undo the new entry (allowed within minutes of posting) so nothing is half-done
      await supabase.from("fw_fin_journals").update({ status: "voided" }).eq("id", fixed.id);
      console.error(JSON.stringify({ route: "journals/correct", step: "reverse", entry: orig.entry_no, error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json({ error: `${orig.entry_no} couldn't be reversed: ${e instanceof Error ? e.message.replace(/^FW_\w+:\s*/, "") : "database error"}. Nothing was changed.` }, { status: 422 });
    }
  } catch (e) {
    return serverError("journals/correct", e, "We couldn't correct this entry. Nothing was changed.");
  }
}
