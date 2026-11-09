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
import { parseCommand, helpText, draftText, answerText, money } from "./format";
import { buildMonthGstr1, fileGstr1, monthLabel } from "../gstr1Export";
import { monthFromText } from "../monthFromText";
import { loginToken, loginUrl } from "./loginLink";
import { loadOverdue, listMessage } from "../collectAlert";
import { loadInvoiceDoc } from "../invoiceLoad";
import { invoicePdf } from "../invoicePdf";
import { waPost } from "./transport";

type Link = { business_id: string; user_id: string; name: string };
type DocAsk = { shelfId: string; name: string; mime: string; pages: number };   // a bill sent without instructions, waiting for "post or save?"
type Session = { phone: string; business_id: string | null; pending: { parsed?: ParsedTransaction; key?: string; original?: string; picking?: boolean; heads?: Record<string, string>; asking?: string[]; queue?: ParsedTransaction[]; docAsk?: DocAsk } | null; history: { role: "user" | "assistant"; content: string }[]; picking?: boolean };
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
  if (cmd.type === "switch") {
    if (links.length < 2) return `You're linked to *${links[0].name}* only.`;
    await save({ pending: { picking: true } });
    // A drop-down list to tap (WhatsApp allows 10 rows); the numbered list stays as the fallback
    if (links.length <= 10) await sendList(m.from, "Which business should I work in?", "Choose business", "Your businesses", links.map((l, i) => ({ id: String(i + 1), title: l.name })));
    return listBiz();
  }
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

  if (cmd.type === "help") { await sendMenu(m.from, link.name); return helpText(link.name); }
  // GST filing status from the portal (Integrations → GST & IT portals): "GSTR status", "filing status", "GST returns filed?"
  if (!m.media && /(fil(ing|ed)|return)s?\s*status|status\s*of\s*(gst|gstr|return)|gstr?\s*-?\s*(1|3b)?\s*(filing\s*)?status|returns?\s*filed/i.test(m.text)) {
    return filingStatusText(sb, link.business_id, link.name);
  }
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
    await sendMenu(m.from, link.name);
    return `👋 Hi! You're in *${link.name}*. Tap *Menu* to choose, type a transaction (e.g. _paid rent 25000 by bank_), ask about your numbers (_P&L this month_), or send a bill photo or PDF. Reply *HELP* for everything I can do.`;
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

  // The answer to "post or save?" for a bill sent earlier (checked before YES, because "POST" also means YES)
  const ask = sess.pending?.docAsk;
  if (ask && !m.media) {
    const t = m.text.trim().toLowerCase();
    if (/^(save|upload|save for accountant|accountant|shelf|later)\b/.test(t)) {
      await sb.from("fw_fin_shelf_items").update({ notes: "To post — sent on WhatsApp, saved for the accountant" }).eq("id", ask.shelfId).eq("business_id", link.business_id).then(() => null, () => null);
      await save({ pending: null });
      return `📁 Saved *${ask.name}* on the Shelf under Bills, marked *to post* — your accountant can book it from FreBook (Shelf → Bills, or Smart Inbox). Nothing was posted.`;
    }
    if (/^(post|post entries|book|book it|entries)\b/.test(t)) {
      if (!can(role, "post")) return "Your role can view but not post. I've kept the file on the Shelf for the owner or accountant.";
      return draftDocumentPages(sb, link, ask, sess, save);
    }
    // Anything else: forget the question and treat it as a normal message
    sess.pending = null;
  }
  // A bill or document (PDF or photo) without an instruction: file it, then ask — post the entries, or keep it for the accountant
  if (m.media && /pdf|image/i.test(m.media.mime + m.media.name) && /^\s*((book|post|enter)( this| it| these)?|bills?|invoices?|this)?\s*[.!]?\s*$/i.test(m.text)) {
    const media = m.media;
    const kept = await fileToShelf(sb, { businessId: link.business_id, actorId: link.user_id, rack: "bills", title: media.name, fileName: media.name, mime: media.mime, bytes: new Uint8Array(media.bytes), source: "upload", fy: fyOfDate(new Date().toLocaleDateString("en-CA")) }).catch(() => null);
    if (kept) {
      let pages = 1;
      if (/pdf/i.test(media.mime + media.name)) { try { const { PDFDocument } = await import("pdf-lib"); pages = (await PDFDocument.load(media.bytes, { ignoreEncryption: true })).getPageCount(); } catch { /* one */ } }
      await save({ pending: { docAsk: { shelfId: kept.id, name: media.name, mime: media.mime, pages } } });
      await waPost({ messaging_product: "whatsapp", to: m.from, type: "interactive", interactive: { type: "button",
        body: { text: `📄 Got *${media.name}*${pages > 1 ? ` (${pages} pages)` : ""} and saved it on the Shelf.\n\nPost the entries now${pages > 1 ? ` — one entry per page` : ""}, or keep it for your accountant to post?` },
        action: { buttons: [{ type: "reply", reply: { id: "doc_post", title: "Post entries" } }, { type: "reply", reply: { id: "doc_save", title: "Save for accountant" } }] } } }).catch(() => null);
      return `Reply *POST* to draft the entries${pages > 1 ? ` (${pages} bills, one per page)` : ""} for your YES, or *SAVE* to keep it on the Shelf for your accountant.`;
    }
  }
  // GSTR-1 JSON for the portal: "GSTR1 JSON August 2026", "gstr-1 file last month". WhatsApp can't carry .json files,
  // so it's filed on the Shelf and sent as a download link that works for 7 days.
  if (!m.media && /\bgstr\s*-?\s*1\b/i.test(m.text) && /\b(json|file|download|export|upload)\b/i.test(m.text)) {
    const month = monthFromText(m.text);
    if (!month) return "Which month? e.g. *GSTR1 JSON August 2026* or *GSTR1 JSON last month*.";
    const r = await buildMonthGstr1(sb, link.business_id, month);
    const docs = r.totals.reduce((s, t) => s + t.count, 0);
    const errors = r.issues.filter(i => i.level === "error");
    const shelfId = await fileGstr1(sb, link.business_id, link.user_id, month, r);
    let url: string | null = null;
    if (shelfId) {
      const { data: it } = await sb.from("fw_fin_shelf_items").select("file_path").eq("id", shelfId).maybeSingle();
      if (it?.file_path) url = (await sb.storage.from("shelf").createSignedUrl(it.file_path, 7 * 86400, { download: r.fileName })).data?.signedUrl ?? null;
    }
    const tax = r.totals.reduce((s, t) => s + t.igst + t.cgst + t.sgst, 0), taxable = r.totals.reduce((s, t) => s + t.taxable, 0);
    return [
      `🧾 *GSTR-1 · ${monthLabel(month)}*${r.gstin ? ` · ${r.gstin}` : ""}`,
      docs ? `${docs} document${docs === 1 ? "" : "s"} · taxable ${money(taxable)} · tax ${money(tax)}` : "No sales invoices or credit notes in this month.",
      ...r.totals.filter(t => t.count).map(t => `• ${t.section}: ${t.count} · ${money(t.taxable)}`),
      errors.length ? `\n⚠️ *${errors.length} to fix before filing:*\n${errors.slice(0, 4).map(i => `• ${i.text}`).join("\n")}${errors.length > 4 ? `\n…and ${errors.length - 4} more (see the GST page)` : ""}` : r.issues.length ? `\nℹ️ ${r.issues.length} note${r.issues.length === 1 ? "" : "s"} to check on the GST page.` : "",
      url ? `\n⬇️ *${r.fileName}* (link works 7 days):\n${url}\n\nUpload it on the GST portal: Returns → GSTR-1 → Prepare Offline → Upload.` : "\nSaved on your Shelf (GST rack) — download it from FreBook.",
    ].filter(Boolean).join("\n");
  }
  // INVOICE after a sale was posted here: a sign-in link that opens that invoice (view, edit, print / PDF)
  if (/^(invoice|inv|invoice pdf|send invoice)\s*$/i.test(m.text.trim())) {
    const id = (sess.pending as { lastSale?: string } | null)?.lastSale;
    if (!id) return "No recent sale to make an invoice for. Post a sale first, then reply *INVOICE*.";
    // The invoice itself, as a PDF in this chat — ready to forward to the customer
    let sentPdf = "";
    try {
      const inv = await loadInvoiceDoc(sb, link.business_id, id);
      if (inv) {
        const fileName = `Invoice-${(inv.doc.invoiceNo || inv.entryNo).replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
        const shelf = await fileToShelf(sb, { businessId: link.business_id, actorId: link.user_id, rack: "bills", title: `Sales invoice ${inv.doc.invoiceNo || inv.entryNo}`, fileName, mime: "application/pdf",
          bytes: await invoicePdf(inv.doc), source: "upload", fy: fyOfDate(inv.doc.date || new Date().toLocaleDateString("en-CA")), docType: "Sales invoice" });
        const { data: it } = shelf ? await sb.from("fw_fin_shelf_items").select("file_path").eq("id", shelf.id).maybeSingle() : { data: null };
        const url = it?.file_path ? (await sb.storage.from("shelf").createSignedUrl(it.file_path, 7 * 86400, { download: fileName })).data?.signedUrl : null;
        if (url) {
          const r = await waPost({ messaging_product: "whatsapp", to: m.from, type: "document", document: { link: url, filename: fileName, caption: `${inv.doc.title} ${inv.doc.invoiceNo} · ${inv.doc.buyer.name || "Customer"}` } });
          sentPdf = r?.ok ? `📄 Invoice *${inv.doc.invoiceNo}* sent above as a PDF — forward it to your customer.` : `📄 Invoice PDF (link works 7 days):\n${url}`;
        }
      }
    } catch (e) { console.error("whatsapp invoice pdf", e); }
    const token = await loginToken(sb, link.user_id);
    const edit = token ? `\n\nTo change it (customer details, items, notes), open it in FreBook — the link signs in as you, don't forward it:\n${loginUrl(token, `/finance/invoices/${id}`, link.business_id)}` : "";
    if (sentPdf) return sentPdf + edit;
    if (!token) return "❌ Couldn't make the invoice. Open Journal entries in the app and press Invoice.";
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
  // A draft waiting for YES: a short follow-up ("date 01-11-2026", "salary was 15000", "from bank not cash") corrects
  // that draft — it is not a new transaction
  const waiting = sess.pending?.parsed;
  const draftNote = waiting && !m.media ? [
    "",
    `A DRAFT IS WAITING for the user's YES (from their message: "${(sess.pending?.original ?? "").slice(0, 300)}"):`,
    `date ${waiting.transaction_date}; narration "${(waiting.narrative ?? "").slice(0, 200)}"; lines: ${waiting.lines.map(l => `${l.debit ? "Dr" : "Cr"} ${l.account} ${l.debit || l.credit}`).join(", ")}${sess.pending?.queue?.length ? ` (+${sess.pending.queue.length} more entries)` : ""}.`,
    "If the new message changes or adds to this draft (a different date, amount, ledger, party, payment mode or narration), return the WHOLE corrected transaction as a record intent — every line, with the change applied — not a new partial one. Only treat it as a new transaction if it clearly describes a separate one.",
  ].join("\n") : "";
  const userTurn = `${header}${draftNote}\n\nUser message: ${message || "Book this transaction from the attached document."}`;
  const msgs = [...sess.history.slice(-6).map(h => ({ role: h.role, content: h.content })), { role: "user" as const, content: attachment ? [...attachment.blocks, { type: "text" as const, text: userTurn }] : userTurn }];
  // Load the books while the AI reads the message (used for answers and the smart checks)
  const booksToday = loadQueryBooks(sb, link.business_id, today);
  booksToday.catch(() => null);
  // A long list (dozens of expenses) needs room for every line in the reply, or it is cut off and unreadable
  const lineCount = (message.match(/\n/g) ?? []).length + 1;
  const big = lineCount > 12 || message.length > 700 || !!attachment;
  const res = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: big ? 16000 : 1500, system: intentSystemFor(biz), messages: msgs as never }, { timeout: big ? 100000 : 45000 });
  const raw = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
  let ai: AiIntent;
  try { ai = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch {
    if (res.stop_reason === "max_tokens") return "📋 That list is too long to book in one message. Send it in parts of about 40 lines, or use the *Journal template* in the FreBook app (Excel) for long lists.";
    return "🤔 I couldn't understand that. Try e.g. *Paid rent 25000 from bank* or *Profit this month*.";
  }
  const hist = (assistant: string) => [...sess.history, { role: "user" as const, content: message.slice(0, 500) || "[document]" }, { role: "assistant" as const, content: assistant }];

  if (ai.kind === "query") {
    const tool = (TOOLS as readonly string[]).includes(ai.tool ?? "") ? ai.tool as Tool : "search";
    const fyP: Period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${fy.label.replace(/^FY\s*/i, "")}` } : { from: "2000-01-01", to: today, label: "all time" };
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
  if (m.media) console.log("wa bill read", JSON.stringify({ action: ai.action, items: (ai.items ?? []).map(i => [i.kind, i.account, i.taxable, i.rate]) }).slice(0, 600));   // no party or amounts beyond the lines
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

/**
 * "Post entries" for a bill file kept on the Shelf: every page of a PDF is read as its own bill (a scanned book of cash
 * memos is one bill per page), three at a time, and all the drafts wait for one YES. Pages that can't be drafted are
 * named so they can be booked from the app.
 */
async function draftDocumentPages(sb: SupabaseClient, link: Link, ask: DocAsk, sess: Session, save: (x: { pending?: unknown; history?: Session["history"] }) => unknown): Promise<string> {
  const { data: it } = await sb.from("fw_fin_shelf_items").select("file_path,file_name,mime").eq("id", ask.shelfId).eq("business_id", link.business_id).maybeSingle();
  const file = it?.file_path ? await sb.storage.from("shelf").download(it.file_path) : null;
  if (!file?.data) { await save({ pending: null }); return "❌ Couldn't open the file from the Shelf. Send it again, or book it from FreBook → Smart Inbox."; }
  const bytes = Buffer.from(await file.data.arrayBuffer());
  const isPdf = /pdf/i.test(`${ask.mime} ${ask.name}`);
  // One piece per page (at most 20 here — longer files go to Smart Inbox), or the photo itself
  let pieces: Buffer[] = [bytes];
  if (isPdf && ask.pages > 1) {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pieces = [];
    for (let i = 0; i < Math.min(src.getPageCount(), 20); i++) {
      const one = await PDFDocument.create();
      const [pg] = await one.copyPages(src, [i]); one.addPage(pg);
      pieces.push(Buffer.from(await one.save()));
    }
  }
  const today = new Date().toLocaleDateString("en-CA");
  const [{ data: accounts }, biz] = await Promise.all([
    sb.from("fw_fin_chart_of_accounts").select("name,type,sub_type").eq("business_id", link.business_id).eq("is_group", false).limit(200),
    loadBusinessContext(sb, link.business_id),
  ]);
  const header = [`Today: ${today}.`, `Business: ${biz.name}, Country: ${biz.country}, State: ${biz.state ?? "not set"}, Tax ID: ${biz.gstin ?? "not set"}, Base currency: ${biz.baseCurrency}.`, `Available Accounts: ${accountListForAI(accounts ?? [])}.`].join(" ");
  const readOne = async (buf: Buffer, n: number): Promise<ParsedTransaction | null> => {
    try {
      const att = readAttachmentBuffer(buf, isPdf ? `${ask.name.replace(/\.pdf$/i, "")}-page${n}.pdf` : ask.name, isPdf ? "application/pdf" : ask.mime);
      const res = await getAI().messages.create({ model: "claude-sonnet-4-6", max_tokens: 4000, system: intentSystemFor(biz),
        messages: [{ role: "user", content: [...att.blocks, { type: "text", text: `${header}\n\nUser message: Book this one bill (page ${n} of ${pieces.length}). If no payment mode is written, it is a cash memo: paid in cash.` }] }] as never }, { timeout: 60000 });
      const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
      const ai = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "") as AiIntent;
      if (ai.kind === "query") return null;
      const p = await interpret(sb, ai, accounts ?? [], link.business_id, today, biz);
      return p.status === "complete" && p.lines.length >= 2 ? { ...p, more: undefined } : null;
    } catch { return null; }
  };
  const results: (ParsedTransaction | null)[] = new Array(pieces.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, pieces.length) }, async () => { while (next < pieces.length) { const i = next++; results[i] = await readOne(pieces[i], i + 1); } }));
  const drafts = results.flatMap((r, i) => (r ? [{ r, page: i + 1 }] : []));
  const missed = results.flatMap((r, i) => (r ? [] : [i + 1]));
  if (!drafts.length) { await save({ pending: null }); return `❓ I couldn't read a bill from *${ask.name}*. It's on the Shelf — book it from FreBook → Smart Inbox, or send a clearer photo.`; }
  const [first, ...queue] = drafts.map(d => ({ ...d.r, narrative: `${d.r.narrative || "Bill"} (page ${d.page})`.slice(0, 200) }));
  await save({ pending: { parsed: first, queue, key: `wa:doc:${ask.shelfId}`, original: `${ask.name} — ${drafts.length} bills` }, history: [...sess.history, { role: "user", content: `[${ask.name}: post entries]` }, { role: "assistant", content: `${drafts.length} drafts from ${ask.name}` }] });
  const total = drafts.reduce((s, d) => s + d.r.lines.reduce((t, l) => t + (l.debit || 0), 0), 0);
  const lines = drafts.map((d, i) => {
    const dr = d.r.lines.filter(l => l.debit).map(l => l.account).join(", "), cr = d.r.lines.filter(l => l.credit).map(l => l.account).join(", ");
    return `*${i + 1}.* ${d.r.transaction_date} · ${d.r.party_name || d.r.narrative.slice(0, 40) || "Bill"} · ${money(d.r.lines.reduce((t, l) => t + (l.debit || 0), 0), biz.baseCurrency)}\n    Dr ${dr} · Cr ${cr}`;
  });
  return [
    `📝 *${drafts.length} entr${drafts.length === 1 ? "y" : "ies"}* from ${ask.name} · total ${money(total, biz.baseCurrency)}`, "", ...lines,
    missed.length ? `\n⚠️ Page${missed.length > 1 ? "s" : ""} ${missed.join(", ")} couldn't be read — book ${missed.length > 1 ? "them" : "it"} from FreBook → Smart Inbox (the file is on the Shelf).` : "",
    ask.pages > 20 ? `\nℹ️ Only the first 20 pages were read here — use Smart Inbox for the rest.` : "",
    `\nReply *YES* to post all ${drafts.length} · *NO* to cancel`,
  ].filter(Boolean).join("\n");
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
      + (isSale ? "\n\nNeed the invoice? Reply *INVOICE* — the PDF comes here, ready to forward." : DASH_HINT);
  } catch (e) {
    const err = postingErrorMessage(e);
    if (err.code === "POSSIBLE_DUPLICATE") return `⚠️ ${err.message}\n\nReply *POST ANYWAY* if this is a separate transaction, or *NO* to drop it.`;
    if (err.code === "NEEDS_REVIEW") return `🔎 ${err.message.replace(/^Saved as a draft for review, not posted:\s*/i, "Please check: ")}\n\nIf that's right (e.g. bought from a seller without GST), reply *POST ANYWAY*. Otherwise reply *NO* and send it again with the GST.`;
    return `⚠️ Couldn't post: ${err.message}`;
  }
}

