import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Extract facts from plain text (amount, mode, party) ───────────────────────
function extractFacts(texts: string[]): { amount?: number; mode?: string; party?: string } {
  const combined = texts.join(" ");
  // Amount: ₹1,23,456 or Rs 5000 or plain 5000
  const amtMatch = combined.match(/(?:₹|rs\.?\s*)[\s]?([0-9,]+(?:\.[0-9]{1,2})?)/i)
    ?? combined.match(/\b([0-9]{3,}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\b/);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : undefined;
  // Payment mode
  const modeMatch = combined.match(/\b(cash|bank|upi|neft|rtgs|imps|cheque|check|online|hdfc|sbi|icici|axis|kotak)\b/i);
  const mode = modeMatch ? modeMatch[1].toLowerCase() : undefined;
  // Party: "from X", "to X", "by X" — simple heuristic
  const partyMatch = combined.match(/(?:from|to|by|paid to|received from|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  const party = partyMatch ? partyMatch[1].trim() : undefined;
  return { amount, mode, party };
}

const SYSTEM_PROMPT = `You are a double-entry bookkeeping engine for Indian SMBs. Output ONLY valid JSON — no prose, no markdown.

CRITICAL BEHAVIOUR RULES:
1. Read the ENTIRE conversation history to extract facts. Never ask again for something already given.
2. Ask ONLY ONE clarifying question at a time — the single most important missing fact.
   Priority: amount (if zero/unknown) > party name (for payables/receivables) > payment mode (only if truly unclear).
3. If you have enough info to build a balanced entry, DO IT — show the entry, don't ask more questions.
4. "known_facts" in the context tells you what has already been extracted — use these directly.
5. Payment mode heuristics: if "by cash/cash" → Cash account. If "by bank/UPI/NEFT/online/bank name" → use the named bank account or "ICICI Bank" as default. If unclear and amount > 10000, assume bank.
6. Account name heuristics from available accounts list — always pick the closest match.

ACCOUNTING RULES:
- Double-entry: sum(debit) MUST equal sum(credit). Never produce unbalanced entries.
- Default date = today (in context). Format: YYYY-MM-DD.
- Kerala default → intra-state → CGST + SGST equally split. Inter-state mentioned → IGST only.
- GST accounts: "CGST Payable","SGST Payable","IGST Payable","Input CGST","Input SGST","Input IGST".
- Sales: Dr Cash/Bank/Debtor → Cr Sales + GST Payable.
- Purchase: Dr Purchases + Input GST → Cr Cash/Bank/Creditor.
- Expense: Dr [Expense Account] → Cr Cash/Bank.
- Salary: Dr [Employee Salary Expense] → Cr Cash/Bank (direct pay) or Cr [Employee Payable] (accrual).
- Receipt from customer: Dr Cash/Bank → Cr Debtors Control / customer ledger.
- Payment to vendor: Dr Creditors Control / vendor ledger → Cr Cash/Bank.

OUTPUT SCHEMA (strict JSON, no other text):
{
  "date": "YYYY-MM-DD",
  "narration": "string",
  "type": "sales|purchase|payment|receipt|journal|expense",
  "lines": [{"account": "exact account name", "debit": 0, "credit": 0}],
  "gst": {"rate": 18, "cgst": 0, "sgst": 0, "igst": 0} | null,
  "party": "name | null",
  "reference": "ref | null",
  "confidence": 0.95,
  "needs_clarification": ["ONE question only, or empty array if entry is complete"]
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

async function extractFileContent(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mime = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
    return `[File attached: ${file.name} — ${file.type}. Extract any transaction amounts, dates, parties, or descriptions visible in this document.]`;
  }

  // Use Claude Vision to extract bill/receipt details
  const visionResp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: [{
        type: "image",
        source: { type: "base64", media_type: mime, data: base64 },
      }, {
        type: "text",
        text: "You are reading a bill, receipt, or invoice image. Extract ALL of: total amount, date, vendor/party name, item descriptions, GST/tax amounts if shown, invoice/receipt number. Output as a single concise line: 'Bill from [party] dated [date] for ₹[amount]. Items: [brief]. Ref: [number if any]. GST: [if shown]'. If it's not a financial document, describe what you see briefly.",
      }],
    }],
  });

  return visionResp.content[0].type === "text"
    ? `[Image analysis: ${visionResp.content[0].text}]`
    : `[Image attached: ${file.name}]`;
}

export async function POST(req: NextRequest) {
  try {
    let message: string, business_id: string, user_id: string, session_id: string | null = null;
    let fileContext = "";

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      message = (form.get("message") as string) ?? "";
      business_id = (form.get("business_id") as string) ?? "";
      user_id = (form.get("user_id") as string) ?? "";
      session_id = (form.get("session_id") as string) || null;
      const file = form.get("file") as File | null;
      if (file && file.size > 0) {
        fileContext = await extractFileContent(file);
      }
    } else {
      const body = await req.json();
      ({ message, business_id, user_id } = body);
      session_id = body.session_id ?? null;
    }

    if (!message && !fileContext) {
      return NextResponse.json({ error: "message or file required" }, { status: 400 });
    }
    if (!business_id || !user_id) {
      return NextResponse.json({ error: "business_id, user_id required" }, { status: 400 });
    }
    if (!message) message = "Book this transaction from the attached document.";

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

    // Load existing session context (last 12 messages)
    let history: { role: "user" | "assistant"; content: string }[] = [];
    let chatSessionId = session_id;
    if (session_id) {
      const { data: sess } = await supabase
        .from("fw_fin_chat_sessions")
        .select("messages")
        .eq("id", session_id)
        .single();
      if (sess?.messages) history = (sess.messages as typeof history).slice(-12);
    }

    // Pre-extract facts from entire conversation so far (including current message)
    const allUserTexts = [
      ...history.filter(h => h.role === "user").map(h => h.content),
      message,
    ];
    const knownFacts = extractFacts(allUserTexts);

    // Fetch chart of accounts for context
    const { data: accounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("name, type")
      .eq("business_id", business_id)
      .eq("is_group", false)
      .limit(150);
    const accountList = (accounts ?? []).map(a => `${a.name} (${a.type})`).join(", ");

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const factsNote = [
      knownFacts.amount ? `known amount: ₹${knownFacts.amount}` : "",
      knownFacts.mode ? `known payment mode: ${knownFacts.mode}` : "",
      knownFacts.party ? `known party: ${knownFacts.party}` : "",
    ].filter(Boolean).join("; ");

    const contextNote = [
      `Today: ${today}.`,
      factsNote ? `Known facts from conversation: ${factsNote}. Use these — do not ask for them again.` : "",
      `Available accounts: ${accountList || "Cash, ICICI Bank, Sales, Purchases, Debtors Control, Creditors Control, Capital Account"}.`,
    ].filter(Boolean).join(" ");

    const fullUserMessage = [
      contextNote,
      fileContext ? `\n${fileContext}` : "",
      `\n\nUser message: ${message}`,
    ].join("");

    const claudeMessages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: fullUserMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse response. Please rephrase." }, { status: 422 });
    }
    const parsed: ParsedEntry = JSON.parse(jsonMatch[0]);

    // Keep only ONE clarification question
    if (parsed.needs_clarification.length > 1) {
      parsed.needs_clarification = [parsed.needs_clarification[0]];
    }

    // Validate balance
    const totalDr = parsed.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCr = parsed.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.01;
    if (!balanced && !parsed.needs_clarification.length) {
      parsed.needs_clarification = [`Entry doesn't balance (Dr ₹${totalDr} ≠ Cr ₹${totalCr}). What's the correct amount?`];
    }

    // Persist session
    const historyUserContent = fileContext ? `${message} ${fileContext}` : message;
    const newHistory = [
      ...history,
      { role: "user" as const, content: historyUserContent },
      { role: "assistant" as const, content: raw },
    ].slice(-20);

    if (chatSessionId) {
      await supabase.from("fw_fin_chat_sessions").update({ messages: newHistory, updated_at: new Date().toISOString() }).eq("id", chatSessionId);
    } else {
      const { data: newSess } = await supabase
        .from("fw_fin_chat_sessions").insert({ user_id, business_id, messages: newHistory }).select("id").single();
      chatSessionId = newSess?.id ?? null;
    }

    return NextResponse.json({ parsed, session_id: chatSessionId, balanced });
  } catch (e) {
    console.error("chat-book error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
