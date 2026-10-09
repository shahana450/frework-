import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { postJournal, postingErrorMessage } from "@/lib/posting";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type TxIn = { id: string; date: string; description: string; debit: number; credit: number; ledger_id: string };

// Money out: Dr chosen ledger / Cr bank. Money in: Dr bank / Cr chosen ledger. One atomic entry per row.
export async function POST(req: NextRequest) {
  try {
    const { business_id, bank_account_id, transactions } = await req.json() as { business_id: string; bank_account_id: string; transactions: TxIn[] };
    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!bank_account_id || !transactions?.length) {
      return NextResponse.json({ error: "Choose the bank account and at least one transaction." }, { status: 400 });
    }

    const created: string[] = [];
    const failures: { id: string; error: string }[] = [];
    for (const tx of transactions) {
      const out = (tx.debit || 0) > 0;
      const amount = out ? tx.debit : tx.credit;
      try {
        const r = await postJournal(supabase, {
          businessId: business_id, actorId: gate.user.id, date: String(tx.date).slice(0, 10),
          type: out ? "payment" : "receipt", narration: (tx.description ?? "").slice(0, 200), source: "bank_import",
          lines: out
            ? [{ accountId: tx.ledger_id, dr: amount, cr: 0 }, { accountId: bank_account_id, dr: 0, cr: amount }]
            : [{ accountId: bank_account_id, dr: amount, cr: 0 }, { accountId: tx.ledger_id, dr: 0, cr: amount }],
          metadata: { bank_row_id: tx.id },
        });
        created.push(r.id);
      } catch (e) {
        failures.push({ id: tx.id, error: postingErrorMessage(e).message });
      }
    }
    return NextResponse.json({ created: created.length, journal_ids: created, failures });
  } catch (e) {
    return serverError("bank-to-journals", e, "We couldn't post these bank transactions. Please try again.");
  }
}
