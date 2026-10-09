import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

// The Books list, read on the server: access is checked once here, so the database doesn't
// re-run row security for every journal, line and ledger (that timed out on large books).
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGE = 1000;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const businessId = sp.get("business_id");
    const gate = await requireBusiness(req, businessId);
    if (gate instanceof NextResponse) return gate;
    const from = sp.get("from"), to = sp.get("to");
    const iso = /^\d{4}-\d{2}-\d{2}$/;

    // 1) journals, newest first
    const journals: Record<string, unknown>[] = [];
    for (let at = 0; at < 50000; at += PAGE) {
      let q = supabase.from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,status,total_debit,total_credit,reference_no,ai_generated,created_at,reversed_by,reversal_of")
        .eq("business_id", businessId!);
      if (from && iso.test(from)) q = q.gte("date", from);
      if (to && iso.test(to)) q = q.lte("date", to);
      const { data, error } = await q.order("date", { ascending: false }).order("entry_no", { ascending: false }).range(at, at + PAGE - 1);
      if (error) throw error;
      journals.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    // 2) their lines with ledger names, in chunks
    // ?lines=0: the list only (Journals page) — lines are fetched for the rows on screen
    const ids = sp.get("lines") === "0" ? [] : journals.map(j => j.id as string);
    const lines = new Map<string, { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string } | null }[]>();
    // chunks run in parallel — sequential round-trips were the slow part on big books
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 300) chunks.push(ids.slice(i, i + 300));
    for (let i = 0; i < chunks.length; i += 8) {
      const results = await Promise.all(chunks.slice(i, i + 8).map(chunk => supabase.from("fw_fin_journal_lines")
        .select("journal_id,dr_amount,cr_amount,fw_fin_chart_of_accounts(name)").in("journal_id", chunk)));
      for (const { data, error } of results) {
        if (error) throw error;
        for (const l of (data ?? []) as unknown as { journal_id: string; dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string } | null }[]) {
          const list = lines.get(l.journal_id) ?? [];
          list.push({ dr_amount: l.dr_amount, cr_amount: l.cr_amount, fw_fin_chart_of_accounts: l.fw_fin_chart_of_accounts });
          lines.set(l.journal_id, list);
        }
      }
    }

    const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", businessId!);
    return NextResponse.json({
      journals: journals.map(j => ({ ...j, fw_fin_journal_lines: lines.get(j.id as string) ?? [] })),
      total: count ?? journals.length,
    });
  } catch (e) {
    return serverError("finance/books", e, "We couldn't load your entries right now.");
  }
}
