import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SINGLE_DOC_PROMPT = `You are an expert Indian chartered accountant. Analyze the document and extract financial information.

Return ONLY valid JSON (no markdown, no explanation):
{
  "doc_type": "invoice|bill|receipt|bank_statement|salary_slip|other",
  "vendor": "string or null",
  "customer": "string or null",
  "amount": number or null,
  "base_amount": number or null,
  "gst_amount": number or null,
  "cgst": number or null,
  "sgst": number or null,
  "igst": number or null,
  "tds_amount": number or null,
  "date": "YYYY-MM-DD or null",
  "invoice_no": "string or null",
  "gstin_vendor": "string or null",
  "gstin_buyer": "string or null",
  "hsn_sac": "string or null",
  "narration": "one-line description for journal entry",
  "suggested_type": "sales|purchase|expense|payment|receipt|contra",
  "journal_lines": [
    {"account_name": "exact Indian chart of accounts name", "dr": number, "cr": number}
  ],
  "confidence": number 0-1,
  "items": [{"description": "string", "qty": number, "rate": number, "amount": number}]
}

Common account names: "Accounts Receivable (Debtors)", "Accounts Payable (Creditors)", "Sales / Revenue", "GST Payable - CGST", "GST Payable - SGST", "GST Payable - IGST", "GST Input Tax Credit", "Cash in Hand", "Bank Accounts", "TDS Payable", "TDS Receivable".
Journal entries must balance: total debits = total credits.`;

