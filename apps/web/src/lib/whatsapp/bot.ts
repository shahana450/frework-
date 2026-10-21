// FreBook on WhatsApp. A registered number acts as its FreWork user: drafts entries (posted only on YES) and answers questions
// with the same engine, rules, compliance checks and duplicate guard as FreBook in the app.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAI } from "../ai";
import { roleOf } from "../apiAuth";
import { can } from "../permissions";
import { intentSystemFor, loadBusinessContext, interpret, loadQueryBooks, accountListForAI, type AiIntent, type ParsedTransaction } from "../intentEngine";
import { TOOLS, runTool, resolvePeriod, monthPeriod, type Tool, type Period } from "../bookQueries";
import { reviewChecks } from "../reviewChecks";
import { resolveLedgers } from "../ledgerResolve";
import { headByKey } from "../ledgerHeads";
import { postJournal, voucherTypeFor, postingErrorMessage } from "../posting";
import { readAttachmentBuffer, type Attachment } from "../attachments";
import { fileToShelf, fyOfDate } from "../shelf";
import { parseCommand, helpText, draftText, answerText } from "./format";
import { loginToken, loginUrl } from "./loginLink";
import { loadOverdue, listMessage } from "../collectAlert";

type Link = { business_id: string; user_id: string; name: string };
type Session = { phone: string; business_id: string | null; pending: { parsed?: ParsedTransaction; key?: string; original?: string; picking?: boolean; heads?: Record<string, string>; asking?: string[]; queue?: ParsedTransaction[] } | null; history: { role: "user" | "assistant"; content: string }[]; picking?: boolean };
export type Incoming = { from: string; id: string; text: string; media?: { bytes: Buffer; mime: string; name: string } };

