import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "../route";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, validateEntry, voucherTypeFor, postingErrorMessage } from "@/lib/posting";
import { extractBankRef, findDuplicates, loadBankAccount, importedOnAccount, createBatch } from "@/lib/bankImport";

// Runs at the edge nearest the user (Mumbai for India) — next to the database, not across the world
export const runtime = "edge";


const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Item = { ref: string; transaction: ParsedTransaction; original_message?: string; client_key?: string; confirm_duplicate?: boolean; against_invoice_id?: string | null; party_name?: string | null };

// Posts many entries; each one is atomic on its own, so one bad row never blocks the rest
export async function POST(req: NextRequest) {
  try {
    const { items, business_id, account_heads, source: rawSource, bank_account_id: bankIdIn, bank_account_name, card, file_name }: { items: Item[]; business_id: string; account_heads?: Record<string, string>; source?: string; bank_account_id?: string; bank_account_name?: string; card?: boolean; file_name?: string } = await req.json();
    let bank_account_id = bankIdIn;
    const source = rawSource === "template" ? "template" : "statement";
    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    const user_id = gate.user.id;
    if (!items?.length) return NextResponse.json({ error: "Nothing to post." }, { status: 400 });
    if (items.length > 200) return NextResponse.json({ error: "Max 200 entries per request" }, { status: 400 });

    const failures: { ref: string; error: string; code?: string }[] = [];

    // Bank statements: the bank side of every row is the batch's bank account. The row's own lines only give the
    // other ledger — so a row can never make "Bank Charges" (or any non-bank ledger) act as the bank.
    let bank: { id: string; name: string } | null = null, batchId: string | null = null;
    const dupes = new Map<string, string>();
    if (source === "statement") {
      // By name (statement window, Smart Inbox): an existing ledger, or a new one created under Bank Accounts / Current Liabilities (card)
      if (!bank_account_id && bank_account_name?.trim()) {
        const name = bank_account_name.trim();
        const r = await resolveLedgers(supabase, business_id, [{ name, suggestedType: card ? "liability" : "asset" }], { [name]: card ? "current_liability" : "bank" }, "statement import");
        if (r.ok) bank_account_id = r.ids.get(name)?.id;
      }
      if (!bank_account_id) return NextResponse.json({ error: "Choose the bank account this statement belongs to." }, { status: 400 });
      try { const a = await loadBankAccount(supabase, business_id, bank_account_id, { card: !!card }); bank = { id: a.id, name: a.name }; }
      catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Choose a bank ledger." }, { status: 400 }); }
      const bankKey = bank.name.trim().toLowerCase();
      for (const it of items) {
        const t = it.transaction;
        const amount = Math.round(Math.max(...t.lines.map(l => Math.max(l.debit ?? 0, l.credit ?? 0))) * 100) / 100;
        const others = t.lines.filter(l => l.account.trim().toLowerCase() !== bankKey);
        // Exactly one line must be the other ledger; anything else is ambiguous and is not guessed
        const counter = others.length === 1 ? others[0] : null;
        if (!counter || counter.account.trim().toLowerCase() === bankKey) { failures.push({ ref: it.ref, error: "Choose the ledger for this bank line." }); (it as Item & { skip?: boolean }).skip = true; continue; }
        const out = (counter.debit ?? 0) > 0;          // the other ledger is debited when money goes out of the bank
        t.lines = out
          ? [{ ...counter, debit: amount, credit: 0 }, { account: bank.name, debit: 0, credit: amount, confidence: 1, is_new_account: false, suggested_type: "asset" }]
          : [{ account: bank.name, debit: amount, credit: 0, confidence: 1, is_new_account: false, suggested_type: "asset" }, { ...counter, debit: 0, credit: amount }];
        t.transaction_type = card ? "journal" : out ? "payment" : "receipt";
      }
      const live = items.filter(it => !(it as Item & { skip?: boolean }).skip);
      const rows = live.map(it => ({ key: it.ref, date: it.transaction.transaction_date, amount: it.transaction.lines[0].debit ?? 0, ref: extractBankRef(`${it.transaction.narrative ?? ""} ${it.original_message ?? ""}`) }));
      const dates = rows.map(r => r.date).sort();
      const existing = rows.length ? await importedOnAccount(supabase, business_id, bank.id, dates[0], dates[dates.length - 1], rows.map(r => r.ref).filter((x): x is string => !!x)) : [];
      for (const [k, why] of findDuplicates(rows, existing)) dupes.set(k, why);
      for (const r of rows) (live.find(it => it.ref === r.key)!.transaction as ParsedTransaction & { bank_ref?: string | null }).bank_ref = r.ref;
      batchId = await createBatch(supabase, { businessId: business_id, bankAccountId: bank.id, fileName: file_name ?? null, rows: live.length, actorId: gate.user.id });
    }

    const valid = items.filter(it => {
      if ((it as Item & { skip?: boolean }).skip) return false;
      // Possible duplicates are held back unless the user confirmed this row
      if (dupes.has(it.ref) && !it.confirm_duplicate) { failures.push({ ref: it.ref, code: "POSSIBLE_DUPLICATE", error: `Possible duplicate — not posted. ${dupes.get(it.ref)}` }); return false; }
      try {
        validateEntry(it.transaction.lines.map(l => ({ accountId: l.account || "?", dr: l.debit ?? 0, cr: l.credit ?? 0 })), it.transaction.transaction_date);
        return true;
      } catch (e) { failures.push({ ref: it.ref, error: postingErrorMessage(e).message }); return false; }
    });

    const resolved = await resolveLedgers(supabase, business_id, valid.flatMap(it => it.transaction.lines.map(l => ({ name: l.account, suggestedType: l.suggested_type }))), account_heads ?? {}, source === "template" ? "template import" : "statement import");
    if (!resolved.ok) return NextResponse.json({ needs_heads: resolved.needHeads, will_create: resolved.willCreate });

    const results: { ref: string; entry_no: string; journal_id: string; already?: boolean }[] = [];

    // Rows posted before with the same client key (double click, retry) are reported, not posted again
    const keys = valid.map(it => it.client_key).filter((k): k is string => typeof k === "string" && k.length <= 160);
    const done = new Map<string, { id: string; entry_no: string }>();
    for (let i = 0; i < keys.length; i += 100) {
      const { data } = await supabase.from("fw_fin_journals").select("id,entry_no,metadata").eq("business_id", business_id).neq("status", "voided").in("metadata->>client_key", keys.slice(i, i + 100));
      for (const j of (data ?? []) as { id: string; entry_no: string; metadata: { client_key?: string } | null }[]) if (j.metadata?.client_key) done.set(j.metadata.client_key, { id: j.id, entry_no: j.entry_no });
    }
    const CONCURRENCY = 6;
    for (let i = 0; i < valid.length; i += CONCURRENCY) {
      await Promise.all(valid.slice(i, i + CONCURRENCY).map(async it => {
        const t = it.transaction;
        const prior = it.client_key ? done.get(it.client_key) : undefined;
        if (prior) { results.push({ ref: it.ref, entry_no: prior.entry_no, journal_id: prior.id, already: true }); return; }
        try {
          const posted = await postJournal(supabase, {
            businessId: business_id, actorId: user_id, date: t.transaction_date, type: voucherTypeFor(t.transaction_type),
            narration: t.narrative || it.original_message?.slice(0, 200) || (source === "template" ? "Template entry" : "Bank statement entry"),
            referenceNo: t.invoice_number, partyName: t.party_name ?? it.party_name ?? null, source, aiGenerated: true, againstInvoiceId: it.against_invoice_id ?? null,
            lines: t.lines.map(l => ({ accountId: resolved.ids.get(l.account.trim())!.id, dr: l.debit ?? 0, cr: l.credit ?? 0 })),
            metadata: { client_key: it.client_key ?? null, original_message: it.original_message, transaction_type: t.transaction_type, confirmed_by: user_id, gst: t.gst ?? null, tds: t.tds ?? null,
              ...(bank ? { bank_account_id: bank.id, bank_ref: (t as ParsedTransaction & { bank_ref?: string | null }).bank_ref ?? null, bank_batch_id: batchId } : {}) },
          });
          results.push({ ref: it.ref, entry_no: posted.entryNo, journal_id: posted.id });
        } catch (e) {
          if (it.client_key && /client_key/i.test(e instanceof Error ? e.message : "")) return; // a parallel request already posted it
          const pe = postingErrorMessage(e);
          failures.push({ ref: it.ref, error: pe.message, code: pe.code });
        }
      }));
    }
    return NextResponse.json({ results, failures, created_ledgers: resolved.created, batch_id: batchId });
  } catch (e) {
    return serverError("chat-book/confirm-batch", e, "We couldn't post these entries. Please try again.");
  }
}
