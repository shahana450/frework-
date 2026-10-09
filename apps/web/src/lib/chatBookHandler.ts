// FreBook chat handler, shared by the Node route (messages with files) and the Edge route (typed messages).
// It never imports the file readers itself — the Node route passes them in — so it can run at the edge.
import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { getAI } from "@/lib/ai";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { intentSystemFor, loadBusinessContext, interpret as interpretWith, loadQueryBooks as loadBooksWith, type AiIntent } from "@/lib/intentEngine";
import { TOOLS, runTool, resolvePeriod, monthPeriod, type Tool, type Period } from "@/lib/bookQueries";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = getAI();


import type { Attachment } from "@/lib/attachments";
import { fileToShelf, fyOfDate } from "@/lib/shelf";

// ── POST ───────────────────────────────────────────────────────────────────────
export async function handleChatBook(req: NextRequest, deps: { readAttachment?: (f: File) => Promise<Attachment> } = {}) {
  try {
    let message = "", business_id = "", user_id = "", session_id: string | null = null;
    let bulk = false; // template bulk review: read the row only, don't save a chat session
    let attachment: Attachment | null = null;
    let uploaded: File | null = null;
    let clientHistory: unknown = null;

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      message = (form.get("message") as string) ?? "";
      business_id = (form.get("business_id") as string) ?? "";
      user_id = (form.get("user_id") as string) ?? "";
      session_id = (form.get("session_id") as string) || null;
      try { clientHistory = JSON.parse((form.get("history") as string) || "null"); } catch { /* ignore */ }
      const file = form.get("file") as File | null;
      if (file?.size) {
        if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });
        if (!deps.readAttachment) return NextResponse.json({ error: "Attach files through the main FreBook route." }, { status: 400 });
        attachment = await deps.readAttachment(file);
        uploaded = file;
      }
    } else {
      const body = await req.json();
      ({ message, business_id, user_id } = body);
      session_id = body.session_id ?? null;
      clientHistory = body.history ?? null;
      bulk = body.bulk === true;
    }

    if (!message && !attachment) return NextResponse.json({ error: "message required" }, { status: 400 });
    const gate = await requireBusiness(req, business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    user_id = gate.user.id;
    if (!message) message = "Book this transaction from the attached document.";

    // Every document given to FreBook is also kept on the Shelf (Bills & Invoices rack) — saved after the reply is sent
    if (uploaded) {
      const file = uploaded, bytes = new Uint8Array(await uploaded.arrayBuffer()), note = message && !/^book this transaction/i.test(message) ? message.slice(0, 300) : null, actor = user_id;
      after(() => fileToShelf(supabase, { businessId: business_id, actorId: actor, rack: "bills", title: file.name, fileName: file.name, mime: file.type, bytes, source: "frebook", fy: fyOfDate(new Date().toISOString().slice(0, 10)), notes: note }));
    }

    // One parallel round to the database: rate limit, saved conversation, ledgers, financial year, business
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const [{ count }, { data: sess }, { data: accounts }, { data: fy }, { data: biz }] = await Promise.all([
      bulk ? Promise.resolve({ count: 0 }) : supabase.from("fw_fin_chat_sessions").select("id", { count: "exact", head: true }).eq("user_id", user_id).eq("business_id", business_id).gte("created_at", hourAgo),
      session_id ? supabase.from("fw_fin_chat_sessions").select("messages").eq("id", session_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("fw_fin_chart_of_accounts").select("name,type,sub_type").eq("business_id", business_id).eq("is_group", false).limit(200),
      supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date,is_locked").eq("business_id", business_id).eq("is_current", true).maybeSingle(),
      loadBusinessContext(supabase, business_id).then(d => ({ data: d })),
    ]);
    if ((count ?? 0) >= 60) return NextResponse.json({ error: "Rate limit: 60 messages/hour." }, { status: 429 });

    // Session history; a new conversation gets its id now so the reply needn't wait for the save
    let history: { role: "user" | "assistant"; content: string }[] = [];
    const sessionId = session_id ?? crypto.randomUUID();
    const isNewSession = !session_id;
    if (sess?.messages) history = (sess.messages as typeof history).slice(-16);
    // Saves the conversation after the response has gone out (upsert: a quick follow-up never loses history)
    const owner = user_id, firstTitle = message.slice(0, 60);
    const saveSession = (newHistory: { role: "user" | "assistant"; content: string }[]) => after(async () => {
      const { error } = await supabase.from("fw_fin_chat_sessions").upsert({
        id: sessionId, user_id: owner, business_id, messages: newHistory, updated_at: new Date().toISOString(), ...(isNewSession ? { title: firstTitle } : {}),
      }, { onConflict: "id" });
      if (error) console.error("chat-book session save failed", error.message);
    });
    // The page's own copy of the conversation covers sessions that weren't saved
    if (!history.length && Array.isArray(clientHistory)) {
      history = clientHistory
        .filter((h): h is { role: "user" | "assistant"; content: string } =>
          !!h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.length > 0)
        .map(h => ({ role: h.role, content: h.content.slice(0, 4000) }))
        .slice(-12);
    }

    const accountList = (accounts ?? []).map(a => `${a.name} (${a.type}${a.sub_type ? "/" + a.sub_type : ""})`).join(" | ");

    const today = new Date().toLocaleDateString("en-CA");
    const contextHeader = [
      `Today: ${today}.`,
      `Business: ${biz.name || "unknown"}, Country: ${biz.country}, State: ${biz.state ?? "not set"}, Tax ID: ${biz.gstin ?? "not set"}, Base currency: ${biz.baseCurrency}.`,
      `Financial Year: ${fy?.label ?? "unknown"} (${fy?.start_date} to ${fy?.end_date})${fy?.is_locked ? " — PERIOD LOCKED" : ""}.`,
      `Available Accounts: ${accountList || "Cash in Hand, HDFC Bank, Sales, Purchases, Debtors Control, Creditors Control, Capital Account"}.`,
      attachment ? `\nAttached file: ${attachment.name}.${attachment.text ? `\nFile contents:\n${attachment.text}` : " (see attached document)"}` : "",
    ].filter(Boolean).join(" ");

    // Detect pending clarification
    const lastAssistant = history.length > 0 ? history[history.length - 1] : null;
    const pendingQ = lastAssistant?.role === "assistant" && !lastAssistant.content.trim().startsWith("{") ? lastAssistant.content.trim() : null;

    let claudeMessages: Anthropic.MessageParam[];
    let userTurn: string;

    if (pendingQ) {
      // Only the turns since the last finished entry belong to this transaction
      let start = 0;
      history.forEach((h, i) => { if (h.role === "assistant" && h.content.trim().startsWith("{")) start = i + 1; });
      const thread = history.slice(start);
      const priorUser = thread.filter(h => h.role === "user").map(h => h.content).join("; ");
      const askedSoFar = thread.filter(h => h.role === "assistant").map(h => h.content).join(" | ");
      userTurn = `${contextHeader}\n\nThis is a follow-up in an ongoing conversation about ONE transaction.\nWhat the user said so far: "${priorUser}".\nQuestions you already asked: "${askedSoFar}".\nThe user's latest answer: "${message}".\nCombine everything above — do not ask again for anything already given. Return the full JSON for this ONE transaction with every fact gathered so far; leave "missing" empty unless something essential is still genuinely unknown.`;
      claudeMessages = [{ role: "user", content: userTurn }];
    } else {
      userTurn = `${contextHeader}\n\nUser message: ${message}`;
      claudeMessages = [
        // Only the last 3 exchanges: enough for follow-ups, far less for the model to read
        ...history.slice(-6).map(h => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
        { role: "user", content: userTurn },
      ];
    }

    if (attachment?.blocks.length) {
      const last = claudeMessages[claudeMessages.length - 1];
      claudeMessages[claudeMessages.length - 1] = { role: "user", content: [...attachment.blocks, { type: "text", text: last.content as string }] };
    }

    // A PDF/photo may hold several vouchers (one per page or several per page). List them all first;
    // more than one → the page opens bulk review, where each voucher is drafted and posted separately.
    if (attachment && !pendingQ) {
      try {
        const split = await anthropic.messages.create({
          model: "claude-sonnet-4-6", max_tokens: 8000,
          system: `You list the separate accounting vouchers inside a document for an Indian business (${biz.name || "the business"}, state ${biz.state ?? "unknown"}, GSTIN ${biz.gstin ?? "none"}).
A voucher = one invoice, bill, receipt, payment voucher, journal voucher, credit/debit note or expense slip. Read EVERY page. Pages that continue the same voucher are ONE voucher.
If the document is a bank statement or passbook, reply {"kind":"bank_statement"} only.
Otherwise reply JSON only: {"kind":"vouchers","vouchers":["..."]} — one plain sentence per voucher with every fact shown: type (sale/purchase/expense/receipt/payment/journal/credit note/debit note), date (YYYY-MM-DD), party name, voucher/invoice number, description, taxable value, GST rate and amounts (CGST/SGST/IGST), total, TDS if shown, and how it was paid (cash/bank name/credit) if shown. Example: "Purchase bill B-552 dated 2026-09-03 from XYZ Suppliers for raw material, taxable 50000 plus 12% GST (CGST 3000, SGST 3000), total 56000, on credit".
Never invent facts; leave out what is not shown.`,
          messages: [{ role: "user", content: [...attachment.blocks, { type: "text", text: `File: ${attachment.name}.${attachment.text ? `\nContents:\n${attachment.text.slice(0, 60000)}` : ""}\nUser note: ${message}\nList the vouchers.` }] }],
        });
        const sraw = split.content[0].type === "text" ? split.content[0].text : "";
        const sj = JSON.parse(sraw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { kind?: string; vouchers?: unknown[] };
        const list = (sj.vouchers ?? []).filter((v): v is string => typeof v === "string" && v.trim().length > 8).map(v => v.trim().slice(0, 600));
        if (sj.kind === "vouchers" && list.length > 1) {
          const note = message && !/^book this transaction/i.test(message) ? ` (user note: ${message.slice(0, 200)})` : "";
          return NextResponse.json({ multi: { file: attachment.name, sentences: list.slice(0, 200).map((v, i) => `Voucher ${i + 1} from ${attachment!.name}: ${v}${note}`) } });
        }
      } catch (e) { console.error("chat-book voucher split", e); /* fall back to reading it as one voucher */ }
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1500,
      system: intentSystemFor(biz), messages: claudeMessages,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "I couldn't understand that. Try describing it as e.g. \"Paid ₹25,000 rent from HDFC Bank\"." }, { status: 422 });

    let ai: AiIntent;
    try { ai = JSON.parse(jsonMatch[0]); } catch { return NextResponse.json({ error: "I couldn't understand that. Please rephrase." }, { status: 422 }); }

    // A question about the books: compute the answer from posted entries
    if (ai.kind === "query") {
      const tool = (TOOLS as readonly string[]).includes(ai.tool ?? "") ? ai.tool as Tool : "search";
      const fyPeriod: Period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${fy.label}` } : { from: "2000-01-01", to: today, label: "all time" };
      const defaultP = tool === "compare" ? monthPeriod(today, 0) : fyPeriod;
      const p = resolvePeriod(ai.period, defaultP);
      const p2 = resolvePeriod(ai.period2, tool === "compare" ? monthPeriod(p.from, -1) : fyPeriod);
      const loadUntil = [p.to, p2.to, today].sort().pop()!;
      const books = await loadBooksWith(supabase, business_id, loadUntil);
      if (books.error) return serverError("chat-book/query", books.error, "I couldn't read your books right now. Please try again.");
      const answer = runTool(tool, books.accounts, books.journals, ai.params ?? {}, { p, p2, today }, { currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
      const newHistory = [...history, { role: "user" as const, content: message }, { role: "assistant" as const, content: JSON.stringify({ kind: "answer", tool, summary: answer.summary }) }].slice(-20);
      saveSession(newHistory);
      return NextResponse.json({ answer: { ...answer, tool }, session_id: sessionId });
    }
    const parsed = await interpretWith(supabase, ai, accounts ?? [], business_id, today, biz);

    // Period lock check
    if (parsed.status === "complete" && fy?.is_locked) {
      parsed.warnings.push("⚠ This accounting period is locked. Transaction cannot be posted without administrator authorization.");
    }

    // Duplicate detection
    let duplicate = null;
    if (parsed.status === "complete" && parsed.transaction_date && parsed.amount > 0) {
      const { data: dupes } = await supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type").eq("business_id", business_id).eq("date", parsed.transaction_date).eq("status", "posted").limit(10);
      if (dupes?.length) {
        const match = dupes.find(d => {
          const amtMatch = d.narration?.toLowerCase().includes(String(Math.round(parsed.amount)));
          const partyMatch = parsed.party_name ? d.narration?.toLowerCase().includes(parsed.party_name.toLowerCase()) : false;
          return amtMatch || partyMatch;
        });
        if (match) duplicate = { entry_no: match.entry_no, date: match.date, narration: match.narration };
      }
    }

    if (bulk) return NextResponse.json({ parsed, session_id: null, duplicate, fy_locked: !!fy?.is_locked });

    // Persist session
    const histContent = message + (attachment ? ` [Attached ${attachment.name}: ${parsed.document_summary ?? "document"}]` : "");
    const assistantContent = parsed.status === "needs_clarification" && parsed.needs_clarification.length > 0 ? parsed.needs_clarification[0] : raw;
    const newHistory = [...history, { role: "user" as const, content: histContent }, { role: "assistant" as const, content: assistantContent }].slice(-20);

    saveSession(newHistory);
    return NextResponse.json({ parsed, session_id: sessionId, duplicate, fy_locked: !!fy?.is_locked });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Gemini (429|503)|high demand|overloaded/i.test(msg)) return serverError("chat-book", e, "The AI is busy right now. Please try again in a minute.");
    return serverError("chat-book", e, "I couldn't process that. Please try again.");
  }
}