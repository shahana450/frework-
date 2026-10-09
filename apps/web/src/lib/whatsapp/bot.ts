// FreBook on WhatsApp. A registered number acts as its FreWork user: drafts entries (posted only on YES) and answers questions
// with the same engine, rules, compliance checks and duplicate guard as FreBook in the app.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAI } from "../ai";
import { roleOf } from "../apiAuth";
import { can } from "../permissions";
import { intentSystemFor, loadBusinessContext, interpret, loadQueryBooks, type AiIntent, type ParsedTransaction } from "../intentEngine";
import { TOOLS, runTool, resolvePeriod, monthPeriod, type Tool, type Period } from "../bookQueries";
import { reviewChecks } from "../reviewChecks";
import { resolveLedgers } from "../ledgerResolve";
import { postJournal, voucherTypeFor, postingErrorMessage } from "../posting";
import { readAttachmentBuffer, type Attachment } from "../attachments";
import { fileToShelf, fyOfDate } from "../shelf";
import { parseCommand, helpText, draftText, answerText } from "./format";

type Link = { business_id: string; user_id: string; name: string };
type Session = { phone: string; business_id: string | null; pending: { parsed?: ParsedTransaction; key?: string; original?: string; picking?: boolean } | null; history: { role: "user" | "assistant"; content: string }[]; picking?: boolean };
export type Incoming = { from: string; id: string; text: string; media?: { bytes: Buffer; mime: string; name: string } };

const NOT_LINKED = "👋 This number isn't linked to FreWork yet.\n\nIn the FreWork app open *Settings → WhatsApp*, add this number and send the code shown there, e.g. *LINK 123456*.";

