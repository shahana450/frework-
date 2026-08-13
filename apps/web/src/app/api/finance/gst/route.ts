import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JLine = {
  dr_amount: number;
  cr_amount: number;
  fw_fin_chart_of_accounts: { name: string; type: string } | null;
  fw_fin_journals: { date: string; narration: string; reference_no: string | null } | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bizId = searchParams.get("business_id");
  const month = searchParams.get("month"); // YYYY-MM
  const report = searchParams.get("report") ?? "summary";

  if (!bizId || !month) return NextResponse.json({ error: "business_id and month required" }, { status: 400 });

  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: lines, error } = await supabase
    .from("fw_fin_journal_lines")
    .select(`
      dr_amount, cr_amount,
      fw_fin_chart_of_accounts(name, type),
      fw_fin_journals!inner(business_id, status, date, narration, reference_no)
    `)
    .eq("fw_fin_journals.business_id", bizId)
    .eq("fw_fin_journals.status", "posted")
    .gte("fw_fin_journals.date", startDate)
    .lte("fw_fin_journals.date", endDate);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const typedLines = (lines as unknown as JLine[]) ?? [];

  // Aggregate GST amounts
  let cgstPayable = 0, sgstPayable = 0, igstPayable = 0, inputCredit = 0;
  let outputTax = 0, inputTax = 0;
  let totalSales = 0, totalPurchases = 0;

  for (const line of typedLines) {
    const accName = line.fw_fin_chart_of_accounts?.name ?? "";
    if (accName.includes("GST Payable - CGST")) cgstPayable += (line.cr_amount - line.dr_amount);
    if (accName.includes("GST Payable - SGST")) sgstPayable += (line.cr_amount - line.dr_amount);
    if (accName.includes("GST Payable - IGST")) igstPayable += (line.cr_amount - line.dr_amount);
    if (accName.includes("GST Input Tax Credit")) inputCredit += (line.dr_amount - line.cr_amount);
    if (accName.includes("Sales / Revenue") || accName.includes("Sales")) totalSales += (line.cr_amount - line.dr_amount);
    if (accName.includes("Purchase") || accName.includes("Cost of Goods")) totalPurchases += (line.dr_amount - line.cr_amount);
  }

  outputTax = cgstPayable + sgstPayable + igstPayable;
  inputTax = inputCredit;
  const netGstPayable = Math.max(0, outputTax - inputTax);

  if (report === "summary") {
    return NextResponse.json({
      month,
      total_sales: totalSales,
      total_purchases: totalPurchases,
      output_tax: outputTax,
      cgst_payable: cgstPayable,
      sgst_payable: sgstPayable,
      igst_payable: igstPayable,
      input_credit: inputCredit,
      net_gst_payable: netGstPayable,
    });
  }

  return NextResponse.json({ error: "Unknown report" }, { status: 400 });
}
