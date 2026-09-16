import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SYSTEM_PROMPT = `You are a WhatsApp bookkeeping bot for Indian SMBs.
The user sends a transaction in natural language (Hindi or English, or Hinglish).
Parse it into a double-entry journal entry and reply in a CLEAR WhatsApp-style message.

Format your reply as:
📒 *[Narration]*

[Account Name] Dr ₹[amount]
[Account Name] Cr ₹[amount]

Reply *YES* to post, *NO* to cancel.

Rules:
- Keep the reply short and clear
- Use ₹ symbol always
- If unclear, ask ONE question only
- Support: expenses, sales, receipts, payments, purchases
- Handle GST: for goods/services with GST, split into taxable + GST accounts
- Support Hinglish: "200 ka petrol diya cash mein" = Petrol Expense Dr ₹200, Cash Cr ₹200`;

async function sendWhatsAppReply(to: string, message: string, phoneId: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });
}

// GET: webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "frework_wh_2026";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: incoming message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") {
      return NextResponse.json({ status: "ignored" });
    }

    const from = message.from; // phone number
    const text = message.text?.body ?? "";

    // Find the business linked to this WhatsApp number
    const { data: business } = await supabase
      .from("fw_fin_businesses")
      .select("id,name,whatsapp_number")
      .eq("whatsapp_number", from)
      .single();

    // Get phone ID and token from env
    const phoneId = process.env.WHATSAPP_PHONE_ID ?? "";
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";

    if (!business) {
      await sendWhatsAppReply(from, "❌ This WhatsApp number is not registered with FreWork Finance. Visit frework.online to get started.", phoneId, accessToken);
      return NextResponse.json({ status: "unregistered" });
    }

    // Check if this is a YES/NO confirmation
    const upperText = text.trim().toUpperCase();
    if (upperText === "YES" || upperText === "HAN" || upperText === "HA") {
      // Find pending entry in session
      const { data: session } = await supabase
        .from("fw_fin_whatsapp_sessions")
        .select("pending_entry")
        .eq("phone", from)
        .eq("business_id", business.id)
        .single();

      if (session?.pending_entry) {
        // Post the journal
        const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", business.id);
        const entry_no = `JV-${String((count ?? 0) + 1).padStart(4, "0")}`;
        const parsed = session.pending_entry as { narration: string; date: string; lines: { account: string; debit: number; credit: number }[] };

        const { data: journal } = await supabase.from("fw_fin_journals").insert({
          business_id: business.id, date: parsed.date, narration: parsed.narration,
          type: "journal", status: "posted", entry_no,
          total_debit: parsed.lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0),
          total_credit: parsed.lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0),
        }).select("id").single();

        if (journal?.id) {
          await supabase.from("fw_fin_journal_lines").insert(
            parsed.lines.map((l: { account: string; debit: number; credit: number }, i: number) => ({
              journal_id: journal.id, business_id: business.id,
              account_name: l.account, debit: l.debit, credit: l.credit, sort_order: i,
            }))
          );
          await supabase.from("fw_fin_whatsapp_sessions").upsert({ phone: from, business_id: business.id, pending_entry: null });
          await sendWhatsAppReply(from, `✅ Posted as *${entry_no}*!\n\nYour books are updated. Send another transaction anytime.`, phoneId, accessToken);
        }
      } else {
        await sendWhatsAppReply(from, "Nothing pending to post. Send a transaction to book it.", phoneId, accessToken);
      }
      return NextResponse.json({ status: "confirmed" });
    }

    if (upperText === "NO" || upperText === "NAI" || upperText === "NAHI") {
      await supabase.from("fw_fin_whatsapp_sessions").upsert({ phone: from, business_id: business.id, pending_entry: null });
      await sendWhatsAppReply(from, "❌ Cancelled. Send another transaction whenever you're ready.", phoneId, accessToken);
      return NextResponse.json({ status: "cancelled" });
    }

    // Parse transaction with AI
    const today = new Date().toISOString().slice(0, 10);
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Business: ${business.name}. Today: ${today}. Message: "${text}"` }],
    });

    const aiReply = response.content[0].type === "text" ? response.content[0].text.trim() : "Could not parse. Please rephrase.";

    // Try to extract structured entry for pending confirmation
    const structuredPrompt = `Extract JSON from this bookkeeping scenario (today: ${today}, business: ${business.name}): "${text}"
Return ONLY: {"narration":"...","date":"YYYY-MM-DD","lines":[{"account":"...","debit":0,"credit":0}]}`;

    const structured = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: structuredPrompt }],
    });

    const structuredRaw = structured.content[0].type === "text" ? structured.content[0].text : "";
    const jsonMatch = structuredRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const entry = JSON.parse(jsonMatch[0]);
        await supabase.from("fw_fin_whatsapp_sessions").upsert({ phone: from, business_id: business.id, pending_entry: entry, updated_at: new Date().toISOString() });
      } catch { /* ignore */ }
    }

    await sendWhatsAppReply(from, aiReply, phoneId, accessToken);
    return NextResponse.json({ status: "processed" });
  } catch (e) {
    console.error("whatsapp-webhook error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
