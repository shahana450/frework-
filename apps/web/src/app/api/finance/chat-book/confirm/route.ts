import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Line = { account: string; debit: number; credit: number };

export async function POST(req: NextRequest) {
  try {
    const { business_id, user_id, parsed, session_id } = await req.json();
    if (!business_id || !user_id || !parsed) {
      return NextResponse.json({ error: "business_id, user_id, parsed required" }, { status: 400 });
    }

    // Verify user owns this business
    const { data: biz } = await supabase
      .from("fw_fin_businesses")
      .select("id")
      .eq("id", business_id)
      .eq("owner_id", user_id)
      .single();
    if (!biz) return NextResponse.json({ error: "Unauthorised" }, { status: 403 });

    // Resolve accounts — fuzzy match by name (case-insensitive)
    const { data: accounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("id, name, type")
      .eq("business_id", business_id)
      .eq("is_group", false);
    const accMap = new Map((accounts ?? []).map(a => [a.name.toLowerCase(), a]));

    // Auto-create missing accounts
    const missing = parsed.lines
      .map((l: Line) => l.account)
      .filter((n: string) => !accMap.has(n.toLowerCase()));
    const uniqueMissing = [...new Set<string>(missing)];
    if (uniqueMissing.length) {
      const typeGuess = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes("cash") || n.includes("bank") || n.includes("debtor") || n.includes("receivable")) return "asset";
        if (n.includes("creditor") || n.includes("payable") || n.includes("gst")) return "liability";
        if (n.includes("capital") || n.includes("drawing")) return "equity";
        if (n.includes("sales") || n.includes("income") || n.includes("revenue")) return "income";
        return "expense";
      };
      const newRows = uniqueMissing.map((name, i) => ({
        business_id,
        code: `CH${String((accounts?.length ?? 0) + i + 1).padStart(3, "0")}`,
        name,
        type: typeGuess(name),
        is_system: false,
        is_group: false,
        sort_order: (accounts?.length ?? 0) + i + 1,
      }));
      const { data: created } = await supabase.from("fw_fin_chart_of_accounts").insert(newRows).select("id,name,type");
      for (const a of created ?? []) accMap.set(a.name.toLowerCase(), a);
    }

    // Get active FY
    const { data: fy } = await supabase
      .from("fw_fin_financial_years")
      .select("id")
      .eq("business_id", business_id)
      .order("start_date", { ascending: false })
      .limit(1)
      .single();

    // Generate entry_no
    const { count } = await supabase
      .from("fw_fin_journals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business_id)
      .like("entry_no", "CHAT-%");
    const entryNo = `CHAT-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const totalDr = parsed.lines.reduce((s: number, l: Line) => s + (l.debit ?? 0), 0);
    const totalCr = parsed.lines.reduce((s: number, l: Line) => s + (l.credit ?? 0), 0);

    // Insert journal header
    const { data: journal, error: jErr } = await supabase
      .from("fw_fin_journals")
      .insert({
        business_id,
        financial_year_id: fy?.id ?? null,
        entry_no: entryNo,
        date: parsed.date,
        narration: parsed.narration,
        type: parsed.type ?? "journal",
        status: "posted",
        total_debit: totalDr,
        total_credit: totalCr,
        reference_no: parsed.reference ?? null,
        source: "chat",
        confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jErr || !journal) return NextResponse.json({ error: jErr?.message ?? "Journal insert failed" }, { status: 500 });

    // Insert lines
    const lines = (parsed.lines as Line[])
      .map(l => {
        const acc = accMap.get(l.account.toLowerCase());
        if (!acc) return null;
        return { journal_id: journal.id, account_id: acc.id, description: l.account, dr_amount: l.debit ?? 0, cr_amount: l.credit ?? 0 };
      })
      .filter(Boolean);
    if (lines.length) {
      await supabase.from("fw_fin_journal_lines").insert(lines as object[]);
    }

    // Log to chat session for undo support
    if (session_id) {
      await supabase.from("fw_fin_chat_sessions").update({
        last_journal_id: journal.id,
        last_journal_at: new Date().toISOString(),
      }).eq("id", session_id);
    }

    return NextResponse.json({ journal_id: journal.id, entry_no: entryNo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
