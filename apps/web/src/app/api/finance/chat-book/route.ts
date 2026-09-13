import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are a double-entry bookkeeping engine for Indian SMBs. Your ONLY output is valid JSON — no prose, no markdown, no explanation.

RULES:
1. Always use double-entry: sum(debit) MUST equal sum(credit). If you cannot balance, set needs_clarification.
2. Default date = today (passed in context). Use YYYY-MM-DD format.
3. Default state = Kerala → intra-state GST → split into CGST + SGST equally. If user says inter-state → IGST only.
4. NEVER invent amounts. If amount is missing, add it to needs_clarification.
5. If confidence < 0.75 or debits ≠ credits, populate needs_clarification[].
6. GST accounts: "CGST Payable", "SGST Payable", "IGST Payable", "Input CGST", "Input SGST", "Input IGST".
7. Common accounts: Cash, Bank, Sales, Purchases, Rent Expense, Salary Expense, Stationery Expense, Debtors Control, Creditors Control, Capital Account, Drawings.
8. For sales: Dr Debtors/Cash/Bank, Cr Sales + GST Payable accounts.
9. For purchases: Dr Purchases + Input GST, Cr Cash/Bank/Creditors.
10. For expenses: Dr [Expense Account], Cr Cash/Bank.
11. For receipts from debtors: Dr Cash/Bank, Cr Debtors Control.

OUTPUT SCHEMA (strict JSON, no other text):
{
  "date": "YYYY-MM-DD",
  "narration": "string (clear description for ledger)",
  "type": "sales|purchase|payment|receipt|journal|expense",
  "lines": [
    { "account": "exact account name", "debit": 0, "credit": 0 }
  ],
  "gst": { "rate": 18, "cgst": 0, "sgst": 0, "igst": 0 } | null,
  "party": "party name | null",
  "reference": "invoice/ref number | null",
  "confidence": 0.95,
  "needs_clarification": []
}`;

type ParsedEntry = {
  date: string;
  narration: string;
  type: string;
  lines: { account: string; debit: number; credit: number }[];
  gst: { rate: number; cgst: number; sgst: number; igst: number } | null;
  party: string | null;
  reference: string | null;
  confidence: number;
  needs_clarification: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { message, business_id, user_id, session_id } = await req.json();
    if (!message || !business_id || !user_id) {
      return NextResponse.json({ error: "message, business_id, user_id required" }, { status: 400 });
    }

    // Rate limit: 30 messages/user/hour
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("fw_fin_chat_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("business_id", business_id)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 30) {
      return NextResponse.json({ error: "Rate limit: 30 messages/hour. Please wait." }, { status: 429 });
    }

    // Load existing session context (last 10 messages)
    let history: { role: "user" | "assistant"; content: string }[] = [];
    let chatSessionId = session_id;
    if (session_id) {
      const { data: sess } = await supabase
        .from("fw_fin_chat_sessions")
        .select("messages")
        .eq("id", session_id)
        .single();
      if (sess?.messages) history = (sess.messages as typeof history).slice(-10);
    }

    // Fetch chart of accounts for context
    const { data: accounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("name, type")
      .eq("business_id", business_id)
      .eq("is_group", false)
      .limit(100);
    const accountList = (accounts ?? []).map(a => `${a.name} (${a.type})`).join(", ");

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const contextNote = `Today is ${today}. Available accounts: ${accountList || "Cash, Bank, Sales, Purchases, Debtors Control, Creditors Control, Capital Account"}.`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: `${contextNote}\n\nUser: ${message}` },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Extract JSON even if model adds minimal wrapper
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse response. Please rephrase." }, { status: 422 });
    }
    const parsed: ParsedEntry = JSON.parse(jsonMatch[0]);

    // Validate: debits === credits
    const totalDr = parsed.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCr = parsed.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDr - totalCr) > 0.01) {
      parsed.needs_clarification.push(`Entry is unbalanced: Dr ₹${totalDr} ≠ Cr ₹${totalCr}. Please provide more details.`);
      parsed.confidence = Math.min(parsed.confidence, 0.5);
    }

    // Log message to chat session
    const newHistory = [
      ...history,
      { role: "user" as const, content: message },
      { role: "assistant" as const, content: raw },
    ].slice(-20);

    if (chatSessionId) {
      await supabase.from("fw_fin_chat_sessions").update({ messages: newHistory, updated_at: new Date().toISOString() }).eq("id", chatSessionId);
    } else {
      const { data: newSess } = await supabase
        .from("fw_fin_chat_sessions")
        .insert({ user_id, business_id, messages: newHistory })
        .select("id")
        .single();
      chatSessionId = newSess?.id ?? null;
    }

    return NextResponse.json({ parsed, session_id: chatSessionId, balanced: Math.abs(totalDr - totalCr) < 0.01 });
  } catch (e) {
    console.error("chat-book error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
