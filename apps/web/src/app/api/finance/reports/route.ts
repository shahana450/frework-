import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { buildTrialBalance, buildPL, buildBS, loadBookLines, GROUP_LABEL, type TBRow } from "@/lib/books";
import { loadQueryBooks } from "@/lib/intentEngine";
import { computeCashFlow } from "@/lib/cashFlow";
import { presentBalanceSheet, presentPL } from "@/lib/statements";
import { scheduleIII, scheduleIIIPL } from "@/lib/schedule3";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same engine as the Audit page: ledger balances → Trial Balance → P&L / Balance Sheet
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bizId = searchParams.get("business_id");
  const fyId = searchParams.get("fy_id");
  const report = searchParams.get("report") ?? "trial_balance";

  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;

  let start = "0000-01-01", end = "9999-12-31";
  // An explicit date range wins (used when the year isn't set up in Financial Years)
  const fromQ = searchParams.get("from"), toQ = searchParams.get("to");
  const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
  const explicit = isDate(fromQ) && isDate(toQ) && fromQ! <= toQ!;
  const fyQuery = explicit ? Promise.resolve({ data: { start_date: fromQ!, end_date: toQ! } }) : fyId
    ? supabase.from("fw_fin_financial_years").select("start_date,end_date").eq("id", fyId).eq("business_id", bizId!).maybeSingle()
    : supabase.from("fw_fin_financial_years").select("start_date,end_date").eq("business_id", bizId).eq("is_current", true).maybeSingle();
  const { data: fy } = await fyQuery;
  if (fy) { start = fy.start_date; end = fy.end_date ?? end; }

  if (report === "cash_flow") {
    const books = await loadQueryBooks(supabase, bizId!, end);
    if (books.error) { console.error("cash flow load failed", bizId, books.error); return NextResponse.json({ error: "We couldn't load your cash flow right now. Please try again." }, { status: 500 }); }
    return NextResponse.json({ report: "cash_flow", ...computeCashFlow(books.accounts, books.journals, start, end) });
  }

  const [{ lines, accounts, error }, { data: codes }] = await Promise.all([
    loadBookLines(supabase, bizId!, end),
    supabase.from("fw_fin_chart_of_accounts").select("id,code").eq("business_id", bizId!),
  ]);
  if (error) { console.error("reports load failed", bizId, error); return NextResponse.json({ error: "We couldn't load your reports right now. Please try again." }, { status: 500 }); }

  const tb = buildTrialBalance(accounts, lines, start, end);
  // Account codes for the Trial Balance "Code" column
  const codeOf = new Map(((codes ?? []) as { id: string; code: string | null }[]).map(a => [a.id, a.code ?? ""]));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const row = (r: TBRow) => ({ id: r.id, code: codeOf.get(r.id) ?? "", name: r.name, type: GROUP_LABEL[r.group], sub_type: r.group, dr: r.dr, cr: r.cr,
    opening: r2(r.balance - r.periodDr + r.periodCr), period_dr: r2(r.periodDr), period_cr: r2(r.periodCr) });

  const tbJson = () => ({
      report: "trial_balance",
      // Accounts with nothing on either side are left out (no "Bank Charges — —" rows)
      accounts: tb.filter(r => Math.abs(r.dr) >= 0.005 || Math.abs(r.cr) >= 0.005).map(row),
      total_dr: tb.reduce((s, r) => s + r.dr, 0),
      total_cr: tb.reduce((s, r) => s + r.cr, 0),
  });
  if (report === "trial_balance") return NextResponse.json({ from: start, to: end, ...tbJson() });

  const pl = buildPL(tb);
  const plJson = () => ({
      report: "profit_loss",
      direct_income: pl.sales.map(row),
      indirect_income: pl.indirectIncome.map(row),
      direct_expense: pl.purchases.map(row),
      indirect_expense: pl.indirectExpenses.map(row),
      gross_profit: pl.grossProfit,
      total_income: pl.revenue + pl.otherIncome,
      total_expense: pl.cogs + pl.expenses,
      net_profit: pl.netProfit,
      presented: presentPL(pl),
      schedule3: scheduleIIIPL(presentPL(pl)),
  });
  if (report === "profit_loss") return NextResponse.json(plJson());

  const bsJson = () => {
    const bs = buildBS(tb, pl.netProfit);
    const subOf = new Map(accounts.map(a => [a.id, a.sub_type ?? null]));
    const presented = presentBalanceSheet(bs, tb.map(r => ({ ...r, sub_type: subOf.get(r.id) ?? null })));
    return {
      report: "balance_sheet",
      current_assets: bs.currentAssets.map(row),
      fixed_assets: bs.fixedAssets.map(row),
      current_liabilities: [...bs.currentLiabilities, ...bs.duties].map(row),
      long_term_liabilities: bs.loans.map(row),
      equity: bs.capital.map(row),
      net_profit: pl.netProfit,
      total_assets: bs.totalAssets,
      total_liabilities_equity: bs.totalLiabEq,
      // Signed, reclassified (overdrafts → liabilities) and footed — what the page and exports show
      presented,
      schedule3: scheduleIII(presented, new Map(tb.map(r => [r.id, { group: r.group, sub_type: subOf.get(r.id) ?? null }]))),
    };
  };
  if (report === "balance_sheet") return NextResponse.json(bsJson());
  // All three from one load — the Reports page switches tabs without reloading
  if (report === "all") return NextResponse.json({ trial_balance: tbJson(), profit_loss: plJson(), balance_sheet: bsJson() });

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
