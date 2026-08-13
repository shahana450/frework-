import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are an expert Indian chartered accountant and bookkeeper. Analyze the provided document text and extract financial information.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
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
    {"account_name": "exact account name from Indian chart of accounts", "dr": number, "cr": number}
  ],
  "confidence": number between 0 and 1,
  "items": [{"description": "string", "qty": number, "rate": number, "amount": number}] or []
}

For Indian GST invoices: separate CGST/SGST (intra-state) or IGST (inter-state).
Common account names: "Accounts Receivable (Debtors)", "Accounts Payable (Creditors)", "Sales / Revenue", "GST Payable - CGST", "GST Payable - SGST", "GST Payable - IGST", "GST Input Tax Credit", "Cash in Hand", "Bank Accounts", "TDS Payable", "TDS Receivable".
Journal entries must always balance: total debits must equal total credits.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, doc_id, business_id } = body;

    if (!text || !doc_id || !business_id) {
      return NextResponse.json({ error: "text, doc_id, and business_id required" }, { status: 400 });
    }

    // Call Claude AI
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Analyze this document and extract financial data:\n\n${text.slice(0, 4000)}`,
      }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "{}";
    let aiResult: Record<string, unknown>;
    try {
      // Strip any markdown fences if present
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiResult = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: rawText }, { status: 500 });
    }

    // Update the document record with AI analysis
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

    // Create AI suggestion
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
