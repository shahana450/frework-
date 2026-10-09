import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { reverseJournal, postingErrorMessage } from "@/lib/posting";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Undo = a reversing entry dated today. The original stays in the books with a link to its reversal.
export async function POST(req: NextRequest) {
  try {
    const { journal_id, business_id, reason } = await req.json();
    const gate = await requireBusiness(req, business_id, { action: "reverse" });
    if (gate instanceof NextResponse) return gate;
    if (!journal_id) return NextResponse.json({ error: "journal_id required" }, { status: 400 });
    try {
      const r = await reverseJournal(supabase, business_id, gate.user.id, journal_id, reason || "Undone from FreBook");
      return NextResponse.json({ undone: true, reversal_entry_no: r.entryNo, reversal_id: r.id });
    } catch (e) {
      const p = postingErrorMessage(e);
      return NextResponse.json({ error: p.message }, { status: p.status });
    }
  } catch (e) {
    return serverError("chat-book/undo", e, "We couldn't undo this entry. Please try again.");
  }
}