const BANK_STATEMENT_PROMPT = `You are an expert Indian chartered accountant analyzing a bank statement. Extract EVERY individual transaction.

Return ONLY valid JSON (no markdown, no explanation):
{
  "bank_name": "string",
  "account_number": "last 4 digits or masked number",
  "account_holder": "string or null",
  "statement_period": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
  "opening_balance": number or null,
  "closing_balance": number or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "exact description from statement",
      "debit": number or null,
      "credit": number or null,
      "balance": number or null,
      "narration": "short journal narration",
      "suggested_type": "payment|receipt|contra|expense|sales",
      "journal_lines": [
        {"account_name": "account name", "dr": number, "cr": number}
      ]
    }
  ]
}

For each transaction:
- Credit entry (money IN) → DR Bank Accounts, CR appropriate income/receipt account
- Debit entry (money OUT) → DR appropriate expense/payment account, CR Bank Accounts
- Use "Bank Accounts" as the bank ledger name.
- Journal lines must balance for each transaction.
- Extract ALL transactions visible in the statement, not just a sample.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, file_data, mime_type, file_name, doc_type_hint, doc_id, business_id } = body;

    if (!doc_id || !business_id) {
      return NextResponse.json({ error: "doc_id and business_id required" }, { status: 400 });
    }

    const isBankStatement = doc_type_hint === "bank_statement";

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

    let userContent: ContentBlock[];
    const hint = doc_type_hint ?? "unknown";

    if (file_data) {
      const isImage = (mime_type as string || "").startsWith("image/");
      const isPDF = (mime_type as string || "") === "application/pdf";

      if (isImage) {
        userContent = [
          { type: "text", text: isBankStatement ? "Extract ALL transactions from this bank statement image:" : `Analyze this ${hint} document and extract financial data:` },
          { type: "image", source: { type: "base64", media_type: mime_type as string, data: file_data as string } },
        ];
      } else if (isPDF) {
        userContent = [
          { type: "text", text: isBankStatement ? "Extract ALL transactions from every page of this bank statement PDF:" : `Analyze this ${hint} PDF and extract all financial data:` },
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: file_data as string } },
        ];
      } else {
        userContent = [{ type: "text", text: `Document: ${file_name ?? "unknown"}\nType: ${hint}\n\nExtract financial data.` }];
      }
    } else {
      userContent = [{ type: "text", text: `Analyze this document:\n\n${(text as string || "").slice(0, 4000)}` }];
    }

    // ── Bank statement: extract all transactions ──────────────────────────────
    if (isBankStatement) {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: BANK_STATEMENT_PROMPT,
        messages: [{ role: "user", content: userContent as Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"] }],
      });

      const rawText = message.content[0].type === "text" ? message.content[0].text : "{}";
      let parsed: Record<string, unknown>;
      try {
        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON", raw: rawText }, { status: 500 });
      }

      const transactions = (parsed.transactions as Record<string, unknown>[]) ?? [];
      const totalCredit = transactions.reduce((s, t) => s + (Number(t.credit) || 0), 0);
      const totalDebit = transactions.reduce((s, t) => s + (Number(t.debit) || 0), 0);

      // Update document record
      await supabase.from("fw_fin_documents").update({
        status: "reviewed",
        doc_type: "bank_statement",
        ai_summary: {
          vendor: parsed.bank_name,
          amount: totalCredit - totalDebit,
          date: (parsed.statement_period as Record<string, unknown>)?.to as string ?? null,
          narration: `Bank statement — ${transactions.length} transactions · ${parsed.bank_name}`,
          transaction_count: transactions.length,
          opening_balance: parsed.opening_balance,
          closing_balance: parsed.closing_balance,
          statement_period: parsed.statement_period,
        },
      }).eq("id", doc_id);

      // Delete existing suggestions for this doc before re-creating
      await supabase.from("fw_fin_ai_suggestions").delete().eq("document_id", doc_id);

      // Create one suggestion per transaction
      const rows = transactions.map((t: Record<string, unknown>) => ({
        business_id,
        document_id: doc_id,
        suggested_type: t.suggested_type ?? "payment",
        suggested_narration: `[${t.date}] ${t.narration ?? t.description}${t.debit ? ` DR ₹${t.debit}` : t.credit ? ` CR ₹${t.credit}` : ""}`,
        suggested_lines: t.journal_lines ?? [],
        confidence: 0.88,
        status: "pending",
      }));

      // Insert in batches of 20
      for (let i = 0; i < rows.length; i += 20) {
        await supabase.from("fw_fin_ai_suggestions").insert(rows.slice(i, i + 20));
      }

      return NextResponse.json({
        success: true,
        bank_statement: true,
        transaction_count: transactions.length,
        bank_name: parsed.bank_name,
        period: parsed.statement_period,
        result: parsed,
      });
    }

    // ── Single document (invoice / bill / receipt etc.) ────────────────────────
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SINGLE_DOC_PROMPT,
      messages: [{ role: "user", content: userContent as Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"] }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "{}";
    let aiResult: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiResult = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: rawText }, { status: 500 });
    }

    await supabase.from("fw_fin_documents").update({
      status: "reviewed",
      ai_summary: {
        vendor: aiResult.vendor,
        customer: aiResult.customer,
        amount: aiResult.amount,
        base_amount: aiResult.base_amount,
        gst_amount: aiResult.gst_amount,
        cgst: aiResult.cgst,
        sgst: aiResult.sgst,
        igst: aiResult.igst,
        tds_amount: aiResult.tds_amount,
        date: aiResult.date,
        invoice_no: aiResult.invoice_no,
        hsn_sac: aiResult.hsn_sac,
        items: aiResult.items,
      },
      doc_type: aiResult.doc_type as string || null,
    }).eq("id", doc_id);

    const { data: existing } = await supabase.from("fw_fin_ai_suggestions").select("id").eq("document_id", doc_id).single();
    if (!existing) {
      await supabase.from("fw_fin_ai_suggestions").insert({
        business_id,
        document_id: doc_id,
        suggested_type: aiResult.suggested_type,
        suggested_narration: aiResult.narration,
        suggested_lines: aiResult.journal_lines,
        confidence: aiResult.confidence,
        status: "pending",
      });
    }

    return NextResponse.json({ success: true, result: aiResult });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
