import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";
import { loadQueryBooks } from "@/lib/intentEngine";
import { logAudit } from "@/lib/audit";
import { postJournal, postingErrorMessage } from "@/lib/posting";
import { fileToShelf, fyOfDate } from "@/lib/shelf";
import { getAI } from "@/lib/ai";
import { detect, PRIORITY_RANK, type Finding } from "@/lib/assurance/detective";
import { mergeRules, ruleFromRow, BUILTIN_TAX_RULES, type TaxRuleRow } from "@/lib/assurance/taxRules";
import { planSync, canMove, isOpen, type ExStatus, type StoredException } from "@/lib/assurance/workflow";
import { reconInputs, suggestMatches, validateAllocation } from "@/lib/assurance/bankRecon";
import { requestFor, validateDocument, followUpDraft, dueForReminder, overdue, type DocRequest, type Extract } from "@/lib/assurance/docRequests";
import { buildReclass, validateCorrection, type CLine } from "@/lib/assurance/correction";

// FreBook Accounting Detective: scan → exceptions, bank reconciliation, document requests, corrections, tax rules.
// Nothing here changes a posted entry. A correction posts a NEW journal, only after a person approves it.
export const runtime = "nodejs";
export const maxDuration = 60;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const today = () => new Date().toLocaleDateString("en-CA");
const MISSING = "The Accounting Detective needs its database tables. Run 2026-11-09_assurance.sql in Supabase (SQL editor), then try again.";
const missingTable = (e: { message?: string } | null) => !!e && /fw_fin_(exceptions|tax_rules|bank_matches|doc_requests|corrections)|does not exist|schema cache/i.test(e.message ?? "");

async function currentFy(bizId: string, fyId?: string | null) {
  const t = today();
  const q = sb.from("fw_fin_financial_years").select("id,label,start_date,end_date").eq("business_id", bizId);
  const { data } = fyId ? await q.eq("id", fyId).maybeSingle() : await q.lte("start_date", t).gte("end_date", t).maybeSingle();
  return data as { id: string; label: string; start_date: string; end_date: string } | null;
}
async function loadRules(bizId: string) {
  const { data, error } = await sb.from("fw_fin_tax_rules").select("*").or(`business_id.is.null,business_id.eq.${bizId}`);
  if (error) return BUILTIN_TAX_RULES;
  return mergeRules(((data ?? []) as TaxRuleRow[]).map(ruleFromRow));
}

