import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { postJournal, postingErrorMessage } from "@/lib/posting";
import { extractBankRef, findDuplicates, loadBankAccount, importedOnAccount, createBatch } from "@/lib/bankImport";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type TxIn = { id: string; date: string; description: string; debit: number; credit: number; ledger_id: string; confirm_duplicate?: boolean };

// Money out: Dr chosen ledger / Cr bank. Money in: Dr bank / Cr chosen ledger. One atomic entry per row.
// The bank side always comes from the batch's bank account (a cash/bank ledger). Possible duplicates aren't posted.
export async function POST(req: NextRequest) {
  try {
    const { business_id, bank_account_id, transactions, file_name } = await req.json() as { business_id: string; bank_account_id: string; transactions: TxIn[]; file_name?: string };
    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!bank_account_id || !transactions?.length) {
      return NextResponse.json({ error: "Choose the bank account and at least one transaction." }, { status: 400 });
    }
    try { await loadBankAccount(supabase, business_id, bank_account_id); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Choose a bank ledger." }, { status: 400 }); }

    const rows = transactions.map(t => ({ key: t.id, date: String(t.date).slice(0, 10), amount: (t.debit || 0) > 0 ? t.debit : t.credit, ref: extractBankRef(t.description) }));
    const dates = rows.map(r => r.date).sort();
    const existing = await importedOnAccount(supabase, business_id, bank_account_id, dates[0], dates[dates.length - 1], rows.map(r => r.ref).filter((x): x is string => !!x));
    const dupes = findDuplicates(rows, existing);
    const batchId = await createBatch(supabase, { businessId: business_id, bankAccountId: bank_account_id, fileName: file_name ?? null, rows: transactions.length, actorId: gate.user.id });

    const created: string[] = [];
    const failures: { id: string; error: string; code?: string }[] = [];
    for (const tx of transactions) {
      if (dupes.has(tx.id) && !tx.confirm_duplicate) { failures.push({ id: tx.id, code: "POSSIBLE_DUPLICATE", error: `Possible duplicate — not posted. ${dupes.get(tx.id)}` }); continue; }
      const out = (tx.debit || 0) > 0;
      const amount = out ? tx.debit : tx.credit;
      try {
        const r = await postJournal(supabase, {
          businessId: business_id, actorId: gate.user.id, date: String(tx.date).slice(0, 10),
          type: out ? "payment" : "receipt", narration: (tx.description ?? "").slice(0, 200), source: "bank_import",
          lines: out
            ? [{ accountId: tx.ledger_id, dr: amount, cr: 0 }, { accountId: bank_account_id, dr: 0, cr: amount }]
            : [{ accountId: bank_account_id, dr: amount, cr: 0 }, { accountId: tx.ledger_id, dr: 0, cr: amount }],
          metadata: { bank_row_id: tx.id, bank_account_id, bank_ref: rows.find(r => r.key === tx.id)?.ref ?? null, bank_batch_id: batchId },
        });
        created.push(r.id);
      } catch (e) {
        const pe = postingErrorMessage(e);
        failures.push({ id: tx.id, error: pe.message, code: pe.code });
      }
    }
    return NextResponse.json({ created: created.length, journal_ids: created, failures, batch_id: batchId });
  } catch (e) {
    return serverError("bank-to-journals", e, "We couldn't post these bank transactions. Please try again.");
  }
}
