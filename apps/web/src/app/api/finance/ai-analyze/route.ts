import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { getAI } from "@/lib/ai";
import { readAttachmentBuffer } from "@/lib/attachments";
import { intentSystemFor, loadBusinessContext, interpret, type AiIntent } from "@/lib/intentEngine";
import { DOCUMENT_ADDENDUM, findDuplicates, fileHash, type Extracted } from "@/lib/documentReview";
import { voucherTypeFor } from "@/lib/posting";

export const maxDuration = 300;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = getAI();

// Optional columns: written when the database has them (Phase 4 SQL), skipped otherwise
async function insertSuggestion(row: Record<string, unknown>) {
  const r = await supabase.from("fw_fin_ai_suggestions").insert(row);
  if (r.error && /details/.test(r.error.message)) { const { details: _omit, ...rest } = row; void _omit; return supabase.from("fw_fin_ai_suggestions").insert(rest); }
  return r;
}

const BANK_PROMPT = `This is a bank statement. Extract EVERY transaction from every page. For each row also suggest the ledger
for the other side (never the bank itself): a specific standard name or one from the existing list — e.g. "Electricity Charges",
"Salary & Wages", "Bank Charges", "Cash in Hand" (ATM), a party name for NEFT/IMPS from/to a named person.
Return ONLY JSON: {"bank_name":"","account_last4":"","period":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"},
"transactions":[{"date":"YYYY-MM-DD","description":"","debit":0,"credit":0,"ledger":"","confidence":0.0,"reason":""}]}`;