async function scan(bizId: string, actor: string, fyId?: string | null) {
  const fy = await currentFy(bizId, fyId);
  if (!fy) return NextResponse.json({ error: "Choose a financial year first." }, { status: 400 });
  const probe = await sb.from("fw_fin_exceptions").select("id", { head: true, count: "exact" }).eq("business_id", bizId);
  if (missingTable(probe.error)) return NextResponse.json({ error: MISSING, needsMigration: true }, { status: 409 });

  const until = today() > fy.end_date ? fy.end_date : today();
  const [books, rules, docs, reqDone, feed, contacts, biz] = await Promise.all([
    loadQueryBooks(sb, bizId, fy.end_date),
    loadRules(bizId),
    sb.from("fw_fin_documents").select("journal_id").eq("business_id", bizId).not("journal_id", "is", null).limit(20000),
    sb.from("fw_fin_doc_requests").select("journal_id").eq("business_id", bizId).eq("status", "fulfilled").not("journal_id", "is", null),
    sb.from("fw_fin_feed_items").select("id,date,description,party,amount,provider").eq("business_id", bizId).eq("status", "new").gte("date", fy.start_date).lte("date", fy.end_date).limit(2000),
    sb.from("fw_fin_contacts").select("name,gstin").eq("business_id", bizId).limit(5000),
    sb.from("fw_fin_businesses").select("gstin").eq("id", bizId).maybeSingle(),
  ]);
  if (books.error) return serverError("detective scan", books.error, "Couldn't read the books.");
  const documented = new Set<string>([...(docs.data ?? []), ...(reqDone.data ?? [])].map(d => (d as { journal_id: string }).journal_id));
  const found = detect({
    accounts: books.accounts, journals: books.journals, today: today(), period: { from: fy.start_date, to: until }, rules, businessId: bizId,
    documentedJournalIds: documented, unbookedFeed: (feed.data ?? []).map(f => ({ ...f, amount: Number(f.amount) })) as never,
    parties: contacts.error ? undefined : (contacts.data ?? []) as { name: string; gstin: string | null }[], businessGstin: (biz.data as { gstin?: string } | null)?.gstin ?? null,
  });

  const stored: StoredException[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("fw_fin_exceptions").select("id,fingerprint,status,rule_id,confidence").eq("business_id", bizId).range(from, from + 999);
    if (error) return serverError("detective scan", error, "Couldn't read earlier findings.");
    stored.push(...((data ?? []) as StoredException[]));
    if (!data || data.length < 1000) break;
  }
  const plan = planSync(stored, found);
  const now = new Date().toISOString();
  const row = (f: Finding) => ({ rule_id: f.ruleId, rule_version: f.ruleVersion, category: f.category, priority: f.priority, confidence: f.confidence, txn_date: f.date, amount: f.amount,
    ledger: f.ledger, party: f.party, title: f.title, description: f.description, evidence: f.evidence, provision: f.provision ?? null, suggested_action: f.suggestedAction, journal_ids: f.journalIds, last_seen_at: now });
  const hist = (from: string | null, to: string, note: string) => ({ at: now, by: actor, from, to, note });

  for (let i = 0; i < plan.insert.length; i += 300) {
    const chunk = plan.insert.slice(i, i + 300).map(f => ({ business_id: bizId, fingerprint: f.fingerprint, status: f.needsDocument ? "awaiting_documents" : "detected", history: [hist(null, f.needsDocument ? "awaiting_documents" : "detected", "Found by scan")], ...row(f) }));
    const { error } = await sb.from("fw_fin_exceptions").upsert(chunk, { onConflict: "business_id,fingerprint", ignoreDuplicates: true });
    if (error) return serverError("detective insert", error, "Couldn't save the findings.");
  }
  await Promise.all(plan.refresh.map(r => sb.from("fw_fin_exceptions").update(row(r.finding)).eq("id", r.id)));
  for (const id of plan.autoResolve) {
    const { data } = await sb.from("fw_fin_exceptions").select("history,status").eq("id", id).maybeSingle();
    await sb.from("fw_fin_exceptions").update({ status: "resolved", resolved_at: now, history: [...((data?.history as unknown[]) ?? []), hist(data?.status ?? null, "resolved", "No longer found by the scan")] }).eq("id", id);
  }
  for (const r of plan.reopen) {
    const { data } = await sb.from("fw_fin_exceptions").select("history").eq("id", r.id).maybeSingle();
    await sb.from("fw_fin_exceptions").update({ ...row(r.finding), status: "reopened", resolved_at: null, history: [...((data?.history as unknown[]) ?? []), hist("resolved", "reopened", "Found again by the scan")] }).eq("id", r.id);
  }

  // Document requests for findings that need a document (one per exception — never asked twice)
  const needDoc = found.filter(f => f.needsDocument).map(f => f.fingerprint);
  if (needDoc.length) {
    const ids = new Map<string, string>();
    for (let i = 0; i < needDoc.length; i += 200) {
      const { data } = await sb.from("fw_fin_exceptions").select("id,fingerprint,status").eq("business_id", bizId).in("fingerprint", needDoc.slice(i, i + 200));
      for (const d of data ?? []) if (isOpen(d.status as ExStatus)) ids.set(d.fingerprint, d.id);
    }
    const reqs = found.filter(f => ids.has(f.fingerprint)).map(f => requestFor({ ...f, id: ids.get(f.fingerprint) })).filter(Boolean) as DocRequest[];
    for (let i = 0; i < reqs.length; i += 300) await sb.from("fw_fin_doc_requests").upsert(reqs.slice(i, i + 300).map(r => ({ business_id: bizId, exception_id: r.exceptionId, journal_id: r.journalId, party: r.party, txn_date: r.date, amount: r.amount, doc_kind: r.docKind, message: r.message })), { onConflict: "business_id,exception_id", ignoreDuplicates: true });
  }
  await logAudit(sb, { businessId: bizId, actor, action: "detective_scan", detail: { fy: fy.label, found: found.length, new: plan.insert.length, auto_resolved: plan.autoResolve.length } });
  return NextResponse.json({ ok: true, fy: fy.label, found: found.length, added: plan.insert.length, updated: plan.refresh.length, autoResolved: plan.autoResolve.length, reopened: plan.reopen.length });
}

