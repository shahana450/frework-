import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getAI } from "@/lib/ai";
import { loadQueryBooks } from "@/lib/intentEngine";
import { runTool, monthPeriod, type Period } from "@/lib/bookQueries";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = getAI();

export async function POST(req: NextRequest) {
  try {
    const { message, business_id, history } = await req.json();
    const gate = await requireBusiness(req, business_id);
    if (gate instanceof NextResponse) return gate;
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

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

    // Real figures from the books (the same calculations as FreBook's answers) — the AI explains them, never estimates
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const facts: string[] = [];
    try {
      const books = await loadQueryBooks(supabase, business_id, today);
      if (!books.error) {
        const fyP: Period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${fy.label}` } : { from: "2000-01-01", to: today, label: "all time" };
        const thisM = monthPeriod(today, 0), lastM = monthPeriod(today, -1);
        const ask = (tool: Parameters<typeof runTool>[0], p: Period, params: Record<string, unknown> = {}) => {
          const a = runTool(tool, books.accounts, books.journals, params, { p, p2: p, today }, { currency: "INR", locale: "en-IN" });
          const rows = a.table?.rows.slice(0, 8).map(r => "  - " + r.join(" | ")).join("\n") ?? "";
          return `### ${a.title} (${p.label})\n${a.summary}${rows ? `\n${a.table!.columns.join(" | ")}\n${rows}` : ""}`;
        };
        facts.push(ask("gst_summary", thisM), ask("gst_summary", lastM), ask("profit_loss", thisM), ask("profit_loss", fyP),
          ask("receivables", fyP), ask("payables", fyP), ask("balances", fyP), ask("top_expenses", fyP, { limit: 5 }));
      }
    } catch (e) { console.error("virtual-ca facts", e); }

    const systemPrompt = `You are FreWork AI — the AI financial co-pilot for FreWork Finance. Your tagline is "." You are helping the owner of "${biz?.name ?? "a business"}". You are an expert Chartered Accountant (CA) and financial advisor specialising in Indian accounting, GST, Income Tax, and compliance.

BUSINESS CONTEXT:
- Business: ${biz?.name} (${biz?.business_type ?? "business"})
- State: ${biz?.state ?? "India"}
- GSTIN: ${biz?.gstin ?? "Not registered"}
- GST Type: ${biz?.gst_registration_type ?? "unregistered"}
- Current FY: ${fy?.label ?? "2024-25"} (${fy?.start_date ?? "01 Apr 2024"} to ${fy?.end_date ?? "31 Mar 2025"})
- Documents uploaded: ${docs.length} (${docs.filter(d => d.status === "pending").length} pending review)
- Recent posted entries looked at: ${journals.length}
- Today: ${today}

FIGURES FROM THE BOOKS (exact — computed from posted entries; use these, quote them, never estimate):
${facts.length ? facts.join("\n\n") : "(The books couldn't be read just now — say so and suggest checking Reports.)"}

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
- For any question about amounts (GST owed, profit, dues, cash), answer FIRST with the exact figure from FIGURES FROM THE BOOKS, then explain briefly
- GST payable this month = Output GST − Input GST from the GST summary above; if it is negative, say it is a credit carried forward
- Never make up numbers that are not above. If a figure isn't there, say what to record or where to look in FreBook
- Format: short paragraphs and bullet points in plain Markdown. NEVER use LaTeX or $ formulas — write formulas in words (e.g. "Output GST − Input GST")
- Mention the due date when relevant (GSTR-3B by the 20th of next month for monthly filers)`;

    const messages: Anthropic.MessageParam[] = [
      ...((history ?? []) as Array<{ role: string; content: string }>).map(h => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
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