export async function POST(req: NextRequest) {
  try {
    const { text, file_data, mime_type, file_name, doc_type_hint, doc_id, business_id } = await req.json();
    const gate = await requireBusiness(req, business_id, { action: "upload" });
    if (gate instanceof NextResponse) return gate;
    if (!doc_id) return NextResponse.json({ error: "Upload the document first." }, { status: 400 });
    // ~15 MB file limit and a fixed list of document types
    if (typeof file_data === "string" && file_data.length > 20_500_000) return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });
    const allowed = /^(application\/pdf|image\/(jpeg|png|webp|gif|heic)|text\/(csv|plain)|application\/(vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|vnd\.ms-excel|octet-stream)|)$/i;
    if (file_data && !allowed.test(String(mime_type ?? "")) && !/\.(pdf|jpe?g|png|webp|csv|txt|xlsx?|docx)$/i.test(String(file_name ?? ""))) {
      return NextResponse.json({ error: "Upload a PDF, photo, Excel, CSV or Word file." }, { status: 415 });
    }

    const { data: doc } = await supabase.from("fw_fin_documents").select("id").eq("id", doc_id).eq("business_id", business_id).maybeSingle();
    if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const hash = file_data ? fileHash(file_data) : null;
    const att = file_data ? readAttachmentBuffer(Buffer.from(file_data, "base64"), file_name ?? "document", mime_type ?? "") : { blocks: [], text: String(text ?? "").slice(0, 20000), name: file_name ?? "text" };
    const { data: coa } = await supabase.from("fw_fin_chart_of_accounts").select("name,type,sub_type").eq("business_id", business_id).eq("is_group", false).limit(300);
    const accounts = coa ?? [];
    const accountList = accounts.map(a => `${a.name} (${a.type}${a.sub_type ? "/" + a.sub_type : ""})`).join(" | ");
    const today = new Date().toLocaleDateString("en-CA");
    const biz = await loadBusinessContext(supabase, business_id);
    const context = `Today: ${today}. Business: ${biz.name}, Country: ${biz.country}, State: ${biz.state ?? "not set"}, Tax ID: ${biz.gstin ?? "not set"}, Base currency: ${biz.baseCurrency}. Available Accounts: ${accountList}.`;
    const content = (prompt: string): Anthropic.MessageParam["content"] =>
      att.blocks.length ? [...att.blocks, { type: "text", text: `${context}\n\n${prompt}` }] : `${context}\n\nFile "${att.name}":\n${att.text}\n\n${prompt}`;

    // ── Bank statement: one queued suggestion per row; rules make the lines ─────
    if (doc_type_hint === "bank_statement") {
      const res = await ai.messages.create({ model: "claude-sonnet-4-6", max_tokens: 32000, messages: [{ role: "user", content: content(BANK_PROMPT) }] });
      const raw = res.content[0].type === "text" ? res.content[0].text : "";
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { bank_name?: string; period?: { to?: string }; transactions?: { date: string; description: string; debit: number; credit: number; ledger: string; confidence: number; reason?: string }[] };
      const txs = (parsed.transactions ?? []).filter(t => (Number(t.debit) || 0) > 0 || (Number(t.credit) || 0) > 0);
      const bankLedger = accounts.find(a => a.sub_type === "bank" && parsed.bank_name && a.name.toLowerCase().includes(parsed.bank_name.toLowerCase().split(" ")[0]))?.name
        ?? accounts.find(a => a.sub_type === "bank")?.name ?? (parsed.bank_name ? `${parsed.bank_name}` : "Bank Account");

      await supabase.from("fw_fin_documents").update({
        status: "reviewed", doc_type: "bank_statement",
        ai_summary: { hash, vendor: parsed.bank_name ?? null, date: parsed.period?.to ?? null, narration: `Bank statement — ${txs.length} transactions`, transaction_count: txs.length, bank_ledger: bankLedger },
      }).eq("id", doc_id);
      await supabase.from("fw_fin_ai_suggestions").delete().eq("document_id", doc_id).eq("status", "pending");
      for (const t of txs) {
        const out = (Number(t.debit) || 0) > 0;
        const amount = out ? Number(t.debit) : Number(t.credit);
        const other = (t.ledger || (out ? "Suspense" : "Suspense")).trim();
        await insertSuggestion({
          business_id, document_id: doc_id, status: "pending",
          suggested_type: out ? "payment" : "receipt",
          suggested_narration: `[${t.date}] ${t.description}`.slice(0, 300),
          suggested_lines: out
            ? [{ account_name: other, dr: amount, cr: 0 }, { account_name: bankLedger, dr: 0, cr: amount }]
            : [{ account_name: bankLedger, dr: amount, cr: 0 }, { account_name: other, dr: 0, cr: amount }],
          confidence: Math.max(0, Math.min(1, Number(t.confidence) || 0.7)),
          details: { date: t.date, source_row: t.description, rule: out ? `Money out: Dr ${other} — Cr ${bankLedger}` : `Money in: Dr ${bankLedger} — Cr ${other}`, reason: t.reason ?? null, counter_account: other, bank_ledger: bankLedger },
        });
      }
      return NextResponse.json({ success: true, bank_statement: true, transaction_count: txs.length, bank_name: parsed.bank_name });
    }

    // ── Single document ────────────────────────────────────────────────────────
    const res = await ai.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4096, system: intentSystemFor(biz) + DOCUMENT_ADDENDUM,
      messages: [{ role: "user", content: content(`Describe this ${doc_type_hint ?? "document"} for review.`) }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text : "";
    let out: AiIntent & { extracted?: Extracted };
    try { out = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch { return NextResponse.json({ error: "We couldn't read this document. Try a clearer photo or the PDF." }, { status: 422 }); }
    const ex: Extracted = out.extracted ?? {};

    const parsed = await interpret(supabase, out, accounts, business_id, today, biz);
    const total = parsed.lines.reduce((s, l) => s + l.debit, 0);
    const duplicates = await findDuplicates(supabase, business_id, {
      docId: doc_id, hash, invoiceNo: ex.invoice_no ?? parsed.invoice_number, party: parsed.party_name ?? ex.supplier ?? ex.customer,
      date: parsed.transaction_date, total: Math.round(total * 100) / 100 || null,
    });

    const review = {
      action: parsed.transaction_type, rule: parsed.rule ?? null, reason: parsed.reason ?? null, history_evidence: parsed.history_evidence ?? null,
      confidence: parsed.confidence, account_confidence: parsed.account_confidence ?? null, counter_account: parsed.counter_account ?? null,
      alternatives: parsed.alternatives ?? [], warnings: parsed.warnings, question: parsed.status === "needs_clarification" ? parsed.needs_clarification[0] : null,
      gst: parsed.gst, tds: parsed.tds, payment_mode: parsed.payment_mode, date: parsed.transaction_date, party: parsed.party_name, duplicates,
    };
    await supabase.from("fw_fin_documents").update({
      status: "reviewed", doc_type: ex.doc_type ?? doc_type_hint ?? null,
      ai_summary: {
        hash, vendor: ex.supplier ?? parsed.party_name, customer: ex.customer ?? null, amount: ex.total ?? total, base_amount: ex.taxable_value ?? parsed.gst.taxable_value,
        gst_amount: (ex.cgst ?? 0) + (ex.sgst ?? 0) + (ex.igst ?? 0) || (parsed.gst.cgst + parsed.gst.sgst + parsed.gst.igst), cgst: ex.cgst ?? parsed.gst.cgst, sgst: ex.sgst ?? parsed.gst.sgst, igst: ex.igst ?? parsed.gst.igst,
        date: ex.date ?? parsed.transaction_date, invoice_no: ex.invoice_no ?? parsed.invoice_number, gstin_supplier: ex.gstin_supplier ?? null, gstin_buyer: ex.gstin_buyer ?? null,
        hsn_sac: ex.hsn_sac ?? null, items: ex.items ?? [], review,
      },
    }).eq("id", doc_id);

    await supabase.from("fw_fin_ai_suggestions").delete().eq("document_id", doc_id).eq("status", "pending");
    await insertSuggestion({
      business_id, document_id: doc_id, status: "pending",
      suggested_type: voucherTypeFor(parsed.transaction_type),
      suggested_narration: parsed.narrative || `${ex.doc_type ?? "Document"} ${ex.invoice_no ?? ""} ${parsed.party_name ?? ""}`.trim(),
      suggested_lines: parsed.lines.map(l => ({ account_name: l.account, dr: l.debit, cr: l.credit })),
      confidence: Math.min(parsed.confidence, parsed.account_confidence ?? 1),
      details: review,
    });

    return NextResponse.json({
      success: true,
      result: {
        vendor: ex.supplier ?? ex.customer ?? parsed.party_name, amount: ex.total ?? total, gst_amount: (ex.cgst ?? 0) + (ex.sgst ?? 0) + (ex.igst ?? 0),
        date: ex.date ?? parsed.transaction_date, narration: parsed.narrative, confidence: parsed.confidence, doc_type: ex.doc_type ?? doc_type_hint, items: ex.items ?? [],
      },
      review,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Gemini (429|503)|high demand/i.test(msg)) return serverError("ai-analyze", e, "The AI is busy right now. Please try again in a minute.");
    return serverError("ai-analyze", e, "We couldn't analyse this document. Please try again.");
  }
}
