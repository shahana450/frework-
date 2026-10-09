import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "../route";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, validateEntry, voucherTypeFor, postingErrorMessage } from "@/lib/posting";

// Runs at the edge nearest the user (Mumbai for India) — next to the database, not across the world
export const runtime = "edge";


const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Item = { ref: string; transaction: ParsedTransaction; original_message?: string; client_key?: string };

// Posts many entries; each one is atomic on its own, so one bad row never blocks the rest
export async function POST(req: NextRequest) {
  try {
    const { items, business_id, account_heads, source: rawSource }: { items: Item[]; business_id: string; account_heads?: Record<string, string>; source?: string } = await req.json();
    const source = rawSource === "template" ? "template" : "statement";
    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    const user_id = gate.user.id;
    if (!items?.length) return NextResponse.json({ error: "Nothing to post." }, { status: 400 });
    if (items.length > 200) return NextResponse.json({ error: "Max 200 entries per request" }, { status: 400 });

    const failures: { ref: string; error: string }[] = [];
    const valid = items.filter(it => {
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
            referenceNo: t.invoice_number, partyName: t.party_name, source, aiGenerated: true,
            lines: t.lines.map(l => ({ accountId: resolved.ids.get(l.account.trim())!.id, dr: l.debit ?? 0, cr: l.credit ?? 0 })),
            metadata: { client_key: it.client_key ?? null, original_message: it.original_message, transaction_type: t.transaction_type, confirmed_by: user_id, gst: t.gst ?? null, tds: t.tds ?? null },
          });
          results.push({ ref: it.ref, entry_no: posted.entryNo, journal_id: posted.id });
        } catch (e) {
          if (it.client_key && /client_key/i.test(e instanceof Error ? e.message : "")) return; // a parallel request already posted it
          failures.push({ ref: it.ref, error: postingErrorMessage(e).message });
        }
      }));
    }
    return NextResponse.json({ results, failures, created_ledgers: resolved.created });
  } catch (e) {
    return serverError("chat-book/confirm-batch", e, "We couldn't post these entries. Please try again.");
  }
}
