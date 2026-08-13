import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JournalLine = {
  dr_amount: number;
  cr_amount: number;
  fw_fin_chart_of_accounts: {
    code: string;
    name: string;
    type: string;
    sub_type: string | null;
  } | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bizId = searchParams.get("business_id");
  const fyId = searchParams.get("fy_id");
  const report = searchParams.get("report") ?? "trial_balance";

  if (!bizId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  // Get all posted journal lines for this business/FY
  let query = supabase
    .from("fw_fin_journal_lines")
    .select(`
      dr_amount, cr_amount,
      fw_fin_chart_of_accounts(code, name, type, sub_type),
      fw_fin_journals!inner(business_id, financial_year_id, status, date)
    `)
    .eq("fw_fin_journals.business_id", bizId)
    .eq("fw_fin_journals.status", "posted");

  if (fyId) query = query.eq("fw_fin_journals.financial_year_id", fyId);

  const { data: lines, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by account
  const ledger: Record<string, { code: string; name: string; type: string; sub_type: string | null; dr: number; cr: number }> = {};

  for (const line of (lines as unknown as JournalLine[]) ?? []) {
    const acc = line.fw_fin_chart_of_accounts;
    if (!acc) continue;
    if (!ledger[acc.name]) ledger[acc.name] = { code: acc.code, name: acc.name, type: acc.type, sub_type: acc.sub_type, dr: 0, cr: 0 };
    ledger[acc.name].dr += line.dr_amount ?? 0;
    ledger[acc.name].cr += line.cr_amount ?? 0;
  }

  const accounts = Object.values(ledger);

  if (report === "trial_balance") {
    return NextResponse.json({
      report: "trial_balance",
      accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)),
      total_dr: accounts.reduce((s, a) => s + a.dr, 0),
      total_cr: accounts.reduce((s, a) => s + a.cr, 0),
    });
  }

  if (report === "profit_loss") {
    const income = accounts.filter(a => a.type === "income");
    const expense = accounts.filter(a => a.type === "expense");
    const totalIncome = income.reduce((s, a) => s + (a.cr - a.dr), 0);
    const totalExpense = expense.reduce((s, a) => s + (a.dr - a.cr), 0);
    const directIncome = income.filter(a => a.sub_type === "revenue" || a.sub_type === "direct_income");
    const indirectIncome = income.filter(a => a.sub_type === "indirect_income");
    const directExpense = expense.filter(a => a.sub_type === "direct_expense");
    const indirectExpense = expense.filter(a => a.sub_type === "indirect_expense");
    const grossProfit = directIncome.reduce((s, a) => s + (a.cr - a.dr), 0) - directExpense.reduce((s, a) => s + (a.dr - a.cr), 0);

    return NextResponse.json({
      report: "profit_loss",
      direct_income: directIncome,
      indirect_income: indirectIncome,
      direct_expense: directExpense,
      indirect_expense: indirectExpense,
      gross_profit: grossProfit,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_profit: totalIncome - totalExpense,
    });
  }

  if (report === "balance_sheet") {
    const assets = accounts.filter(a => a.type === "asset");
    const liabilities = accounts.filter(a => a.type === "liability");
    const equity = accounts.filter(a => a.type === "equity");
    const income = accounts.filter(a => a.type === "income");
    const expense = accounts.filter(a => a.type === "expense");
    const netProfit = income.reduce((s, a) => s + (a.cr - a.dr), 0) - expense.reduce((s, a) => s + (a.dr - a.cr), 0);
    const totalAssets = assets.reduce((s, a) => s + (a.dr - a.cr), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + (a.cr - a.dr), 0);
    const totalEquity = equity.reduce((s, a) => s + (a.cr - a.dr), 0) + netProfit;

    return NextResponse.json({
      report: "balance_sheet",
      current_assets: assets.filter(a => a.sub_type === "current_asset"),
      fixed_assets: assets.filter(a => a.sub_type === "fixed_asset"),
      current_liabilities: liabilities.filter(a => a.sub_type === "current_liability"),
      long_term_liabilities: liabilities.filter(a => a.sub_type === "long_term_liability"),
      equity,
      net_profit: netProfit,
      total_assets: totalAssets,
      total_liabilities_equity: totalLiabilities + totalEquity,
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
