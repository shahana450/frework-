import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TxIn = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  ledger_id: string;
};

function pad(n: number) { return String(n).padStart(2, "0"); }

function nextEntryNo(existing: string[]): string {
  const nums = existing
    .map(e => parseInt(e.replace(/[^0-9]/g, "") || "0"))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `BANK/${Date.now()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { business_id, bank_account_id, transactions } = await req.json() as {
      business_id: string;
      bank_account_id: string;
      transactions: TxIn[];
    };

    if (!business_id || !bank_account_id || !transactions?.length) {
      return NextResponse.json({ error: "business_id, bank_account_id and transactions required" }, { status: 400 });
    }

    // Get current financial year
    const { data: fy } = await supabase
      .from("fw_fin_financial_years")
      .select("id")
      .eq("business_id", business_id)
      .eq("is_current", true)
      .single();

    const fyId = fy?.id ?? null;

    // Get bank account name for narration
    const { data: bankCoa } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("name")
      .eq("id", bank_account_id)
      .single();
    const bankName = bankCoa?.name ?? "Bank";

    const created: string[] = [];

    for (const tx of transactions) {
      const isDebit = tx.debit > 0; // money going OUT of bank
      const amount = isDebit ? tx.debit : tx.credit;
      const vtype = isDebit ? "payment" : "receipt";
      const entryNo = `BANK/${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Create journal
      const { data: journal, error: je } = await supabase
        .from("fw_fin_journals")
        .insert({
          business_id,
          financial_year_id: fyId,
          entry_no: entryNo,
          date: tx.date,
          type: vtype,
          status: "posted",
          narration: tx.description.slice(0, 200),
          total_debit: amount,
          total_credit: amount,
        })
        .select("id")
        .single();

      if (je || !journal) continue;

      // Lines: debit side, credit side
      if (isDebit) {
        // Money out: DR Expense/Payable ledger, CR Bank
        await supabase.from("fw_fin_journal_lines").insert([
          { journal_id: journal.id, account_id: tx.ledger_id, dr_amount: amount, cr_amount: 0, narration: tx.description.slice(0, 100) },
          { journal_id: journal.id, account_id: bank_account_id, dr_amount: 0, cr_amount: amount, narration: tx.description.slice(0, 100) },
        ]);
      } else {
        // Money in: DR Bank, CR Income/Receivable ledger
        await supabase.from("fw_fin_journal_lines").insert([
          { journal_id: journal.id, account_id: bank_account_id, dr_amount: amount, cr_amount: 0, narration: tx.description.slice(0, 100) },
          { journal_id: journal.id, account_id: tx.ledger_id, dr_amount: 0, cr_amount: amount, narration: tx.description.slice(0, 100) },
        ]);
      }

      created.push(journal.id);
    }

    return NextResponse.json({ created: created.length, journal_ids: created });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
