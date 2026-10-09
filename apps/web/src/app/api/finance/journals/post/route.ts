import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, validateEntry, voucherTypeFor, postingErrorMessage } from "@/lib/posting";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type LineIn = { account_id?: string | null; account_name?: string | null; dr: number; cr: number; narration?: string };
type Body = {
  business_id: string; mode?: "post" | "draft"; date: string; type: string; narration: string;
  reference_no?: string | null; party_name?: string | null; contact_id?: string | null; source?: string;
  account_heads?: Record<string, string>; lines: LineIn[]; metadata?: Record<string, unknown>;
};

// Every form (sales, purchase, expense, payment, notes, journal, payroll) posts through here.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json() as Body;
    const gate = await requireBusiness(req, b.business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!Array.isArray(b.lines) || !b.lines.length) return NextResponse.json({ error: "Add at least two lines." }, { status: 400 });

    // Lines may name a ledger instead of giving its id; names are resolved (and standard ones created)
    const named = b.lines.filter(l => !l.account_id && l.account_name?.trim());
    let ids = new Map<string, { id: string; name: string }>();
    let created: { name: string; head: string }[] = [];
    if (named.length) {
      const r = await resolveLedgers(supabase, b.business_id, named.map(l => ({ name: l.account_name! })), b.account_heads ?? {}, "a FreWork form");
      if (!r.ok) return NextResponse.json({ needs_heads: r.needHeads, will_create: r.willCreate });
      ids = r.ids; created = r.created;
    }
    const lines = b.lines.map(l => ({
      accountId: l.account_id || ids.get((l.account_name ?? "").trim())?.id || "",
      dr: Number(l.dr) || 0, cr: Number(l.cr) || 0, narration: l.narration,
    }));
    const type = voucherTypeFor(b.type);

    if (b.mode === "draft") {
      // Drafts are not part of the books; they are validated when posted
      const clean = lines.filter(l => l.accountId && (l.dr || l.cr));
      const total = clean.reduce((s, l) => s + l.dr, 0);
      const { data: j, error } = await supabase.from("fw_fin_journals").insert({
        business_id: b.business_id, entry_no: `DRAFT-${Date.now().toString(36).toUpperCase()}`, date: b.date, type,
        narration: b.narration?.slice(0, 500), reference_no: b.reference_no ?? null, status: "draft",
        total_debit: total, total_credit: clean.reduce((s, l) => s + l.cr, 0), created_by: gate.user.id, contact_id: b.contact_id ?? null,
      }).select("id,entry_no").single();
      if (error || !j) return serverError("journals/post draft", error, "We couldn't save the draft. Please try again.");
      if (clean.length) await supabase.from("fw_fin_journal_lines").insert(clean.map((l, i) => ({ journal_id: j.id, account_id: l.accountId, dr_amount: l.dr, cr_amount: l.cr, narration: l.narration ?? null, sort_order: i + 1 })));
      return NextResponse.json({ id: j.id, entry_no: j.entry_no, status: "draft", created_ledgers: created });
    }

    try {
      validateEntry(lines, b.date);
      const r = await postJournal(supabase, {
        businessId: b.business_id, actorId: gate.user.id, date: b.date, type, narration: b.narration || "Journal entry",
        referenceNo: b.reference_no, partyName: b.party_name, contactId: b.contact_id, source: b.source || "manual",
        lines, metadata: b.metadata, checkDuplicate: req.headers.get("x-confirm-duplicate") !== "1",
      });
      return NextResponse.json({ id: r.id, entry_no: r.entryNo, status: "posted", total: r.total, created_ledgers: created });
    } catch (e) {
      const p = postingErrorMessage(e);
      if (p.status === 500) return serverError("journals/post", e, p.message);
      return NextResponse.json({ error: p.message, code: p.code, duplicate: p.duplicate }, { status: p.status });
    }
  } catch (e) {
    return serverError("journals/post", e, "We couldn't save this entry. Please try again.");
  }
}