export async function handleWhatsApp(sb: SupabaseClient, m: Incoming): Promise<string> {
  const cmd = parseCommand(m.text);

  // Linking: the code proves the person holding this phone is the FreWork user who asked for it
  if (cmd.type === "link") {
    const { data: l } = await sb.from("fw_fin_wa_links").select("id,business_id,code_expires").eq("phone", m.from).eq("code", cmd.code).maybeSingle();
    if (!l || (l.code_expires && Date.parse(l.code_expires) < Date.now())) return "❌ That code is wrong or expired. Get a new one in FreWork → Settings → WhatsApp.";
    await sb.from("fw_fin_wa_links").update({ verified: true, code: null, code_expires: null }).eq("id", l.id);
    const { data: b } = await sb.from("fw_fin_businesses").select("name").eq("id", l.business_id).maybeSingle();
    await sb.from("fw_fin_wa_sessions").upsert({ phone: m.from, business_id: l.business_id, pending: null, history: [], updated_at: new Date().toISOString() });
    return `✅ Linked to *${b?.name ?? "your business"}*.\n\n` + helpText(b?.name ?? "");
  }

  const { data: rows } = await sb.from("fw_fin_wa_links").select("business_id,user_id,fw_fin_businesses(name)").eq("phone", m.from).eq("verified", true);
  const links: Link[] = ((rows ?? []) as unknown as { business_id: string; user_id: string; fw_fin_businesses: { name: string } | null }[]).map(r => ({ business_id: r.business_id, user_id: r.user_id, name: r.fw_fin_businesses?.name ?? "Business" }));
  if (!links.length) return NOT_LINKED;

  const { data: s0 } = await sb.from("fw_fin_wa_sessions").select("*").eq("phone", m.from).maybeSingle();
  const sess: Session = { phone: m.from, business_id: s0?.business_id ?? null, pending: s0?.pending ?? null, history: (s0?.history ?? []) as Session["history"], picking: !!(s0?.pending as { picking?: boolean } | null)?.picking };
  const save = (patch: { business_id?: string | null; pending?: unknown; history?: Session["history"] }) => sb.from("fw_fin_wa_sessions").upsert({ phone: m.from, business_id: sess.business_id, pending: sess.pending, history: sess.history.slice(-8), ...patch, updated_at: new Date().toISOString() });

  // Choosing among several linked businesses
  const listBiz = () => "Which business?\n" + links.map((l, i) => `${i + 1}. ${l.name}`).join("\n") + "\n\nReply with the number.";
  if (cmd.type === "switch") { if (links.length < 2) return `You're linked to *${links[0].name}* only.`; await save({ pending: { picking: true } }); return listBiz(); }
  if (cmd.type === "pick" && sess.picking) {
    const l = links[cmd.n - 1];
    if (!l) return listBiz();
    sess.business_id = l.business_id;
    await save({ business_id: l.business_id, pending: null, history: [] });
    return `Now chatting with *${l.name}*. Type a transaction or a question.`;
  }
  const link = links.find(l => l.business_id === sess.business_id) ?? (links.length === 1 ? links[0] : null);
  if (!link) { await save({ pending: { picking: true } }); return listBiz(); }
  sess.business_id = link.business_id;
  if (sess.picking) sess.pending = null;

  const { data: au } = await sb.auth.admin.getUserById(link.user_id);
  const role = au?.user ? await roleOf({ id: au.user.id, email: au.user.email }, link.business_id) : null;
  if (!role) return `❌ Your FreWork account no longer has access to ${link.name}. Ask the owner, or unlink in the app.`;

  if (cmd.type === "help") return helpText(link.name);
  if (cmd.type === "no") { await save({ pending: null }); return sess.pending ? "❌ Draft dropped. Nothing was posted." : "Nothing pending."; }

  if (cmd.type === "yes" || cmd.type === "post_anyway") {
    const p = sess.pending;
    if (!p?.parsed) return "Nothing to post. Type a transaction first.";
    if (!can(role, "post")) return "Your role can view but not post. Ask the owner for posting access.";
    return postPending(sb, link, au!.user!.id, { parsed: p.parsed, key: p.key ?? `wa:${m.id}`, original: p.original ?? "" }, cmd.type === "post_anyway", save);
  }

  // A new message: question or transaction — the same AI instructions as FreBook in the app
  const message = cmd.type === "text" ? cmd.text : m.text;
  const today = new Date().toLocaleDateString("en-CA");
  const [{ data: accounts }, { data: fy }, biz] = await Promise.all([
    sb.from("fw_fin_chart_of_accounts").select("name,type,sub_type").eq("business_id", link.business_id).eq("is_group", false).limit(200),
    sb.from("fw_fin_financial_years").select("label,start_date,end_date,is_locked").eq("business_id", link.business_id).eq("is_current", true).maybeSingle(),
    loadBusinessContext(sb, link.business_id),
  ]);
  let attachment: Attachment | null = null;
  if (m.media) {
    attachment = readAttachmentBuffer(m.media.bytes, m.media.name, m.media.mime);
    const media = m.media;
    await fileToShelf(sb, { businessId: link.business_id, actorId: link.user_id, rack: "bills", title: media.name, fileName: media.name, mime: media.mime, bytes: new Uint8Array(media.bytes), source: "upload", fy: fyOfDate(today), notes: message || null }).catch(() => null);
  }
  const header = [
    `Today: ${today}.`, `Business: ${biz.name}, Country: ${biz.country}, State: ${biz.state ?? "not set"}, Tax ID: ${biz.gstin ?? "not set"}, Base currency: ${biz.baseCurrency}.`,
    `Financial Year: ${fy?.label ?? "unknown"} (${fy?.start_date} to ${fy?.end_date}).`,
    `Available Accounts: ${(accounts ?? []).map(a => `${a.name} (${a.type})`).join(" | ")}.`,
    attachment ? `Attached file: ${attachment.name}.${attachment.text ? `\nFile contents:\n${attachment.text}` : " (see attached document)"}` : "",
  ].join(" ");
  const userTurn = `${header}\n\nUser message: ${message || "Book this transaction from the attached document."}`;
  const msgs = [...sess.history.slice(-6).map(h => ({ role: h.role, content: h.content })), { role: "user" as const, content: attachment ? [...attachment.blocks, { type: "text" as const, text: userTurn }] : userTurn }];
  const res = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: 1500, system: intentSystemFor(biz), messages: msgs as never });
  const raw = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
  let ai: AiIntent;
  try { ai = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch { return "🤔 I couldn't understand that. Try e.g. *Paid rent 25000 from bank* or *Profit this month*."; }
  const hist = (assistant: string) => [...sess.history, { role: "user" as const, content: message.slice(0, 500) || "[document]" }, { role: "assistant" as const, content: assistant }];

  if (ai.kind === "query") {
    const tool = (TOOLS as readonly string[]).includes(ai.tool ?? "") ? ai.tool as Tool : "search";
    const fyP: Period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${fy.label}` } : { from: "2000-01-01", to: today, label: "all time" };
    const p = resolvePeriod(ai.period, tool === "compare" ? monthPeriod(today, 0) : fyP);
    const p2 = resolvePeriod(ai.period2, tool === "compare" ? monthPeriod(p.from, -1) : fyP);
    const books = await loadQueryBooks(sb, link.business_id, [p.to, p2.to, today].sort().pop()!);
    if (books.error) return "⚠️ I couldn't read your books right now. Please try again.";
    const ans = runTool(tool, books.accounts, books.journals, ai.params ?? {}, { p, p2, today }, { currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
    await save({ history: hist(JSON.stringify({ kind: "answer", tool, summary: ans.summary })) });
    return answerText(ans, biz.baseCurrency);
  }

  if (!can(role, "post")) return "Your role can view but not post. Ask a question instead, e.g. *Profit this month*.";
  const parsed = await interpret(sb, ai, accounts ?? [], link.business_id, today, biz);
  if (fy?.is_locked) parsed.warnings.push("This accounting period is locked.");
  if (parsed.status === "needs_clarification" && parsed.needs_clarification.length) {
    await save({ pending: null, history: hist(parsed.needs_clarification[0]) });
    return `❓ ${parsed.needs_clarification[0]}`;
  }
  // Same smart checks as the app (TDS, cash limits, negative balances)
  const books = await loadQueryBooks(sb, link.business_id, [today, parsed.transaction_date].sort().pop()!);
  const checks = books.error ? { checks: [] } : reviewChecks(books.accounts, books.journals, today, { date: parsed.transaction_date, lines: parsed.lines.map(l => ({ account: l.account, debit: l.debit, credit: l.credit })) });
  const bad = checks.checks.filter(c => c.tone === "bad");
  await save({ pending: { parsed, key: `wa:${m.id}`, original: message.slice(0, 300) }, history: hist(raw) });
  return draftText(parsed, bad, biz.baseCurrency);
}

async function postPending(sb: SupabaseClient, link: Link, actorId: string, p: { parsed: ParsedTransaction; key: string; original: string }, dupOk: boolean, save: (x: { pending?: unknown }) => unknown): Promise<string> {
  const t = p.parsed;
  if (t.warnings.some(w => /locked/i.test(w))) return "🔒 This period is locked — the owner or an admin can post it from the app.";
  // Posted once only, however many times YES is sent
  const { data: prior } = await sb.from("fw_fin_journals").select("entry_no").eq("business_id", link.business_id).eq("metadata->>client_key", p.key).neq("status", "voided").limit(1).maybeSingle();
  if (prior) { await save({ pending: null }); return `✅ Already posted as *${prior.entry_no}*.`; }
  const resolved = await resolveLedgers(sb, link.business_id, t.lines.map(l => ({ name: l.account, suggestedType: l.suggested_type })), {}, "WhatsApp");
  if (!resolved.ok) return `I need to know which group these new ledgers belong to: ${resolved.needHeads.map(h => h.account).join(", ")}.\nPlease post this one from FreBook in the app (it will ask you).`;
  try {
    const posted = await postJournal(sb, {
      businessId: link.business_id, actorId, date: t.transaction_date, type: voucherTypeFor(t.transaction_type), narration: t.narrative || p.original,
      referenceNo: t.invoice_number, partyName: t.party_name, source: "whatsapp", aiGenerated: true, checkDuplicate: !dupOk,
      lines: t.lines.map(l => ({ accountId: resolved.ids.get(l.account.trim())!.id, dr: l.debit, cr: l.credit, fcDr: l.fc_debit, fcCr: l.fc_credit })),
      currency: t.fx?.currency ?? null, exchangeRate: t.fx?.rate ?? null,
      metadata: { client_key: p.key, original_message: p.original, channel: "whatsapp", gst: t.gst, tds: t.tds, warnings: t.warnings, confirmed_by: actorId },
    });
    await save({ pending: null });
    return `✅ Posted as *${posted.entryNo}* · ${link.name}${resolved.created.length ? `\nNew ledger${resolved.created.length > 1 ? "s" : ""}: ${resolved.created.map(c => c.name).join(", ")}` : ""}`;
  } catch (e) {
    const err = postingErrorMessage(e);
    if (err.code === "POSSIBLE_DUPLICATE") return `⚠️ ${err.message}\n\nReply *POST ANYWAY* if this is a separate transaction, or *NO* to drop it.`;
    return `⚠️ Couldn't post: ${err.message}`;
  }
}
