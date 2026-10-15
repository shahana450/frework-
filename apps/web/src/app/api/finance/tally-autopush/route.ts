import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

// Auto-push queue: posted entries since `since` that have no Tally push record yet (read on the server, like Books)
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
      .order("created_at").limit(50);
    if (error) throw error;
    const rows = (data ?? []).filter(r => r.source !== "tally_import" && r.source !== "opening_balances");
    if (!rows.length) return NextResponse.json({ todo: [] });
    const { data: done } = await supabase.from("fw_fin_integration_sync").select("journal_id")
      .eq("business_id", bizId!).eq("provider", "tally").in("journal_id", rows.map(r => r.id));
    const seen = new Set((done ?? []).map(d => d.journal_id));
    return NextResponse.json({ todo: rows.filter(r => !seen.has(r.id)).map(r => ({ id: r.id, date: r.date, entry_no: r.entry_no })) });
  } catch (e) {
    return serverError("tally-autopush", e, "Couldn't read the entries waiting for Tally.");
  }
}