/** A WhatsApp list message: a button that opens a drop-down of rows. A tapped row comes back as its id (see the webhook). */
async function sendList(to: string, body: string, button: string, section: string, rows: { id: string; title: string; description?: string }[]) {
  await waPost({ messaging_product: "whatsapp", to, type: "interactive", interactive: {
    type: "list", body: { text: body.slice(0, 1024) }, action: { button: button.slice(0, 20),
      sections: [{ title: section.slice(0, 24), rows: rows.slice(0, 10).map(r => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) }] },
  } }).catch(() => null);
}

/** The main menu as a drop-down: each row's id is the command the bot already understands. */
function sendMenu(to: string, bizName: string) {
  return sendList(to, `📒 *FreBook* · ${bizName}\nPick what you need, or just type a transaction.`, "Menu", "FreBook", [
    { id: "Profit this month", title: "Profit this month", description: "P&L for the current month" },
    { id: "Cash and bank balance", title: "Cash & bank balance" },
    { id: "LIST", title: "Who owes me?", description: "Overdue customers with reminders" },
    { id: "GST filing status", title: "GST filing status", description: "GSTR-1 and GSTR-3B, filed or due" },
    { id: "GST collected last month", title: "GST last month", description: "Output tax, input credit, net payable" },
    { id: "GSTR1 JSON last month", title: "GSTR-1 JSON file", description: "Last month's file for the portal" },
    { id: "INVOICE", title: "Invoice PDF", description: "For the last sale posted here" },
    { id: "LOGIN", title: "Open dashboard", description: "One-tap sign-in link" },
    { id: "SWITCH", title: "Switch business" },
    { id: "HELP", title: "Help", description: "Everything I can do" },
  ]);
}

