import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { reverseJournal, postingErrorMessage } from "@/lib/posting";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Correct a posted entry by reversing it. Owner, admin and accountant only.
export async function POST(req: NextRequest) {
  try {
    const { business_id, journal_id, reason, date } = await req.json();
    const gate = await requireBusiness(req, business_id, { action: "reverse" });
    if (gate instanceof NextResponse) return gate;
    if (!journal_id || !reason?.trim()) return NextResponse.json({ error: "Choose an entry and give a reason." }, { status: 400 });
    try {
      const r = await reverseJournal(supabase, business_id, gate.user.id, journal_id, reason, date);
      return NextResponse.json({ ok: true, reversal_entry_no: r.entryNo, reversal_id: r.id });
    } catch (e) {
      const p = postingErrorMessage(e);
      if (p.status === 500) return serverError("journals/reverse", e, "We couldn't reverse this entry. Nothing was changed.");
      return NextResponse.json({ error: p.message }, { status: p.status });
    }
  } catch (e) {
    return serverError("journals/reverse", e, "We couldn't reverse this entry. Please try again.");
  }
}