// Offered only when no draft is waiting, so YES can never post something by accident
const DASH_HINT = "\n\nSay *YES* if you need the dashboard view.";

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
  // One-tap sign-in: this number was proved by the LINK code, so it may open its own FreWork account
  const signInLink = async () => {
    const token = await loginToken(sb, link.user_id);
    if (!token) return "❌ Couldn't make a sign-in link for your account. Sign in at frework.online/login instead.";
    await sb.from("fw_fin_audit_log").insert({ business_id: link.business_id, actor: link.user_id, action: "whatsapp_login_link", source: "whatsapp", detail: { phone: `${m.from.slice(0, 4)}…${m.from.slice(-2)}` } }).then(() => null, () => null);
    return `🔐 Open your FreBook dashboard:
${loginUrl(token)}

Works once and expires soon. Don't forward it — it signs in as you.`;
  };
  if (cmd.type === "login") return signInLink();
  // LIST: overdue customers with one-tap reminder links (the owner sends them from their own WhatsApp)
  if (/^(list|dues|overdue|reminders?)\s*$/i.test(m.text.trim())) {
    const { data: al } = await sb.from("fw_fin_wa_links").select("collect_alert_days").eq("phone", m.from).eq("business_id", link.business_id).maybeSingle();
    const days = (al as { collect_alert_days?: number } | null)?.collect_alert_days ?? 30;
    const r = await loadOverdue(sb, link.business_id, days, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    return r ? listMessage(r.business || link.name, r.overdue, days) : "❌ Couldn't load receivables right now. Try again in a minute.";
  }
  // A greeting (or a typo of one, like "Ho") is not a question about the books: say hello, don't run a report
  if (!m.media && /^(h[ioe]+|hey+|hii+|hello+|helo|hai|namaste|namaskar|goods*(morning|afternoon|evening)|gm)[s!.]*$/i.test(m.text.trim())) {
    return `👋 Hi! You're in *${link.name}*. Type a transaction (e.g. _paid rent 25000 by bank_), ask about your numbers (_P&L this month_), or send a bill photo or PDF. Reply *HELP* for everything I can do.`;
  }
  // A bank statement: too long to book from chat. File it under Bank and point to the statement import
  if (m.media && /pdf|sheet|excel|csv/i.test(m.media.mime + m.media.name) && /stat+e?m+e?nt|stmt|passbook|acc_?st|account.?st/i.test(m.media.name)) {
    const media = m.media;
    const [kept, token] = await Promise.all([
      fileToShelf(sb, { businessId: link.business_id, actorId: link.user_id, rack: "bank", title: media.name, fileName: media.name, mime: media.mime, bytes: new Uint8Array(media.bytes), source: "upload", fy: fyOfDate(new Date().toLocaleDateString("en-CA")), docType: "Bank statement" }).catch(() => null),
      loginToken(sb, link.user_id),
    ]);
    const path = kept ? `/finance/banking/import?shelf=${kept.id}` : "/finance/banking/import";
    return `🏦 Got your bank statement (*${media.name}*) and saved it on the Shelf under Bank.

Tap to turn it into entries — the statement opens already loaded, FreBook reads every line and suggests the ledgers:
${token ? loginUrl(token, path, link.business_id) : `frework.online${path}`}`;
  }
  // INVOICE after a sale was posted here: a sign-in link that opens that invoice (view, edit, print / PDF)
  if (/^(invoice|inv|invoice pdf|send invoice)\s*$/i.test(m.text.trim())) {
    const id = (sess.pending as { lastSale?: string } | null)?.lastSale;
    if (!id) return "No recent sale to make an invoice for. Post a sale first, then reply *INVOICE*.";
    const token = await loginToken(sb, link.user_id);
    if (!token) return "❌ Couldn't make the invoice link. Open Journal entries in the app and press Invoice.";
    return `🧾 Your invoice — view, edit, then *Print / PDF* to download or share:
${loginUrl(token, `/finance/invoices/${id}`, link.business_id)}

Works once and expires soon. Don't forward this link — it signs in as you. Share the PDF instead.`;
  }
  if (cmd.type === "no") { await save({ pending: null }); return sess.pending ? "❌ Draft dropped. Nothing was posted." : "Nothing pending."; }

  // Choosing groups for new ledgers: "2 direct" changes item 2, then YES posts
  const pick = sess.pending?.asking?.length ? m.text.trim().match(/^(\d+)\s*[-.:)]?\s*([a-z ]+)$/i) : null;
  if (pick && sess.pending?.parsed) {
    const i = Number(pick[1]) - 1, key = GROUP_WORDS[pick[2].trim().toLowerCase()];
    const name = sess.pending.asking![i];
    if (!name) return `There's no item ${pick[1]}. ` + headsText(sess.pending.asking!, sess.pending.heads ?? {});
    if (!key) return `I don't know the group "${pick[2].trim()}". Use one of: ${Object.keys(GROUP_WORDS).filter((_, k) => k < 7).join(", ")}.`;
    const heads = { ...(sess.pending.heads ?? {}), [name]: key };
    await save({ pending: { ...sess.pending, heads } });
    return headsText(sess.pending.asking!, heads);
  }

  if (cmd.type === "yes" || cmd.type === "post_anyway") {
    const p = sess.pending;
    // No draft waiting: YES means "open the dashboard" (the offer made after answers and posted entries)
    if (!p?.parsed) return cmd.type === "yes" ? signInLink() : "Nothing to post. Type a transaction first.";
    if (!can(role, "post")) return "Your role can view but not post. Ask the owner for posting access.";
    if (p.queue?.length) {
      // Posts the first entry, then the next ones; new-ledger questions are asked once for all of them
      const all = [p.parsed, ...p.queue];
      const pre = await resolveLedgers(sb, link.business_id, all.flatMap(t => t.lines.map(l => ({ name: l.account, suggestedType: l.suggested_type }))), p.heads ?? {}, "WhatsApp");
      if (!pre.ok) {
        const asking = pre.needHeads.map(h => h.account);
        const heads = { ...Object.fromEntries(pre.needHeads.map(h => [h.account, h.suggested])), ...(p.heads ?? {}) };
        await save({ pending: { ...p, heads, asking } });
        return headsText(asking, heads);
      }
      const out: string[] = [];
      for (let i = 0; i < all.length; i++) out.push(await postPending(sb, link, au!.user!.id, { parsed: all[i], key: `${p.key ?? `wa:${m.id}`}:${i}`, original: p.original ?? "", heads: p.heads }, cmd.type === "post_anyway", save));
      await save({ pending: null });
      return out.map(s => s.replace(DASH_HINT, "")).join("\n") + DASH_HINT;
    }
    return postPending(sb, link, au!.user!.id, { parsed: p.parsed, key: p.key ?? `wa:${m.id}`, original: p.original ?? "", heads: p.heads }, cmd.type === "post_anyway", save);
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
    void fileToShelf(sb, { businessId: link.business_id, actorId: link.user_id, rack: "bills", title: media.name, fileName: media.name, mime: media.mime, bytes: new Uint8Array(media.bytes), source: "upload", fy: fyOfDate(today), notes: message || null }).catch(() => null);
  }
  const header = [
    `Today: ${today}.`, `Business: ${biz.name}, Country: ${biz.country}, State: ${biz.state ?? "not set"}, Tax ID: ${biz.gstin ?? "not set"}, Base currency: ${biz.baseCurrency}.`,
    `Financial Year: ${fy?.label ?? "unknown"} (${fy?.start_date} to ${fy?.end_date}).`,
    `Available Accounts: ${accountListForAI(accounts ?? [])}.`,
    attachment ? `Attached file: ${attachment.name}.${attachment.text ? `\nFile contents:\n${attachment.text}` : " (see attached document)"}` : "",
  ].join(" ");
  const userTurn = `${header}\n\nUser message: ${message || "Book this transaction from the attached document."}`;
  const msgs = [...sess.history.slice(-6).map(h => ({ role: h.role, content: h.content })), { role: "user" as const, content: attachment ? [...attachment.blocks, { type: "text" as const, text: userTurn }] : userTurn }];
  // Load the books while the AI reads the message (used for answers and the smart checks)
  const booksToday = loadQueryBooks(sb, link.business_id, today);
  booksToday.catch(() => null);
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
    const upto = [p.to, p2.to, today].sort().pop()!;
    const books = upto === today ? await booksToday : await loadQueryBooks(sb, link.business_id, upto);
    if (books.error) return "⚠️ I couldn't read your books right now. Please try again.";
    const ans = runTool(tool, books.accounts, books.journals, ai.params ?? {}, { p, p2, today }, { currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
    await save({ history: hist(JSON.stringify({ kind: "answer", tool, summary: ans.summary })) });
    return answerText(ans, biz.baseCurrency) + (sess.pending?.parsed ? "" : DASH_HINT);
  }

  if (!can(role, "post")) return "Your role can view but not post. Ask a question instead, e.g. *Profit this month*.";
  const parsed = await interpret(sb, ai, accounts ?? [], link.business_id, today, biz);
  if (fy?.is_locked) parsed.warnings.push("This accounting period is locked.");
  if (parsed.status === "needs_clarification" && parsed.needs_clarification.length) {
    await save({ pending: null, history: hist(parsed.needs_clarification[0]) });
    return `❓ ${parsed.needs_clarification[0]}`;
  }
  // Same smart checks as the app (TDS, cash limits, negative balances)
  const books = parsed.transaction_date <= today ? await booksToday : await loadQueryBooks(sb, link.business_id, parsed.transaction_date);
  const checks = books.error ? { checks: [] } : reviewChecks(books.accounts, books.journals, today, { date: parsed.transaction_date, lines: parsed.lines.map(l => ({ account: l.account, debit: l.debit, credit: l.credit })) });
  const bad = checks.checks.filter(c => c.tone === "bad");
  const queue = parsed.more ?? [];
  const first = { ...parsed, more: undefined };
  await save({ pending: { parsed: first, key: `wa:${m.id}`, original: message.slice(0, 300), queue }, history: hist(raw) });
  if (!queue.length) return draftText(first, bad, biz.baseCurrency);
  // One message per date, one YES for all of them
  const all = [first, ...queue];
  return [`📅 Your items are on *${all.length} different dates* — ${all.length} entries:`, ...all.map((d, i) => `*${i + 1}.* ` + draftText(d, i === 0 ? bad : [], biz.baseCurrency).replace(/\n*Reply \*YES\* to post · \*NO\* to cancel$/, ""))].join("\n\n") + `\n\nReply *YES* to post all ${all.length} · *NO* to cancel`;
}

