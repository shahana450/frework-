import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { journal_id, business_id, user_id } = await req.json();
    if (!journal_id || !business_id || !user_id) {
      return NextResponse.json({ error: "journal_id, business_id, user_id required" }, { status: 400 });
    }

    // Verify ownership + 5-minute undo window
    const { data: journal } = await supabase
      .from("fw_fin_journals")
      .select("id, confirmed_at, business_id")
      .eq("id", journal_id)
      .eq("business_id", business_id)
      .single();

    if (!journal) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const confirmedAt = new Date(journal.confirmed_at ?? 0).getTime();
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (confirmedAt < fiveMinAgo) {
      return NextResponse.json({ error: "Undo window expired (5 minutes)" }, { status: 400 });
    }

    await supabase.from("fw_fin_journals").update({ status: "voided" }).eq("id", journal_id);
    return NextResponse.json({ undone: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
