import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { message, business_id, history } = await req.json();
    if (!message || !business_id) return NextResponse.json({ error: "message and business_id required" }, { status: 400 });

    // Fetch business context
    const [bizRes, fyRes, docsRes, journalRes] = await Promise.all([
      supabase.from("fw_fin_businesses").select("name,gstin,gst_registration_type,business_type,state").eq("id", business_id).single(),
      supabase.from("fw_fin_financial_years").select("label,start_date,end_date").eq("business_id", business_id).eq("is_current", true).single(),
      supabase.from("fw_fin_documents").select("id,status").eq("business_id", business_id),
      supabase.from("fw_fin_journals").select("id,status,total_debit,total_credit,type,date").eq("business_id", business_id).eq("status", "posted").order("date", { ascending: false }).limit(20),
    ]);

    const biz = bizRes.data;
    const fy = fyRes.data;
    const docs = docsRes.data ?? [];
    const journals = journalRes.data ?? [];
    const totalRevenue = journals.filter(j => j.type === "sales").reduce((s, j) => s + (j.total_credit || 0), 0);
    const totalExpense = journals.filter(j => ["purchase", "expense", "payment"].includes(j.type)).reduce((s, j) => s + (j.total_debit || 0), 0);

    const systemPrompt = `You are FrePilot — the AI financial co-pilot for FreWork Finance. Your tagline is "You Build, We Pilot." You are helping the owner of "${biz?.name ?? "a business"}". You are an expert Chartered Accountant (CA) and financial advisor specialising in Indian accounting, GST, Income Tax, and compliance.

BUSINESS CONTEXT:
- Business: ${biz?.name} (${biz?.business_type ?? "business"})
- State: ${biz?.state ?? "India"}
- GSTIN: ${biz?.gstin ?? "Not registered"}
- GST Type: ${biz?.gst_registration_type ?? "unregistered"}
- Current FY: ${fy?.label ?? "2024-25"} (${fy?.start_date ?? "01 Apr 2024"} to ${fy?.end_date ?? "31 Mar 2025"})
- Documents uploaded: ${docs.length} (${docs.filter(d => d.status === "pending").length} pending review)
- Posted journal entries: ${journals.length}
- Approximate Revenue this FY: ₹${totalRevenue.toLocaleString("en-IN")}
- Approximate Expenses this FY: ₹${totalExpense.toLocaleString("en-IN")}
- Estimated Net Profit: ₹${(totalRevenue - totalExpense).toLocaleString("en-IN")}

You are an expert in:
- Indian accounting (double-entry, Tally, GST)
- Income Tax Act, GST Act, Companies Act
- IND AS / Indian GAAP
- TDS, PF, ESI, Professional Tax
- GST returns (GSTR-1, GSTR-3B, GSTR-9)
- ITR filing for businesses
- Financial analysis and advice

RULES:
- Always give practical, actionable advice
- Use Indian accounting terminology
- Quote relevant sections of tax laws when applicable
- Use ₹ for amounts, Indian number formatting (lakhs, crores)
- Be concise but complete
- If asking about specific numbers, reference the business context above
- Never make up numbers not in the context`;

    const messages: Anthropic.MessageParam[] = [
      ...((history ?? []) as Array<{ role: string; content: string }>).map(h => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    // Save chat to DB (optional - store history)
    await supabase.from("fw_fin_virtual_ca_chats").insert({
      business_id,
      user_message: message,
      assistant_reply: reply,
    }).then(() => {}); // Non-fatal if table doesn't exist yet

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