// Words a user can reply with to choose a ledger's group
const GROUP_WORDS: Record<string, string> = {
  expense: "indirect_expense", direct: "direct_expense", purchase: "purchase", asset: "fixed_asset", income: "indirect_income", sales: "sales", liability: "current_liability",
  expenses: "indirect_expense", indirect: "indirect_expense", "direct expense": "direct_expense", "fixed asset": "fixed_asset", "current asset": "current_asset", advance: "advances",
  loan: "loan", capital: "capital", supplier: "creditors", customer: "debtors", bank: "bank", cash: "cash", tax: "duties",
};
function headsText(names: string[], heads: Record<string, string>) {
  return `📂 New ledger${names.length > 1 ? "s" : ""} — I'll file ${names.length > 1 ? "them" : "it"} like this:\n${names.map((n, i) => `${i + 1}. *${n}* → ${headByKey(heads[n] ?? "indirect_expense")?.label ?? "Indirect Expenses"}`).join("\n")}\n\nReply *YES* to post. To change one, reply e.g. *${names.length > 1 ? 2 : 1} direct* (expense · direct · purchase · asset · income · liability).`;
}

async function postPending(sb: SupabaseClient, link: Link, actorId: string, p: { parsed: ParsedTransaction; key: string; original: string; heads?: Record<string, string> }, dupOk: boolean, save: (x: { pending?: unknown }) => unknown): Promise<string> {
  const t = p.parsed;
  if (t.warnings.some(w => /locked/i.test(w))) return "🔒 This period is locked — the owner or an admin can post it from the app.";
  // Posted once only, however many times YES is sent
  // (a draft held for review carries the same key but is not in the books — only a posted entry counts)
  const { data: prior } = await sb.from("fw_fin_journals").select("entry_no").eq("business_id", link.business_id).eq("metadata->>client_key", p.key).eq("status", "posted").limit(1).maybeSingle();
  if (prior) { await save({ pending: null }); return `✅ Already posted as *${prior.entry_no}*.`; }
  const resolved = await resolveLedgers(sb, link.business_id, t.lines.map(l => ({ name: l.account, suggestedType: l.suggested_type })), p.heads ?? {}, "WhatsApp");
  if (!resolved.ok) {
    // Ask here in WhatsApp: suggested groups, change any with "2 direct", then YES
    const asking = resolved.needHeads.map(h => h.account);
    const heads = { ...Object.fromEntries(resolved.needHeads.map(h => [h.account, h.suggested])), ...(p.heads ?? {}) };
    await save({ pending: { parsed: t, key: p.key, original: p.original, heads, asking } });
    return headsText(asking, heads);
  }
  try {
    const posted = await postJournal(sb, {
      businessId: link.business_id, actorId, date: t.transaction_date, type: voucherTypeFor(t.transaction_type), narration: t.narrative || p.original,
      // POST ANYWAY also confirms a held entry (e.g. a purchase with no GST from an unregistered seller)
      referenceNo: t.invoice_number, partyName: t.party_name, source: "whatsapp", aiGenerated: true, checkDuplicate: !dupOk, reviewed: dupOk,
      lines: t.lines.map(l => ({ accountId: resolved.ids.get(l.account.trim())!.id, dr: l.debit, cr: l.credit, fcDr: l.fc_debit, fcCr: l.fc_credit })),
      currency: t.fx?.currency ?? null, exchangeRate: t.fx?.rate ?? null,
      metadata: { client_key: p.key, original_message: p.original, channel: "whatsapp", gst: t.gst, tds: t.tds, warnings: t.warnings, confirmed_by: actorId },
    });
    // The draft kept for review earlier is replaced by the posted entry
    const { data: held } = await sb.from("fw_fin_journals").select("id").eq("business_id", link.business_id).eq("status", "draft").eq("metadata->>client_key", p.key);
    const heldIds = ((held ?? []) as { id: string }[]).map(h => h.id);
    if (heldIds.length) {
      await sb.from("fw_fin_journal_lines").delete().in("journal_id", heldIds);
      await sb.from("fw_fin_journals").delete().in("id", heldIds).eq("status", "draft");
    }
    // A sale: remember it, so *INVOICE* can open its invoice
    const isSale = /^(sale|sales)$/i.test(t.transaction_type);
    await save({ pending: isSale ? { lastSale: posted.id } : null });
    return `✅ Posted as *${posted.entryNo}* · ${link.name}${resolved.created.length ? `\nNew ledger${resolved.created.length > 1 ? "s" : ""}: ${resolved.created.map(c => c.name).join(", ")}` : ""}`
      + (isSale ? "\n\nNeed the invoice? Reply *INVOICE* to view, edit or download it." : DASH_HINT);
  } catch (e) {
    const err = postingErrorMessage(e);
    if (err.code === "POSSIBLE_DUPLICATE") return `⚠️ ${err.message}\n\nReply *POST ANYWAY* if this is a separate transaction, or *NO* to drop it.`;
    if (err.code === "NEEDS_REVIEW") return `🔎 ${err.message.replace(/^Saved as a draft for review, not posted:\s*/i, "Please check: ")}\n\nIf that's right (e.g. bought from a seller without GST), reply *POST ANYWAY*. Otherwise reply *NO* and send it again with the GST.`;
    return `⚠️ Couldn't post: ${err.message}`;
  }
}
