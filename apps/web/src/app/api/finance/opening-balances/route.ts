import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAI } from "@/lib/ai";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { readAttachment } from "@/lib/attachments";
import { LEDGER_HEADS, inferHead } from "@/lib/ledgerHeads";
import { resolveLedgers, makeFinder } from "@/lib/ledgerResolve";
import { postJournal, postingErrorMessage } from "@/lib/posting";
import { planOpening, cleanHead, type TbRow } from "@/lib/openingTb";

export const maxDuration = 120;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const keyFor = (fyId: string) => `opening:${fyId}`;

const PROMPT = `This is a TRIAL BALANCE (or balance sheet + P&L) of a business at the end of its financial year.
List EVERY ledger with its closing balance. Do not total, skip or merge ledgers; skip only group subtotal / grand total rows.
For each ledger choose its group key from: ${LEDGER_HEADS.map(h => `${h.key} (${h.label})`).join(", ")}.
Opening stock is a trading (P&L) item: give it head "purchase". Closing stock, if shown (in the TB, P&L or balance sheet), goes in "closing_stock" — not as a row.
Return ONLY JSON: {"as_on":"YYYY-MM-DD or null","closing_stock":0,"rows":[{"ledger":"","head":"","debit":0,"credit":0}]}`;

// Existing ledger → its group key, so the user's own chart wins over the AI's guess
const headOfAccount = (a: { type: string; sub_type: string | null; name: string }) =>
  LEDGER_HEADS.find(h => h.type === a.type && h.sub_type === a.sub_type)?.key ?? inferHead(a.name)?.key ?? (a.type === "income" ? "indirect_income" : a.type === "expense" ? "indirect_expense" : a.type === "equity" ? "capital" : a.type === "liability" ? "current_liability" : "current_asset");