async function overview(bizId: string) {
  const ex = await sb.from("fw_fin_exceptions").select("id,rule_id,category,priority,confidence,txn_date,amount,ledger,party,title,description,evidence,provision,suggested_action,journal_ids,assigned_to,status,history,ai_note,first_seen_at,last_seen_at").eq("business_id", bizId).order("last_seen_at", { ascending: false }).limit(2000);
  if (missingTable(ex.error)) return NextResponse.json({ needsMigration: true, error: MISSING });
  if (ex.error) return serverError("detective list", ex.error, "Couldn't load findings.");
  const [reqs, corr, team, biz, rules] = await Promise.all([
    sb.from("fw_fin_doc_requests").select("*").eq("business_id", bizId).order("created_at", { ascending: false }).limit(1000),
    sb.from("fw_fin_corrections").select("*").eq("business_id", bizId).order("proposed_at", { ascending: false }).limit(300),
    sb.from("fw_fin_team_members").select("invited_email,role").eq("business_id", bizId).eq("status", "active"),
    sb.from("fw_fin_businesses").select("name,owner_id").eq("id", bizId).maybeSingle(),
    loadRules(bizId),
  ]);
  const ownerId = (biz.data as { owner_id?: string } | null)?.owner_id;
  const ownerEmail = ownerId ? (await sb.auth.admin.getUserById(ownerId).catch(() => null))?.data?.user?.email ?? null : null;
  const list = (ex.data ?? []).sort((a, b) => Number(!isOpen(a.status as ExStatus)) - Number(!isOpen(b.status as ExStatus)) || PRIORITY_RANK[a.priority as "high"] - PRIORITY_RANK[b.priority as "high"]);
  const open = list.filter(e => isOpen(e.status as ExStatus));
  const summary = {
    unresolved: open.length, high: open.filter(e => e.priority === "high").length, medium: open.filter(e => e.priority === "medium").length, low: open.filter(e => e.priority === "low").length,
    missingDocs: open.filter(e => e.category === "missing_document" || e.category === "missing_entry").length, bank: open.filter(e => e.category === "bank").length,
    duplicates: open.filter(e => e.category === "duplicate").length, tax: open.filter(e => ["gst", "tds", "income_tax"].includes(e.category)).length,
    approvals: (corr.data ?? []).filter(c => c.status === "proposed").length, resolved: list.filter(e => e.status === "resolved").length,
  };
  const t = today();
  const requests = (reqs.data ?? []) as Record<string, unknown>[];
  const asReq = (r: Record<string, unknown>) => ({ status: r.status, lastRemindedAt: r.last_reminded_at, createdAt: r.created_at }) as DocRequest & { createdAt: string };
  return NextResponse.json({
    summary, exceptions: list, requests, corrections: corr.data ?? [], rules,
    team: [...(ownerEmail ? [{ email: ownerEmail, role: "owner" }] : []), ...((team.data ?? []) as { invited_email: string; role: string }[]).map(t => ({ email: t.invited_email, role: t.role }))],
    business: (biz.data as { name?: string } | null)?.name ?? "",
    reminders: { due: dueForReminder(requests.map(asReq), t).length, overdue: overdue(requests.map(asReq), t).length },
  });
}

