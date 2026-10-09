import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/apiAuth";

export const maxDuration = 300;
import { getAI } from "@/lib/ai";
import { createClient } from "@supabase/supabase-js";

const anthropic = getAI();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type BankRow = { id: string; description: string; debit: number; credit: number; date: string };
type Suggestion = { id: string; account: string; account_type: string; confidence: number; narration: string };

export async function POST(req: NextRequest) {
  try {
    const { rows, business_id } = await req.json() as { rows: BankRow[]; business_id: string };
    const gate = await requireBusiness(req, business_id);
    if (gate instanceof NextResponse) return gate;
    if (!rows?.length) {
      return NextResponse.json({ error: "rows and business_id required" }, { status: 400 });
    }

    // Fetch chart of accounts for context
    const { data: accounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("name,type")
      .eq("business_id", business_id)
      .eq("is_group", false)
      .limit(120);

    const accountList = (accounts ?? []).map(a => `${a.name} (${a.type})`).join(", ");

    const prompt = `You are an Indian business accountant. Categorize these bank statement rows into the correct ledger accounts.

Available accounts: ${accountList || "Cash, Sales, Purchases, Expenses, Debtors Control, Creditors Control, Capital Account"}

Bank rows to categorize (JSON array):
${JSON.stringify(rows.map(r => ({ id: r.id, date: r.date, description: r.description, debit: r.debit, credit: r.credit })))}

Rules:
- Credit (money in) → usually Sales, Receipts from Debtors, Capital, Loan Received
- Debit (money out) → usually Purchases, Expenses, Payment to Creditors, Loan Repayment
- "NEFT/RTGS/IMPS" transfers → look at description for clue
- "SALARY" or "SAL" → Salary & Wages
- "GST" → GST Payable or GST Input Credit
- "EMI" or "LOAN" → Loan Repayment / Interest
- "RENT" → Rent Expense
- "UPI" → look at merchant name in description
- Use an account from the available list when it fits the nature of the transaction.
- Otherwise propose a SPECIFIC, standard Indian ledger name — never a vague one like "Expenses", "Income", "Misc" or "Suspense". Examples:
  electricity/KSEB/BESCOM → "Electricity Charges"; salary/wages → "Salary & Wages"; bank charges/SMS charges → "Bank Charges";
  ATM/cash withdrawal → "Cash in Hand"; rent → "Rent"; fuel/petrol → "Fuel Expenses"; phone/Jio/Airtel recharge → "Telephone & Internet";
  furniture/chairs/tables → "Furniture & Fixtures"; laptop/computer → "Computers"; GST payment → "GST Payable"; TDS → "TDS Payable";
  interest credited → "Interest Received"; loan EMI → "Loan Account"; NEFT/IMPS from a named party → that party name as a debtor (money in) or creditor (money out).
- account_type for the proposed ledger must be one of: expense, income, asset, liability, equity.

Return ONLY a JSON array (no explanation):
[{"id":"row_id","account":"Account Name","account_type":"expense|income|bank|cash|asset|liability","confidence":0.0-1.0,"narration":"Short narration for journal"}]`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ suggestions: [] });

    const suggestions: Suggestion[] = JSON.parse(match[0]);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("bank-ai-categorize error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
