import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusiness } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { fileToShelf, fyOfDate } from "@/lib/shelf";
import { parseStatementGrid } from "@/lib/bankExcel";
import { checkStatementPages, addStatementPages } from "@/lib/statementQuota";

export const maxDuration = 300;
import { getAI, aiConfigured } from "@/lib/ai";

export async function POST(req: NextRequest) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not set in environment variables. Add it in Vercel → Settings → Environment Variables." }, { status: 500 });
  }

  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const anthropic = getAI();

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const lower = file.name.toLowerCase();

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // The business it's for: its owner's plan sets the monthly page allowance. Only a business this user can open counts.
    const bizIdRaw = (form.get("business_id") as string) || "";
    const bizGate = bizIdRaw ? await requireBusiness(req, bizIdRaw) : null;
    const quotaBiz = bizGate && !(bizGate instanceof NextResponse) ? bizIdRaw : null;
    // Keep a copy on the business's Shelf (Bank rack). Best effort — never blocks reading the statement.
    // Big PDFs arrive in page batches; only the first batch is filed (shelf=0 on the rest).
    const shelfBiz = form.get("shelf") === "0" ? "" : bizIdRaw;
    if (shelfBiz) {
      const gate = await requireBusiness(req, shelfBiz, { write: true });
      if (!(gate instanceof NextResponse)) {
        await fileToShelf(sb, { businessId: shelfBiz, actorId: gate.user.id, rack: "bank", title: `Bank statement · ${file.name}`, fileName: file.name, mime: file.type, bytes: new Uint8Array(bytes), source: "statement", docType: "Bank statement", fy: fyOfDate(new Date().toISOString().slice(0, 10)) });
      }
    }
    let docBlock: { type: "document" | "image"; source: { type: "base64"; media_type: string; data: string } } | null = null;
    let sheetText = "";
    if (/\.(xlsx|xls|csv)$/.test(lower)) {
      const XLSX = await import("xlsx");
      const wb = lower.endsWith(".csv") ? XLSX.read(bytes.toString("utf8"), { type: "string", raw: true }) : XLSX.read(bytes, { type: "buffer", cellDates: true });
      // Spreadsheets are read directly — exact, instant, any length. The AI is only a fallback for odd layouts.
      let best: ReturnType<typeof parseStatementGrid> | null = null;
      for (const s of wb.SheetNames.slice(0, 5)) {
        const r = parseStatementGrid(XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: "", raw: true }) as unknown[][]);
        if (!best || r.rows.length > best.rows.length) best = r;
      }
      if (best && best.rows.length) return NextResponse.json({ transactions: best.rows, read_by: "sheet" });
      sheetText = wb.SheetNames.slice(0, 3).map(s => XLSX.utils.sheet_to_csv(wb.Sheets[s], { blankrows: false, dateNF: "yyyy-mm-dd" })).join("\n").slice(0, 200000);
    } else if (/\.txt$/.test(lower)) {
      // A password-protected PDF, unlocked and turned into text in the browser
      sheetText = bytes.toString("utf8").slice(0, 200000);
    } else if (file.type.startsWith("image/")) {
      docBlock = { type: "image", source: { type: "base64", media_type: file.type, data: bytes.toString("base64") } };
    } else {
      docBlock = { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } };
    }

    // Pages the AI will read count against the month's allowance (spreadsheets above never reach here unless their layout is odd)
    let pages = 0;
    if (docBlock?.type === "image") pages = 1;
    else if (/\.txt$/.test(lower)) pages = sheetText.split("\f").length;
    else if (docBlock) { try { const { PDFDocument } = await import("pdf-lib"); pages = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch { pages = 1; } }
    const quota = await checkStatementPages(sb, quotaBiz, user.email, pages);
    if (!quota.ok) return NextResponse.json({ error: quota.error, code: "page_limit", upgrade: quota.upgrade, used: quota.used, allowance: quota.allowance }, { status: 402 });

    const prompt = `This is a bank statement. Extract ALL transaction rows from it.
Return ONLY a valid JSON array — no markdown fences, no explanation, nothing else before or after.
Each element must be:
{"date":"YYYY-MM-DD","description":"narration as shown","debit":0,"credit":0,"balance":0}

Rules:
- Amounts: plain numbers only (no ₹, $, commas). Use 0 if empty.
- Withdrawal / Dr / Debit column → debit field
- Deposit / Cr / Credit column → credit field
- Skip header rows, opening/closing balance lines and summary/total rows
- Extract every individual transaction row from every page, in statement order
- Keep the description short (max 120 characters) but keep names, UPI IDs and reference numbers`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      messages: [{
        role: "user",
        content: docBlock
          ? [docBlock as never, { type: "text", text: prompt }]
          : `${prompt}\n\nStatement ${/\.txt$/.test(lower) ? "text (pages separated by form feeds)" : "rows (CSV)"}:\n${sheetText}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown fences if Claude wrapped it anyway
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let jsonMatch = stripped.match(/\[[\s\S]*\]/);
    // A long statement can cut the reply off mid-way: keep every complete row that arrived
    if (!jsonMatch && stripped.startsWith("[")) {
      const cut = stripped.lastIndexOf("}");
      if (cut > 0) jsonMatch = [stripped.slice(0, cut + 1) + "]"] as unknown as RegExpMatchArray;
    }

    if (!jsonMatch) {
      return NextResponse.json({
        error: /\.(xlsx|xls|csv)$/.test(lower) ? "Couldn't find the transaction columns in this sheet. It needs columns like Date, Narration/Description, Debit/Withdrawal and Credit/Deposit (or Amount with Dr/Cr)." : "AI could not extract transactions from this PDF. Try saving the statement as Excel (.xlsx) from your bank's portal and uploading that instead.",
        raw: raw.slice(0, 600),
      }, { status: 422 });
    }

    const transactions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions found in this PDF. Try downloading the statement as Excel from your bank portal." }, { status: 422 });
    }

    await addStatementPages(sb, quota.ownerId, pages);
    return NextResponse.json({ transactions, pages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface meaningful errors
    if (msg.includes("Could not process document") || msg.includes("unsupported")) {
      return NextResponse.json({ error: "This PDF format is not supported. Download the statement as Excel (.xlsx) from your bank portal and upload that." }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