/** GSTR-1 / GSTR-3B status for the last two return periods, from the GST portal link. */
async function filingStatusText(sb: SupabaseClient, bizId: string, bizName: string): Promise<string> {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FILED = ["filed", "e_verified", "processed"];
  const [{ data: rows }, { data: biz }] = await Promise.all([
    sb.from("fw_fin_portal_status").select("form,period,status,filed_on,arn").eq("business_id", bizId).eq("portal", "gst").in("form", ["GSTR-1", "GSTR-3B"]).order("period", { ascending: false }).limit(60),
    sb.from("fw_fin_businesses").select("gstin").eq("id", bizId).maybeSingle(),
  ]);
  if (!(biz as { gstin?: string | null } | null)?.gstin) return `*${bizName}* has no GSTIN in FreBook, so there are no GST returns to track. Add it in Settings → Business.`;
  const list = (rows ?? []) as { form: string; period: string; status: string; filed_on: string | null; arn: string | null }[];
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dm = (iso: string) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]}`;
  const out = [`🧾 *GST filing status* · ${bizName}`];
  for (const back of [1, 2]) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push("", `*${MON[d.getMonth()]} ${d.getFullYear()}*`);
    for (const f of ["GSTR-1", "GSTR-3B"]) {
      const s = list.find(r => r.form === f && r.period === ym);
      if (s && FILED.includes(s.status)) { out.push(`✅ ${f} — filed${s.filed_on ? ` ${dm(s.filed_on)}` : ""}${s.arn ? ` · ARN ${s.arn}` : ""}`); continue; }
      const due = Date.UTC(d.getFullYear(), d.getMonth() + 1, f === "GSTR-1" ? 11 : 20);
      const days = Math.round((due - today) / 86400000);
      out.push(days < 0 ? `🔴 ${f} — not filed, ${-days} days late` : `🟡 ${f} — due ${days === 0 ? "today" : `in ${days} days`} (${dm(new Date(due).toISOString())})`);
    }
  }
  const last = (f: string) => list.find(r => r.form === f && FILED.includes(r.status));
  const l1 = last("GSTR-1"), l3 = last("GSTR-3B");
  if (l1 || l3) out.push("", `Last filed: ${[l1 && `GSTR-1 ${MON[+l1.period.slice(5, 7) - 1]} ${l1.period.slice(0, 4)}`, l3 && `GSTR-3B ${MON[+l3.period.slice(5, 7) - 1]} ${l3.period.slice(0, 4)}`].filter(Boolean).join(" · ")}`);
  out.push("", list.length ? "From the GST portal link. To refresh it, open Integrations → GST & IT portals in FreBook." : "ℹ️ The GST portal isn't linked yet, so these are due dates only. Link it in FreBook → Integrations → GST & IT portals to see what's filed.");
  return out.join("\n");
}
