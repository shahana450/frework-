import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type BankRow = { id: string; description: string; debit: number; credit: number; date: string };
type Suggestion = { id: string; account: string; account_type: string; confidence: number; narration: string };

export async function POST(req: NextRequest) {
  try {
    const { rows, business_id } = await req.json() as { rows: BankRow[]; business_id: string };
    if (!rows?.length || !business_id) {
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
- Prefer accounts from the available list over generic ones

Return ONLY a JSON array (no explanation):
[{"id":"row_id","account":"Account Name","account_type":"expense|income|bank|cash|asset|liability","confidence":0.0-1.0,"narration":"Short narration for journal"}]`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