async function recon(bizId: string) {
  const fy = await currentFy(bizId);
  if (!fy) return NextResponse.json({ error: "Choose a financial year first." }, { status: 400 });
  const [books, m] = await Promise.all([loadQueryBooks(sb, bizId, fy.end_date), sb.from("fw_fin_bank_matches").select("bank_journal_id,doc_journal_id,allocated,charges,split,evidence,confirmed_at").eq("business_id", bizId).eq("status", "confirmed")]);
  if (missingTable(m.error)) return NextResponse.json({ needsMigration: true, error: MISSING });
  if (books.error) return serverError("detective recon", books.error, "Couldn't read the books.");
  const matched = (m.data ?? []) as { bank_journal_id: string; doc_journal_id: string; allocated: number }[];
  const inYear = books.journals.filter(j => j.date >= fy.start_date && j.date <= fy.end_date);
  const { lines, open } = reconInputs(books.accounts, inYear, new Set(matched.map(x => x.bank_journal_id)));
  // Already-allocated amounts come off the open documents
  const used = new Map<string, number>(); for (const x of matched) used.set(x.doc_journal_id, (used.get(x.doc_journal_id) ?? 0) + Number(x.allocated));
  const openLeft = open.map(o => ({ ...o, open: Math.round((o.open - (used.get(o.journalId) ?? 0)) * 100) / 100 })).filter(o => o.open > 0.5);
  const sugg = suggestMatches(lines.slice(-400).reverse(), openLeft);
  const names = new Map(books.journals.map(j => [j.id, `${j.entry_no} · ${j.date}`]));
  const counts = { exact: 0, probable: 0, multiple: 0, unmatched: 0, clarify: 0 } as Record<string, number>;
  for (const s of sugg) counts[s.cls]++;
  return NextResponse.json({ suggestions: sugg, counts, matched: matched.map(x => ({ ...x, bank: names.get(x.bank_journal_id), doc: names.get(x.doc_journal_id) })) });
}

async function setStatus(bizId: string, actor: string, id: string, to: ExStatus, note?: string) {
  const { data: e } = await sb.from("fw_fin_exceptions").select("status,history").eq("id", id).eq("business_id", bizId).maybeSingle();
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canMove(e.status as ExStatus, to)) return NextResponse.json({ error: `Can't move from ${e.status} to ${to}.` }, { status: 400 });
  if ((to === "rejected" || to === "false_positive") && !note?.trim()) return NextResponse.json({ error: "Add a short reason." }, { status: 400 });
  const now = new Date().toISOString();
  await sb.from("fw_fin_exceptions").update({ status: to, resolved_at: ["resolved", "rejected", "false_positive"].includes(to) ? now : null, history: [...((e.history as unknown[]) ?? []), { at: now, by: actor, from: e.status, to, note: note ?? null }] }).eq("id", id);
  await logAudit(sb, { businessId: bizId, actor, action: "exception_status", reason: note ?? null, detail: { exception: id, from: e.status, to } });
  return NextResponse.json({ ok: true });
}

async function explain(bizId: string, id: string) {
  const { data: e } = await sb.from("fw_fin_exceptions").select("title,description,evidence,provision,confidence,suggested_action").eq("id", id).eq("business_id", bizId).maybeSingle();
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const res = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: 600,
    system: "You are an Indian chartered accountant reviewing a bookkeeping exception found by rules. Explain in plain English (max 120 words): what may have happened, what to check, and what evidence would settle it. Do not state a tax conclusion as fact; where facts are missing, say what is needed. Do not invent section numbers beyond the provision given.",
    messages: [{ role: "user", content: JSON.stringify(e) }] }).catch(() => null);
  const note = res?.content[0]?.type === "text" ? res.content[0].text.trim() : null;
  if (!note) return NextResponse.json({ error: "The AI didn't answer — try again." }, { status: 503 });
  await sb.from("fw_fin_exceptions").update({ ai_note: note }).eq("id", id);
  return NextResponse.json({ ok: true, note });
}