export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date,is_current,is_locked").eq("business_id", bizId!).order("start_date", { ascending: false });
    const keys = (fys ?? []).map(f => keyFor(f.id));
    const { data: posted } = keys.length ? await supabase.from("fw_fin_journals").select("id,entry_no,date,total_debit,metadata").eq("business_id", bizId!).in("metadata->>client_key", keys).neq("status", "voided") : { data: [] };
    const { data: biz } = await supabase.from("fw_fin_businesses").select("entity_type,business_type").eq("id", bizId!).maybeSingle();
    return NextResponse.json({ fys: fys ?? [], posted: (posted ?? []).map(p => ({ id: p.id, entry_no: p.entry_no, date: p.date, total: p.total_debit, fy_id: String((p.metadata as { client_key?: string })?.client_key ?? "").slice(8) })), entity: (biz as { entity_type?: string; business_type?: string } | null)?.entity_type ?? (biz as { business_type?: string } | null)?.business_type ?? null });
  } catch (e) {
    return serverError("opening-balances", e, "Couldn't load opening balances.");
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Read a trial balance file with AI
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const bizId = String(form.get("business_id") ?? "");
      const gate = await requireBusiness(req, bizId, { write: true });
      if (gate instanceof NextResponse) return gate;
      const file = form.get("file") as File | null;
      if (!file?.size) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
      if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });
      const att = await readAttachment(file);
      const res = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: 16000, messages: [{ role: "user", content: [...att.blocks, { type: "text", text: `${PROMPT}${att.text ? `\n\nFile contents:\n${att.text}` : ""}` }] }] });
      const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
      let d: { as_on?: string | null; closing_stock?: number; rows?: TbRow[] };
      try { d = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch { return NextResponse.json({ error: "I couldn't read a trial balance in that file. Try a clearer PDF or the Excel export." }, { status: 422 }); }
      const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type").eq("business_id", bizId).eq("is_group", false).limit(2000);
      const find = makeFinder(accounts ?? []);
      const rows = (d.rows ?? []).filter(r => r?.ledger && ((+r.debit || 0) || (+r.credit || 0))).slice(0, 1000).map(r => {
        const hit = find(r.ledger) as { id: string; name: string; type: string; sub_type: string | null } | undefined;
        return { ledger: hit?.name ?? String(r.ledger).trim().slice(0, 120), head: hit ? headOfAccount(hit) : cleanHead(r.head) || inferHead(r.ledger)?.key || "", debit: Math.abs(+r.debit || 0), credit: Math.abs(+r.credit || 0), existing: !!hit };
      });
      return NextResponse.json({ rows, as_on: d.as_on ?? null, closing_stock: Math.abs(+(d.closing_stock ?? 0)) || 0, file: file.name });
    }

    // 2) Post the reviewed rows as one opening entry
    const body = await req.json().catch(() => ({})) as { business_id?: string; fy_id?: string; rows?: TbRow[]; retained?: string; retained_head?: string; closing_stock?: number; stock_ledger?: string; small_difference_to?: string; difference_to?: string | null; preview?: boolean };
    const bizId = body.business_id;
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    const rows = (body.rows ?? []).slice(0, 1000);
    const missingHead = rows.filter(r => r.ledger?.trim() && !cleanHead(r.head)).map(r => r.ledger);
    const plan = planOpening(rows.map(r => ({ ...r, head: cleanHead(r.head) })), { retained: (body.retained || "Capital Account").trim(), retainedHead: cleanHead(body.retained_head) || "capital", closingStock: body.closing_stock, stockLedger: (body.stock_ledger || "").trim() || undefined, differenceTo: body.difference_to || null });
    // A few rupees out (e.g. paise left off a typed figure) → to the named ledger when the caller allows it
    if (plan.difference !== 0 && !body.difference_to && body.small_difference_to && Math.abs(plan.difference) < 10) {
      body.difference_to = body.small_difference_to.trim();
      Object.assign(plan, planOpening(rows.map(r => ({ ...r, head: cleanHead(r.head) })), { retained: (body.retained || "Capital Account").trim(), retainedHead: cleanHead(body.retained_head) || "capital", closingStock: body.closing_stock, stockLedger: (body.stock_ledger || "").trim() || undefined, differenceTo: body.difference_to }));
    }
    if (body.preview) return NextResponse.json({ plan, missing_head: missingHead });
    if (missingHead.length) return NextResponse.json({ error: `Choose a group for: ${missingHead.slice(0, 8).join(", ")}${missingHead.length > 8 ? "…" : ""}`, missing_head: missingHead }, { status: 400 });
    if (plan.difference !== 0 && !body.difference_to) return NextResponse.json({ error: `Debits and credits differ by ₹${Math.abs(plan.difference).toLocaleString("en-IN")}. Fix the rows, or choose a ledger for the difference.`, plan }, { status: 422 });
    if (plan.lines.length < 2) return NextResponse.json({ error: "Nothing to post." }, { status: 400 });

    const { data: fy } = await supabase.from("fw_fin_financial_years").select("id,label,start_date,is_locked").eq("business_id", bizId!).eq("id", body.fy_id ?? "").maybeSingle();
    if (!fy) return NextResponse.json({ error: "Choose the financial year these balances open." }, { status: 400 });
    if (fy.is_locked && !can(gate.role, "lock")) return NextResponse.json({ error: `FY ${fy.label.replace(/^FY\s*/i, "")} is locked. Only the owner or an admin can post into it.` }, { status: 403 });
    const key = keyFor(fy.id);
    const { data: prior } = await supabase.from("fw_fin_journals").select("entry_no").eq("business_id", bizId!).eq("metadata->>client_key", key).neq("status", "voided").limit(1).maybeSingle();
    if (prior) return NextResponse.json({ error: `Opening balances for FY ${fy.label.replace(/^FY\s*/i, "")} are already posted as ${prior.entry_no}. Reverse that entry first to post them again.` }, { status: 409 });

    const heads = Object.fromEntries(plan.lines.map(l => [l.ledger, l.head]));
    const resolved = await resolveLedgers(supabase, bizId!, plan.lines.map(l => ({ name: l.ledger })), heads, "Opening balances");
    if (!resolved.ok) return NextResponse.json({ error: `Choose a group for: ${resolved.needHeads.map(h => h.account).join(", ")}` }, { status: 400 });
    const posted = await postJournal(supabase, {
      businessId: bizId!, actorId: gate.user.id, date: fy.start_date, type: "journal", narration: `Opening balances as on ${fy.start_date} (brought forward from last year's trial balance)`,
      source: "opening_balances", force: fy.is_locked,
      lines: plan.lines.map(l => ({ accountId: resolved.ids.get(l.ledger.trim())!.id, dr: l.dr, cr: l.cr })),
      metadata: { client_key: key, opening: true, profit_carried: plan.profit, closing_stock: plan.closingStock, difference: plan.difference, difference_to: body.difference_to ?? null },
    }).catch(e => { throw e; });
    await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "opening_balances", source: "opening_balances", detail: { fy: fy.label, entry_no: posted.entryNo, lines: plan.lines.length, total: posted.total } });
    return NextResponse.json({ ok: true, entry_no: posted.entryNo, journal_id: posted.id, created: resolved.created, total: posted.total });
  } catch (e) {
    const p = postingErrorMessage(e);
    if (p.status !== 500) return NextResponse.json({ error: p.message }, { status: p.status });
    return serverError("opening-balances", e, "Couldn't post the opening balances. Nothing was saved.");
  }
}
