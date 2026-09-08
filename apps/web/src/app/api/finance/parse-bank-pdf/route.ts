import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set in environment variables. Add it in Vercel → Settings → Environment Variables." }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `This is a bank statement PDF. Extract ALL transaction rows from it.
Return ONLY a valid JSON array — no markdown fences, no explanation, nothing else before or after.
Each element must be:
{"date":"YYYY-MM-DD","description":"narration as shown","debit":0,"credit":0,"balance":0}

Rules:
- Amounts: plain numbers only (no ₹, $, commas). Use 0 if empty.
- Withdrawal / Dr / Debit column → debit field
- Deposit / Cr / Credit column → credit field
- Skip header rows and summary/total rows
- Extract every individual transaction row`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown fences if Claude wrapped it anyway
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return NextResponse.json({
        error: "AI could not extract transactions from this PDF. Try saving the statement as Excel (.xlsx) from your bank's portal and uploading that instead.",
        raw: raw.slice(0, 600),
      }, { status: 422 });
    }

    const transactions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions found in this PDF. Try downloading the statement as Excel from your bank portal." }, { status: 422 });
    }

    return NextResponse.json({ transactions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface meaningful errors
    if (msg.includes("Could not process document") || msg.includes("unsupported")) {
      return NextResponse.json({ error: "This PDF format is not supported. Download the statement as Excel (.xlsx) from your bank portal and upload that." }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