async function uploadForRequest(req: NextRequest, actor: string) {
  const form = await req.formData();
  const bizId = String(form.get("business_id") ?? ""); const id = String(form.get("request_id") ?? ""); const file = form.get("file") as File | null;
  const gate = await requireBusiness(req, bizId, { action: "upload" });
  if (gate instanceof NextResponse) return gate;
  if (!file) return NextResponse.json({ error: "Attach the document." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Files up to 4 MB. Send a smaller PDF or a photo." }, { status: 413 });
  const { data: r } = await sb.from("fw_fin_doc_requests").select("*").eq("id", id).eq("business_id", bizId).maybeSingle();
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kept = await fileToShelf(sb, { businessId: bizId, actorId: actor, rack: "bills", title: file.name, fileName: file.name, mime: file.type, bytes, source: "upload", fy: fyOfDate(r.txn_date), notes: `For: ${r.message}` });
  if (!kept) return NextResponse.json({ error: "Couldn't store the file. Try again." }, { status: 500 });
  // Read amount/date/supplier/GSTIN from the document
  let x: Extract = {};
  const b64 = Buffer.from(bytes).toString("base64");
  const block = /pdf/i.test(file.type) ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } } : { type: "image", source: { type: "base64", media_type: /png/i.test(file.type) ? "image/png" : "image/jpeg", data: b64 } };
  const ai = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: 400, system: "Read the bill/invoice. Reply JSON only: {\"amount\":number total incl. tax,\"date\":\"YYYY-MM-DD\",\"party\":\"supplier or issuer name\",\"gstin\":\"supplier GSTIN or null\",\"invoiceNo\":\"string or null\"}. Use null for anything not shown.",
    messages: [{ role: "user", content: [block as never, { type: "text", text: "Extract the fields." }] }] }).catch(() => null);
  try { const t = ai?.content[0]?.type === "text" ? ai.content[0].text : ""; x = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch { /* keep empty */ }
  // Duplicate: the same invoice number already given for another request
  let dup: string | null = null;
  if (x.invoiceNo) { const { data: d } = await sb.from("fw_fin_doc_requests").select("id,message").eq("business_id", bizId).neq("id", id).eq("extracted->>invoiceNo", x.invoiceNo).limit(1); if (d?.length) dup = d[0].message; }
  const v = validateDocument({ amount: r.amount != null ? Number(r.amount) : null, date: r.txn_date, party: r.party, docKind: r.doc_kind }, x);
  if (dup) v.checks.push({ label: "Duplicate", ok: false, detail: `Same invoice number was already uploaded for: ${dup}` }), v.ok = false;
  const status = v.ok ? "fulfilled" : "insufficient";
  await sb.from("fw_fin_doc_requests").update({ status, shelf_item_id: kept.id, extracted: x, validation: v, updated_at: new Date().toISOString() }).eq("id", id);
  if (r.exception_id) await setStatus(bizId, actor, r.exception_id, v.ok ? "resolved" : "under_review", v.ok ? "Document received and checked" : "Document received but doesn't match — needs a look").catch(() => null);
  await logAudit(sb, { businessId: bizId, actor, action: "document_request_upload", detail: { request: id, shelf: kept.id, status } });
  return NextResponse.json({ ok: true, status, validation: v, extracted: x });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams; const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    if (sp.get("view") === "recon") return await recon(bizId!);
    if (sp.get("view") === "followup") {
      const { data: biz } = await sb.from("fw_fin_businesses").select("name").eq("id", bizId!).maybeSingle();
      const { data: reqs } = await sb.from("fw_fin_doc_requests").select("*").eq("business_id", bizId!).in("status", ["open", "insufficient"]);
      const { data: contacts } = await sb.from("fw_fin_contacts").select("name,phone,email").eq("business_id", bizId!);
      const byParty = new Map<string, DocRequest[]>();
      for (const r of reqs ?? []) { const k = r.party ?? "General"; (byParty.get(k) ?? byParty.set(k, []).get(k)!).push({ ...r, journalId: r.journal_id, date: r.txn_date, docKind: r.doc_kind } as DocRequest); }
      const contact = new Map((contacts ?? []).map(c => [String(c.name).trim().toLowerCase(), c]));
      const name = (biz as { name?: string } | null)?.name ?? "your business";
      return NextResponse.json({ groups: [...byParty].map(([party, rs]) => ({ party, ids: rs.map(r => r.id), count: rs.length, contact: contact.get(party.trim().toLowerCase()) ?? null,
        whatsapp: followUpDraft(name, rs, "whatsapp"), email: followUpDraft(name, rs, "email") })) });
    }
    return await overview(bizId!);
  } catch (e) { return serverError("detective", e, "Couldn't load the Accounting Detective."); }
}

