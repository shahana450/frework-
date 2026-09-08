import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `This is a bank statement PDF. Extract ALL transactions from it.
Return ONLY a JSON array with no markdown, no explanation. Each element:
{
  "date": "YYYY-MM-DD",
  "description": "narration/description as shown",
  "debit": number or 0,
  "credit": number or 0,
  "balance": number or 0
}
Rules:
- Amounts must be numbers (no currency symbols, no commas)
- If a column says "Withdrawal" or "Dr" it is debit
- If a column says "Deposit" or "Cr" it is credit
- Ignore header rows, opening/closing balance summary rows
- Extract every transaction row`;

    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not parse PDF", raw: text.slice(0, 500) }, { status: 422 });

    const transactions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ transactions });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
