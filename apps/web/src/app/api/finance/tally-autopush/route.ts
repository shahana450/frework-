import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

// Auto-push queue: posted entries since `since` not yet sent to Tally successfully (failed pushes are retried).
// All entries since then are read first and only then are the sent ones removed, so the queue never stalls
// behind entries that were already pushed.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const since = sp.get("since") ?? new Date(Date.now() - 86400000).toISOString();
    const before = new Date(Date.now() - 30000).toISOString();
    const { data, error } = await supabase.from("fw_fin_journals").select("id,date,entry_no,source")
      .eq("business_id", bizId!).eq("status", "posted").gte("created_at", since).lte("created_at", before)
      .order("created_at").limit(2000);
    if (error) throw error;
    const rows = (data ?? []).filter(r => r.source !== "tally_import" && r.source !== "opening_balances");
    if (!rows.length) return NextResponse.json({ todo: [] });
    const sent = new Set<string>();
    for (let i = 0; i < rows.length; i += 300) {
      const { data: done } = await supabase.from("fw_fin_integration_sync").select("journal_id,status")
        .eq("business_id", bizId!).eq("provider", "tally").in("journal_id", rows.slice(i, i + 300).map(r => r.id));
      for (const d of done ?? []) if (d.status !== "failed") sent.add(d.journal_id);
    }
    const todo = rows.filter(r => !sent.has(r.id));
    return NextResponse.json({ todo: todo.slice(0, 50).map(r => ({ id: r.id, date: r.date, entry_no: r.entry_no })), waiting: todo.length });
  } catch (e) {
    return serverError("tally-autopush", e, "Couldn't read the entries waiting for Tally.");
  }
}
