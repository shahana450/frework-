import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "../route";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, validateEntry, voucherTypeFor, postingErrorMessage } from "@/lib/posting";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";

// Runs at the edge nearest the user (Mumbai for India) — next to the database, not across the world
export const runtime = "edge";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction, business_id, session_id, original_message, force_post: forceRequested, account_heads, client_key }: {
      client_key?: string;
      transaction: ParsedTransaction;
      business_id: string;
      session_id: string | null;
      original_message: string;
      force_post?: boolean;
      account_heads?: Record<string, string>;
    } = body;

    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    const user_id = gate.user.id;
    // Only the owner or an admin may post into a locked period
    const force_post = !!forceRequested && can(gate.role, "lock");

    // Idempotency: the same chat entry is posted only once, however many times it is sent
    const key = typeof client_key === "string" && client_key.length <= 120 ? client_key : null;
    const already = async () => {
      if (!key) return null;
      const { data } = await supabase.from("fw_fin_journals").select("id,entry_no").eq("business_id", business_id).eq("metadata->>client_key", key).neq("status", "voided").limit(1).maybeSingle();
      return data ? NextResponse.json({ success: true, already_posted: true, journal_id: data.id, entry_no: data.entry_no }) : null;
    };
    const prior = await already();
    if (prior) return prior;

    if (!transaction?.lines?.length) {
      return NextResponse.json({ error: "Nothing to post." }, { status: 400 });
    }

    // Check the amounts before creating any ledgers
    try { validateEntry(transaction.lines.map(l => ({ accountId: l.account || "?", dr: l.debit ?? 0, cr: l.credit ?? 0 })), transaction.transaction_date); }
    catch (e) { const p = postingErrorMessage(e); return NextResponse.json({ error: p.message }, { status: p.status }); }

    const resolved = await resolveLedgers(supabase, business_id, transaction.lines.map(l => ({ name: l.account, suggestedType: l.suggested_type })), account_heads ?? {});
    if (!resolved.ok) return NextResponse.json({ needs_heads: resolved.needHeads, will_create: resolved.willCreate });

    const narration = transaction.narrative || original_message?.slice(0, 200) || "FreBook entry";
    const resolvedLines = transaction.lines.map(l => {
      const acc = resolved.ids.get(l.account.trim())!;
      return { account_id: acc.id, account_name: acc.name, dr_amount: l.debit ?? 0, cr_amount: l.credit ?? 0, fc_dr: l.fc_debit, fc_cr: l.fc_credit };
    });

    let posted;
    try {
      posted = await postJournal(supabase, {
        businessId: business_id, actorId: user_id, date: transaction.transaction_date,
        type: voucherTypeFor(transaction.transaction_type), narration, referenceNo: transaction.invoice_number,
        partyName: transaction.party_name, source: "ai_copilot", aiGenerated: true, force: force_post,
        lines: resolvedLines.map(l => ({ accountId: l.account_id, dr: l.dr_amount, cr: l.cr_amount, fcDr: l.fc_dr, fcCr: l.fc_cr })),
        currency: transaction.fx?.currency ?? null, exchangeRate: transaction.fx?.rate ?? null,
        checkDuplicate: req.headers.get("x-confirm-duplicate") !== "1",
        metadata: {
          client_key: key,
          original_message, ai_narrative: transaction.narrative, transaction_type: transaction.transaction_type,
          party: transaction.party_name, gst: transaction.gst, tds: transaction.tds, ai_confidence: transaction.confidence,
          warnings: transaction.warnings, document_summary: transaction.document_summary ?? null, confirmed_by: user_id, fx: transaction.fx ?? null,
        },
      });
    } catch (e) {
      // Two sends at the same moment: the database lets only one through — return that one
      if (key && /client_key/i.test(e instanceof Error ? e.message : "")) { const won = await already(); if (won) return won; }
      const p = postingErrorMessage(e);
      if (p.status === 500) return serverError("chat-book/confirm", e, p.message);
      return NextResponse.json({ error: p.message, code: p.code, duplicate: p.duplicate }, { status: p.status });
    }
    const journal = { id: posted.id };
    const entryNo = posted.entryNo;
    const totalDr = posted.total, totalCr = posted.total;
    const created = resolved.created;

    // Update session with posted entry reference
    if (session_id) {
      const { data: sess } = await supabase.from("fw_fin_chat_sessions").select("messages").eq("id", session_id).single();
      if (sess?.messages) {
        const msgs = sess.messages as { role: string; content: string }[];
        msgs.push({ role: "assistant", content: `✓ Posted: ${entryNo}` });
        await supabase.from("fw_fin_chat_sessions").update({ messages: msgs.slice(-20), updated_at: new Date().toISOString() }).eq("id", session_id);
      }
    }

    return NextResponse.json({
      success: true,
      journal_id: journal.id,
      entry_no: entryNo,
      lines: resolvedLines,
      total_dr: totalDr,
      total_cr: totalCr,
      created_ledgers: created,
    });
  } catch (e) {
    return serverError("chat-book/confirm", e, "We couldn't post this entry. Nothing was saved — please try again.");
  }
}
