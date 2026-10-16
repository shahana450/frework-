import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

// Bank dashboard: balance, money in/out and recent activity for each bank and cash ledger, from posted entries.
// Today it fills from uploaded bank statements (and anything else posted to bank/cash); a live bank feed plugs in later.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const maxDuration = 60;

type Line = { account_id: string; dr_amount: number | null; cr_amount: number | null; fw_fin_journals: { id: string; date: string; entry_no: string; narration: string | null; source: string | null; created_at: string; status: string } | null };

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;

    const { data: accs, error: ae } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,sub_type,type")
      .eq("business_id", bizId!).eq("is_group", false).in("sub_type", ["bank", "cash"]);
    if (ae) throw ae;
    const accounts = (accs ?? []) as { id: string; name: string; sub_type: string }[];
    if (!accounts.length) return NextResponse.json({ accounts: [], months: [], recent: [], lastStatement: null });

    const lines: Line[] = [];
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await supabase.from("fw_fin_journal_lines")
        .select("account_id,dr_amount,cr_amount,fw_fin_journals!inner(id,date,entry_no,narration,source,created_at,status,business_id)")
        .in("account_id", accounts.map(a => a.id)).eq("fw_fin_journals.business_id", bizId!).eq("fw_fin_journals.status", "posted")
        .range(from, from + 999);
      if (error) throw error;
      lines.push(...((data ?? []) as unknown as Line[]));
      if (!data || data.length < 1000) break;
    }

    const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
    const months: string[] = [];
    { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(1); for (let i = 5; i >= 0; i--) { const m = new Date(d); m.setUTCMonth(d.getUTCMonth() - i); months.push(m.toISOString().slice(0, 7)); } }

    const per = new Map(accounts.map(a => [a.id, { id: a.id, name: a.name, kind: a.sub_type, balance: 0, inMonth: 0, outMonth: 0, count: 0, last: null as string | null, fromStatements: 0 }]));
    const flow = new Map(months.map(m => [m, { month: m, in: 0, out: 0 }]));
    let lastStatement: string | null = null;
    for (const l of lines) {
      const a = per.get(l.account_id), j = l.fw_fin_journals;
      if (!a || !j) continue;
      const dr = Number(l.dr_amount ?? 0), cr = Number(l.cr_amount ?? 0);
      a.balance += dr - cr; a.count++;
      if (!a.last || j.date > a.last) a.last = j.date;
      if (j.source === "statement") { a.fromStatements++; if (!lastStatement || j.created_at > lastStatement) lastStatement = j.created_at; }
      if (j.source === "opening_balances") continue;
      if (j.date.startsWith(month)) { a.inMonth += dr; a.outMonth += cr; }
      const f = flow.get(j.date.slice(0, 7)); if (f) { f.in += dr; f.out += cr; }
    }
    const recent = lines.filter(l => l.fw_fin_journals && l.fw_fin_journals.source !== "opening_balances")
      .sort((x, y) => (y.fw_fin_journals!.date + y.fw_fin_journals!.created_at).localeCompare(x.fw_fin_journals!.date + x.fw_fin_journals!.created_at))
      .slice(0, 10).map(l => ({ id: l.fw_fin_journals!.id, date: l.fw_fin_journals!.date, entry_no: l.fw_fin_journals!.entry_no, narration: l.fw_fin_journals!.narration, account: per.get(l.account_id)?.name ?? "", in: Number(l.dr_amount ?? 0), out: Number(l.cr_amount ?? 0), source: l.fw_fin_journals!.source }));

    const r2 = (n: number) => Math.round(n * 100) / 100;
    return NextResponse.json({
      accounts: [...per.values()].map(a => ({ ...a, balance: r2(a.balance), inMonth: r2(a.inMonth), outMonth: r2(a.outMonth) })).sort((x, y) => (x.kind === y.kind ? Math.abs(y.balance) - Math.abs(x.balance) : x.kind === "bank" ? -1 : 1)),
      months: [...flow.values()].map(f => ({ ...f, in: r2(f.in), out: r2(f.out) })),
      recent, lastStatement,
    });
  } catch (e) {
    return serverError("bank-dashboard", e, "Couldn't load the bank dashboard.");
  }
}
