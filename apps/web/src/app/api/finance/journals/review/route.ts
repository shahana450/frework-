import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { postJournal, postingErrorMessage, type PostingRequest } from "@/lib/posting";

// Entries held for review (drafts with metadata.needs_review): list them, post one anyway, or discard it.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Draft = {
  id: string; date: string; type: string; narration: string | null; reference_no: string | null; party_name: string | null;
  contact_id: string | null; source: string | null; total_debit: number; metadata: Record<string, unknown> | null; created_at: string;
  fw_fin_journal_lines: { account_id: string; dr_amount: number; cr_amount: number; narration: string | null; sort_order: number | null; fw_fin_chart_of_accounts: { name: string } | null }[];
};
const COLS = "id,date,type,narration,reference_no,party_name,contact_id,source,total_debit,metadata,created_at,fw_fin_journal_lines(account_id,dr_amount,cr_amount,narration,sort_order,fw_fin_chart_of_accounts(name))";

async function load(bizId: string, id?: string) {
  let q = supabase.from("fw_fin_journals").select(COLS).eq("business_id", bizId).eq("status", "draft").not("metadata->needs_review", "is", null).order("date");
  if (id) q = q.eq("id", id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Draft[];
}

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get("business_id") ?? "";
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const rows = await load(bizId);
    return NextResponse.json({
      entries: rows.map(d => ({
        id: d.id, date: d.date, type: d.type, narration: d.narration, party_name: d.party_name, amount: Number(d.total_debit) || 0,
        reasons: (d.metadata?.needs_review as string[] | undefined) ?? [],
        lines: [...d.fw_fin_journal_lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(l => ({ account: l.fw_fin_chart_of_accounts?.name ?? "?", dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })),
      })),
    });
  } catch (e) {
    return serverError("journals/review", e, "Couldn't load the entries waiting for review.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json() as { business_id: string; id: string; action: "post" | "discard" };
    const gate = await requireBusiness(req, b.business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    const [d] = await load(b.business_id, b.id);
    if (!d) return NextResponse.json({ error: "This entry is no longer waiting for review." }, { status: 404 });

    if (b.action === "post") {
      const { needs_review: _r, ...metadata } = d.metadata ?? {};
      const request: PostingRequest = {
        businessId: b.business_id, actorId: gate.user.id, date: d.date, type: d.type as PostingRequest["type"], narration: d.narration || "Journal entry",
        referenceNo: d.reference_no, partyName: d.party_name, contactId: d.contact_id, source: d.source || "manual",
        lines: d.fw_fin_journal_lines.map(l => ({ accountId: l.account_id, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, narration: l.narration ?? undefined })),
        metadata: { ...metadata, reviewed_by: gate.user.id, reviewed_from_draft: d.id }, reviewed: true,
      };
      try {
        const r = await postJournal(supabase, request);
        // The posted entry replaces the draft; drafts were never part of the books
        await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", d.id);
        await supabase.from("fw_fin_journals").delete().eq("id", d.id).eq("business_id", b.business_id).eq("status", "draft");
        return NextResponse.json({ ok: true, entry_no: r.entryNo, id: r.id });
      } catch (e) {
        const p = postingErrorMessage(e);
        if (p.status === 500) return serverError("journals/review post", e, p.message);
        return NextResponse.json({ error: p.message, code: p.code }, { status: p.status });
      }
    }

    await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", d.id);
    const { error } = await supabase.from("fw_fin_journals").delete().eq("id", d.id).eq("business_id", b.business_id).eq("status", "draft");
    if (error) return serverError("journals/review discard", error, "Couldn't discard this draft.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("journals/review", e, "Something went wrong. Please try again.");
  }
}
