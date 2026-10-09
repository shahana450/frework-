import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { buildTrialBalance, buildPL, buildBS, loadBookLines, GROUP_LABEL, type TBRow } from "@/lib/books";
import { loadQueryBooks } from "@/lib/intentEngine";
import { computeCashFlow } from "@/lib/cashFlow";

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

  const { lines, accounts, error } = await loadBookLines(supabase, bizId!, end);
  if (error) { console.error("reports load failed", bizId, error); return NextResponse.json({ error: "We couldn't load your reports right now. Please try again." }, { status: 500 }); }

  const tb = buildTrialBalance(accounts, lines, start, end);
  const row = (r: TBRow) => ({ code: "", name: r.name, type: GROUP_LABEL[r.group], sub_type: r.group, dr: r.dr, cr: r.cr });

  if (report === "trial_balance") {
    return NextResponse.json({
      report: "trial_balance",
      accounts: tb.map(row),
      total_dr: tb.reduce((s, r) => s + r.dr, 0),
      total_cr: tb.reduce((s, r) => s + r.cr, 0),
    });
  }

  const pl = buildPL(tb);
  if (report === "profit_loss") {
    return NextResponse.json({
      report: "profit_loss",
      direct_income: pl.sales.map(row),
      indirect_income: pl.indirectIncome.map(row),
      direct_expense: pl.purchases.map(row),
      indirect_expense: pl.indirectExpenses.map(row),
      gross_profit: pl.grossProfit,
      total_income: pl.revenue + pl.otherIncome,
      total_expense: pl.cogs + pl.expenses,
      net_profit: pl.netProfit,
    });
  }

  if (report === "balance_sheet") {
    const bs = buildBS(tb, pl.netProfit);
    return NextResponse.json({
      report: "balance_sheet",
      current_assets: bs.currentAssets.map(row),
      fixed_assets: bs.fixedAssets.map(row),
      current_liabilities: [...bs.currentLiabilities, ...bs.duties].map(row),
      long_term_liabilities: bs.loans.map(row),
      equity: bs.capital.map(row),
      net_profit: pl.netProfit,
      total_assets: bs.totalAssets,
      total_liabilities_equity: bs.totalLiabEq,
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