export async function POST(req: NextRequest) {
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const g = await requireBusiness(req, req.nextUrl.searchParams.get("business_id"), { action: "upload" });
      if (g instanceof NextResponse) return g;
      return await uploadForRequest(req, g.user.id);
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown> & { business_id?: string; action?: string };
    const bizId = body.business_id ?? null;
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const actor = gate.user.id; const role = gate.role;
    const writer = can(role, "post") || can(role, "upload");
    switch (body.action) {
      case "scan": return await scan(bizId!, actor, body.fy_id as string | undefined);
      case "status":
        if (!writer) return NextResponse.json({ error: "Your role can view but not change findings." }, { status: 403 });
        return await setStatus(bizId!, actor, String(body.id), body.to as ExStatus, body.note as string | undefined);
      case "assign": {
        if (!writer) return NextResponse.json({ error: "Your role can't assign." }, { status: 403 });
        await sb.from("fw_fin_exceptions").update({ assigned_to: body.email || null }).eq("id", String(body.id)).eq("business_id", bizId!);
        await sb.from("fw_fin_doc_requests").update({ assigned_to: body.email || null }).eq("exception_id", String(body.id)).eq("business_id", bizId!);
        return NextResponse.json({ ok: true });
      }
      case "explain": return await explain(bizId!, String(body.id));
      case "match": {
        if (!can(role, "post")) return NextResponse.json({ error: "Your role can't reconcile." }, { status: 403 });
        const items = (body.items as { journalId: string; allocate: number }[]) ?? [];
        const lineAmount = Number(body.amount); const charges = Number(body.charges) || 0;
        const bad = validateAllocation(lineAmount, items, charges);
        if (bad) return NextResponse.json({ error: bad }, { status: 400 });
        const { data: already } = await sb.from("fw_fin_bank_matches").select("id").eq("business_id", bizId!).eq("bank_journal_id", String(body.bank_journal_id)).eq("status", "confirmed").limit(1);
        if (already?.length) return NextResponse.json({ error: "This bank line is already matched. Unmatch it first." }, { status: 409 });
        const { error } = await sb.from("fw_fin_bank_matches").insert(items.map(i => ({ business_id: bizId, bank_journal_id: body.bank_journal_id, doc_journal_id: i.journalId, allocated: i.allocate, charges, split: items.length > 1, evidence: body.evidence ?? null, confirmed_by: actor })));
        if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? "This bank line is already matched." : error.message }, { status: 409 });
        await logAudit(sb, { businessId: bizId!, actor, action: "bank_match", journalId: String(body.bank_journal_id), detail: { items, charges } });
        return NextResponse.json({ ok: true });
      }
      case "unmatch": {
        if (!can(role, "post")) return NextResponse.json({ error: "Your role can't reconcile." }, { status: 403 });
        await sb.from("fw_fin_bank_matches").update({ status: "unmatched" }).eq("business_id", bizId!).eq("bank_journal_id", String(body.bank_journal_id)).eq("status", "confirmed");
        await logAudit(sb, { businessId: bizId!, actor, action: "bank_unmatch", journalId: String(body.bank_journal_id) });
        return NextResponse.json({ ok: true });
      }
      case "request_cancel":
        if (!writer) return NextResponse.json({ error: "Your role can't change requests." }, { status: 403 });
        await sb.from("fw_fin_doc_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", String(body.id)).eq("business_id", bizId!);
        return NextResponse.json({ ok: true });
      case "reminded": {   // the user sent the follow-up themselves (WhatsApp/email opened from FreBook)
        const ids = (body.ids as string[]) ?? [];
        const { data } = await sb.from("fw_fin_doc_requests").select("id,remind_count").eq("business_id", bizId!).in("id", ids);
        await Promise.all((data ?? []).map(r => sb.from("fw_fin_doc_requests").update({ remind_count: (r.remind_count ?? 0) + 1, last_reminded_at: new Date().toISOString() }).eq("id", r.id)));
        return NextResponse.json({ ok: true });
      }
      case "propose": {
        if (!can(role, "post")) return NextResponse.json({ error: "Your role can't propose corrections." }, { status: 403 });
        const fy = await currentFy(bizId!);
        const books = await loadQueryBooks(sb, bizId!, fy?.end_date ?? today());
        const j = books.journals.find(x => x.id === body.journal_id);
        if (!j) return NextResponse.json({ error: "Entry not found (only posted entries can be corrected)." }, { status: 404 });
        const names = new Map(books.accounts.map(a => [a.id, a.name]));
        let draft;
        try { draft = buildReclass(j, names, String(body.from_id), String(body.to_id), String(body.reason ?? "").trim() || "Reclassification", body.amount ? Number(body.amount) : undefined); }
        catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
        const bad = validateCorrection(draft.lines); if (bad) return NextResponse.json({ error: bad }, { status: 400 });
        const { data, error } = await sb.from("fw_fin_corrections").insert({ business_id: bizId, exception_id: body.exception_id ?? null, journal_id: j.id, kind: draft.kind, reason: draft.reason, lines: draft.lines, explanation: draft.explanation, tax_note: draft.taxNote, proposed_by: actor }).select("id").single();
        if (error) return NextResponse.json({ error: /unique|duplicate/i.test(error.message) ? "A correction for this entry is already waiting for approval." : error.message }, { status: 409 });
        if (body.exception_id) { await setStatus(bizId!, actor, String(body.exception_id), "correction_proposed", draft.reason).catch(() => null); await setStatus(bizId!, actor, String(body.exception_id), "awaiting_approval", "Sent for approval").catch(() => null); }
        await logAudit(sb, { businessId: bizId!, actor, action: "correction_proposed", journalId: j.id, reason: draft.reason, detail: { correction: data.id, lines: draft.lines } });
        return NextResponse.json({ ok: true, id: data.id, draft });
      }
      case "decide": {
        if (!can(role, "reverse")) return NextResponse.json({ error: "Only the owner or an accountant can approve corrections." }, { status: 403 });
        const approve = !!body.approve; const note = String(body.note ?? "").trim();
        if (!approve && !note) return NextResponse.json({ error: "Say why it's rejected." }, { status: 400 });
        // Claim the proposal atomically so it can never be posted twice
        const { data: c } = await sb.from("fw_fin_corrections").update({ status: approve ? "approved" : "rejected", decided_by: actor, decided_at: new Date().toISOString(), decision_note: note || null })
          .eq("id", String(body.id)).eq("business_id", bizId!).eq("status", "proposed").select("*").maybeSingle();
        if (!c) return NextResponse.json({ error: "This correction was already decided." }, { status: 409 });
        if (!approve) {
          if (c.exception_id) await setStatus(bizId!, actor, c.exception_id, "rejected", `Correction rejected: ${note}`).catch(() => null);
          await logAudit(sb, { businessId: bizId!, actor, action: "correction_rejected", journalId: c.journal_id, reason: note, detail: { correction: c.id } });
          return NextResponse.json({ ok: true });
        }
        const lines = c.lines as CLine[];
        const bad = validateCorrection(lines);
        if (bad) { await sb.from("fw_fin_corrections").update({ status: "failed", decision_note: bad }).eq("id", c.id); return NextResponse.json({ error: bad }, { status: 400 }); }
        const { data: orig } = await sb.from("fw_fin_journals").select("entry_no,date").eq("id", c.journal_id).maybeSingle();
        try {
          const posted = await postJournal(sb, { businessId: bizId!, actorId: actor, date: today() < (orig?.date ?? today()) ? orig!.date : today(), type: "journal",
            narration: `Correction of ${orig?.entry_no ?? "entry"}: ${c.reason}`, referenceNo: orig?.entry_no ?? null, source: "correction", reviewed: true,
            metadata: { correction_id: c.id, corrects: c.journal_id, approved_by: actor, proposed_by: c.proposed_by }, lines: lines.map(l => ({ accountId: l.accountId, dr: l.dr, cr: l.cr })) });
          await sb.from("fw_fin_corrections").update({ status: "posted", posted_journal_id: posted.id }).eq("id", c.id);
          if (c.exception_id) await setStatus(bizId!, actor, c.exception_id, "resolved", `Corrected by ${posted.entryNo}`).catch(() => null);
          await logAudit(sb, { businessId: bizId!, actor, action: "correction_posted", journalId: posted.id, reason: c.reason, detail: { correction: c.id, corrects: c.journal_id } });
          return NextResponse.json({ ok: true, entryNo: posted.entryNo });
        } catch (e) {
          const m = postingErrorMessage(e);
          await sb.from("fw_fin_corrections").update({ status: "failed", decision_note: m.message }).eq("id", c.id);
          return NextResponse.json({ error: m.message }, { status: m.status });
        }
      }
      case "rule_add": {
        if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "Only the owner can change tax rules." }, { status: 403 });
        const r = body.rule as Record<string, unknown>;
        const { data: prev } = await sb.from("fw_fin_tax_rules").select("version").eq("rule_id", String(r.rule_id)).eq("business_id", bizId!).order("version", { ascending: false }).limit(1);
        const base = BUILTIN_TAX_RULES.find(b => b.ruleId === r.rule_id);
        const version = Math.max(prev?.[0]?.version ?? 0, base?.version ?? 0) + 1;
        const { error } = await sb.from("fw_fin_tax_rules").insert({ business_id: bizId, rule_id: r.rule_id, version, area: r.area ?? base?.area, title: r.title ?? base?.title, provision: r.provision ?? base?.provision,
          effective_from: r.effective_from ?? today(), effective_to: r.effective_to ?? null, fy: r.fy ?? null, conditions: r.conditions ?? base?.conditions, thresholds: r.thresholds ?? base?.thresholds, rates: r.rates ?? base?.rates ?? null,
          exceptions: r.exceptions ?? base?.exceptions, keywords: r.keywords ?? base?.keywords ?? null, source: r.source ?? "Changed by the business", verified_on: r.verified_on ?? null, created_by: actor });
        if (error) return NextResponse.json({ error: missingTable(error) ? MISSING : error.message }, { status: 400 });
        await logAudit(sb, { businessId: bizId!, actor, action: "tax_rule_changed", detail: { rule: r.rule_id, version } });
        return NextResponse.json({ ok: true, version });
      }
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return serverError("detective", e, "Something went wrong in the Accounting Detective."); }
}
