"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@/lib/currentUser";
import type { ParsedTransaction } from "@/app/api/finance/chat-book/route";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import StatementModal from "./StatementModal";
import ReviewChecks from "./ReviewChecks";
import BulkTemplateModal from "./BulkTemplateModal";
import type { Verdict } from "@/lib/frebook/validateDraft";
import { postWarnings } from "@/lib/frebook/postWarnings";
import { saveDrafts, loadDrafts, isOpenDraft, pickDrafts, type StoredMsg } from "@/lib/frebook/draftStore";
import SimpleTemplateModal from "./SimpleTemplateModal";
import { parseSimpleGrid, SIMPLE_HEADERS, type SimpleEntry } from "@/lib/simpleTemplate";
import InstallApp from "./InstallApp";
import AnswerCard from "./AnswerCard";
import type { Answer } from "@/lib/bookQueries";
import { readActiveBusiness } from "@/lib/activeBusiness";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "user" | "ai" | "system";
type MsgStatus = "pending" | "confirmed" | "edited" | "cancelled" | "posted";
type ChatMessage = {
  id: string;
  role: Role;
  text?: string;
  transaction?: ParsedTransaction;
  verdict?: Verdict;
  status?: MsgStatus;
  entryNo?: string;
  journalId?: string;
  ledgerAccountIds?: { id: string; name: string }[];
  needsHeads?: { account: string; suggested: string }[];
  willCreate?: { account: string; head: string }[];
  createdLedgers?: { name: string; head: string }[];
  postArgs?: { sessId: string | null; originalMsg: string };
  answer?: Answer & { tool: string };
  duplicate?: { entry_no: string; date: string; narration: string } | null;
  fyLocked?: boolean;
  timestamp: number;
};
type Session = { id: string; title: string; created_at: string };

// ── Constants ──────────────────────────────────────────────────────────────────
const BG = "#F5F6FA", SIDEBAR = "#FFFFFF", CARD = "#FFFFFF";
const BORDER = "#E1E4EE", GOLD = "#232A63", GREEN = "#0B7A55";
const RED = "#C2321F", BLUE = "#1F5EFF", PURPLE = "#5B4BC4", AMBER = "#8A5A00";
const TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.70)";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";

const fmt = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TXN_LABELS: Record<string, string> = {
  expense_payment:"Expense Payment", bank_receipt:"Bank Receipt", credit_purchase:"Credit Purchase",
  credit_sale:"Credit Sale", cash_sale:"Cash Sale", cash_purchase:"Cash Purchase",
  bank_payment_to_supplier:"Supplier Payment", bank_receipt_from_customer:"Customer Receipt",
  capital_introduced:"Capital Introduced", drawings:"Owner Drawings", bank_transfer:"Bank Transfer",
  fixed_asset_purchase:"Fixed Asset Purchase", depreciation:"Depreciation", salary_payment:"Salary Payment",
  advance_from_customer:"Advance from Customer", advance_to_supplier:"Advance to Supplier",
  loan_received:"Loan Received", loan_repayment:"Loan Repayment", interest_income:"Interest Income",
  gst_payment:"GST Payment", tds_payment:"TDS Payment", bad_debt:"Bad Debt",
  journal_adjustment:"Journal Adjustment",
  purchase:"Purchase", asset_purchase:"Asset Purchase", sale:"Sale", receipt_from_customer:"Customer Receipt",
  payment_to_supplier:"Supplier Payment", other_income:"Other Income",
};

const TXN_ICONS: Record<string, string> = {
  expense_payment:"💸", bank_receipt:"💰", credit_purchase:"🛒", credit_sale:"📦",
  cash_sale:"💵", cash_purchase:"🛍", bank_payment_to_supplier:"🏦", bank_receipt_from_customer:"📥",
  capital_introduced:"🏛", drawings:"🏠", bank_transfer:"↔", fixed_asset_purchase:"🖥",
  depreciation:"📉", salary_payment:"👩‍💼", advance_from_customer:"⬇", advance_to_supplier:"⬆",
  loan_received:"💳", loan_repayment:"📤", interest_income:"📈", gst_payment:"🧾",
  tds_payment:"🏛", bad_debt:"❌", journal_adjustment:"⚙",
  purchase:"🛒", asset_purchase:"🖥", sale:"📦", receipt_from_customer:"📥", payment_to_supplier:"🏦", other_income:"📈",
};

// Line icons for the start-screen tiles (Bento style)
const TILE_ICON: Record<string, string> = {
  "Money paid": "M12 19V5M6 11l6-6 6 6", "Money received": "M12 5v14M6 13l6 6 6-6",
  "Snap a bill": "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7", "Upload bill or statement": "M12 15V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  "Who owes me?": "M4 7h16M4 12h10M4 17h6", "Profit this month": "M4 20V10M10 20V4M16 20v-7", "Biggest expenses": "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
};

// ── Excel entry template ───────────────────────────────────────────────────────

async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    SIMPLE_HEADERS,
    ["01-04-2026", "Rent", 25000, "", "Office rent for April"],
    ["", "Bank Account", "", 25000, ""],
    ["02-04-2026", "Cash", 11800, "", "Sale to Asha Traders"],
    ["", "Sales", "", 10000, ""],
    ["", "Output GST", "", 1800, ""],
  ]);
  ws["!cols"] = [{ wch: 13 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  const help = XLSX.utils.aoa_to_sheet([
    ["FreBook bulk template — how to fill"],
    [""],
    ["• Write each entry like a journal: one row per ledger, debits and credits."],
    ["• Date (DD-MM-YYYY) goes on the FIRST row of an entry. Leave it blank on the rows below that belong to the same entry."],
    ["• Particulars: the ledger name (e.g. Rent, your bank ledger, Cash, Sales, Asha Traders). New names are created after you confirm their group."],
    ["• Debit / Credit: the amount in one of the two columns. Each entry's debits must equal its credits."],
    ["• Narration: optional, on the first row of the entry."],
    ["• Delete the sample rows, then upload the file in FreBook with the 📎 button. You review every entry before anything is posted."],
  ]);
  help["!cols"] = [{ wch: 120 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Entries");
  XLSX.utils.book_append_sheet(wb, help, "Instructions");
  XLSX.writeFile(wb, "FreBook-Bulk-Template.xlsx");
}

// The simple template, read exactly (null when the file isn't laid out that way)
async function parseSimpleTemplate(file: File): Promise<SimpleEntry[] | null> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets["Entries"] ?? wb.Sheets[wb.SheetNames[0]];
  const entries = parseSimpleGrid(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][]);
  return entries && entries.length ? entries : null;
}

// Returns one plain-language line per row, or null when the file isn't the FreWork template
async function parseTemplate(file: File): Promise<string[] | null> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets["Entries"] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, dateNF: "yyyy-mm-dd", defval: "" });
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map(k => k.toLowerCase());
  if (!(keys.some(k => k.startsWith("type")) && keys.some(k => k.startsWith("amount")) && keys.some(k => k.startsWith("date")))) return null;
  const col = (r: Record<string, unknown>, prefix: string) => {
    const k = Object.keys(r).find(x => x.toLowerCase().startsWith(prefix.toLowerCase()));
    return k ? String(r[k] ?? "").trim() : "";
  };
  return rows.filter(r => col(r, "Amount") || col(r, "Description")).map((r, i) => {
    const rate = parseFloat(col(r, "GST Rate")) || 0;
    const incl = /^y/i.test(col(r, "Amount Includes"));
    const parts = [
      `Template row ${i + 1}: ${col(r, "Type") || "Transaction"}`,
      col(r, "Date") && `dated ${col(r, "Date")}`,
      col(r, "Party") && `party ${col(r, "Party")}`,
      col(r, "Invoice") && `invoice/bill no ${col(r, "Invoice")}`,
      col(r, "Description") && `for ${col(r, "Description")}`,
      col(r, "Amount") && `amount ₹${col(r, "Amount")}${rate ? ` ${incl ? "including" : "plus"} ${rate}% GST` : " (no GST)"}`,
      col(r, "Payment Mode") && `payment mode ${col(r, "Payment Mode")}`,
      col(r, "Bank Account") && `via ${col(r, "Bank Account")}`,
      col(r, "TDS") && `TDS section ${col(r, "TDS")}`,
      col(r, "Notes") && `note: ${col(r, "Notes")}`,
    ];
    return parts.filter(Boolean).join(", ");
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FreBookPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoPost, setAutoPost] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<ParsedTransaction["lines"]>([]);
  const [editDate, setEditDate] = useState("");
  const [editNarration, setEditNarration] = useState("");
  const [listening, setListening] = useState(false);
  const [rowQueue, setRowQueue] = useState<string[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<unknown>(null);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceMsg, setVoiceMsg] = useState("");
  const [voiceLang, setVoiceLangState] = useState("en-IN");
  useEffect(() => { try { const l = localStorage.getItem("fw_voice_lang"); if (l) setVoiceLangState(l); } catch { /* */ } }, []);
  const setVoiceLang = (l: string) => { setVoiceLangState(l); try { localStorage.setItem("fw_voice_lang", l); } catch { /* */ } };
  useEffect(() => () => { (recognitionRef.current as { abort?: () => void } | null)?.abort?.(); }, []);
  const bizIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id); userIdRef.current = user.id;
      const saved = (readActiveBusiness(user.id) ?? "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved); bizIdRef.current = saved;
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
      if (biz) setBizName(biz.name);
      loadSessions(user.id, saved);
    });
  }, []);

  async function loadSessions(uid: string, bid: string) {
    const { data } = await supabase.from("fw_fin_chat_sessions").select("id,title,created_at").eq("user_id", uid).eq("business_id", bid).order("created_at", { ascending: false }).limit(30);
    setSessions(data ?? []);
  }

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  // ── New chat ───────────────────────────────────────────────────────────────
  function newChat() {
    setCurrentSession(null);
    // Unposted drafts carry over to the new chat — they leave only when posted or cancelled (B17)
    setMessages(prev => [{ id: "welcome", role: "system", text: `Hello! I'm FreBook, your chat bookkeeper for **${bizName}**. Tell me any transaction in plain language and I'll convert it into a proper journal entry.\n\n**Examples:**\n• "Paid office rent ₹25,000 from the bank"\n• "Sold goods to ABC Ltd for ₹1,18,000 including 18% GST on credit"\n• "Received ₹50,000 from customer Rahul against INV-101"\n• "Paid salary ₹75,000 through bank"\n\n**Or ask your books:**\n• "How much am I owed?" · "Show expenses above ₹10,000 this month" · "Why did profit fall?" · "GST collected last month"`, timestamp: Date.now() }, ...(pickDrafts(prev as unknown as StoredMsg[]) as unknown as ChatMessage[])]);
  }

  const restoredRef = useRef(false);
  useEffect(() => {
    if (!bizName) return;
    newChat();
    // B17 — bring back drafts that weren't posted before a reload / in another tab
    if (!restoredRef.current && bizIdRef.current) {
      restoredRef.current = true;
      const back = loadDrafts(localStorage, bizIdRef.current) as unknown as ChatMessage[];
      if (back.length) setMessages(prev => [...prev, ...back, { id: `s-restored-${Date.now()}`, role: "system", text: `↩ Restored ${back.filter(m => m.role === "ai").length} unposted draft(s) from your last visit.`, timestamp: Date.now() }]);
    }
  }, [bizName]);
  // Keep the unposted drafts saved as they change (posted or cancelled ones drop out)
  useEffect(() => { if (bizIdRef.current && restoredRef.current) saveDrafts(localStorage, bizIdRef.current, messages as unknown as StoredMsg[]); }, [messages]);
  const openDrafts = messages.filter(m => isOpenDraft(m as unknown as StoredMsg)).length;

  // Handoff from the dashboard command box: ?q= sends straight away, ?prefill= fills the box
  const handoffDone = useRef(false);
  const [snapHint, setSnapHint] = useState(false);
  const [violations, setViolations] = useState<Record<string, string[]>>({});
  const [bulk, setBulk] = useState<{ fileName: string; fileKey: string; sentences: string[] } | null>(null);
  // B14 — one in-app confirmation listing every warning, instead of stacked browser pop-ups
  const [confirmPost, setConfirmPost] = useState<{ msgId: string; warnings: string[]; run: () => void } | null>(null);
  const [simpleBulk, setSimpleBulk] = useState<{ fileName: string; fileKey: string; entries: SimpleEntry[] } | null>(null);
  const postingRef = useRef(new Set<string>());
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    if (!bizName || handoffDone.current) return;
    handoffDone.current = true;
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q")?.trim(), prefill = sp.get("prefill");
    if (sp.get("snap")) { window.history.replaceState(null, "", "/finance/chat-book"); setSnapHint(true); return; }
    if (!q && prefill == null) return;
    window.history.replaceState(null, "", "/finance/chat-book");
    if (q) setTimeout(() => sendMessage(q), 0);
    else { setInput(prefill ?? ""); setTimeout(() => inputRef.current?.focus(), 50); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizName]);

  async function loadSession(sessId: string) {
    setCurrentSession(sessId);
    const { data } = await supabase.from("fw_fin_chat_sessions").select("messages,title").eq("id", sessId).single();
    if (!data?.messages) return;
    const msgs: ChatMessage[] = [];
    for (const m of data.messages as { role: string; content: string }[]) {
      msgs.push({ id: `h-${Math.random()}`, role: m.role === "user" ? "user" : "ai", text: m.content, timestamp: Date.now() });
    }
    setMessages(msgs);
  }

  // ── Voice input ────────────────────────────────────────────────────────────
  // Keeps listening through pauses, shows words as they're heard, and says why when it can't listen
  function stopVoice() {
    (recognitionRef.current as { stop: () => void } | null)?.stop();
    recognitionRef.current = null; setListening(false); setVoiceInterim("");
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
  }
  function toggleVoice() {
    if (listening) { stopVoice(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceMsg("Voice input needs Chrome or Edge (on iPhone, use the keyboard's 🎤 key instead)."); return; }
    const r = new SR();
    // Android Chrome repeats growing phrases in continuous mode, so phones listen one sentence at a time
    const android = /Android/i.test(navigator.userAgent);
    r.lang = voiceLang; r.continuous = !android; r.interimResults = true; r.maxAlternatives = 1;
    const base = input.trim();
    let finals = "";
    // Adds a phrase without repeating words already there ("Saleem" then "Saleem a salary" → "Saleem a salary")
    const merge = (sofar: string, next: string) => {
      const a = sofar.trim(), b = next.trim();
      if (!a) return b; if (!b) return a;
      const la = a.toLowerCase(), lb = b.toLowerCase();
      if (lb.startsWith(la)) return b;                 // the new phrase already contains everything so far
      if (la.endsWith(lb) || la.includes(lb)) return a; // nothing new
      const aw = a.split(/\s+/), bw = b.split(/\s+/);
      for (let k = Math.min(aw.length, bw.length); k > 0; k--) {   // overlap: end of what we have = start of the new phrase
        if (aw.slice(-k).join(" ").toLowerCase() === bw.slice(0, k).join(" ").toLowerCase()) return [...aw, ...bw.slice(k)].join(" ");
      }
      return `${a} ${b}`;
    };
    const idle = () => { if (voiceTimer.current) clearTimeout(voiceTimer.current); voiceTimer.current = setTimeout(stopVoice, 6000); };
    r.onstart = () => { setVoiceMsg(""); idle(); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals = merge(finals, t); else interim = t;
      }
      if (interim && merge(finals, interim) === finals) interim = "";
      setInput([base, finals].filter(Boolean).join(" "));
      setVoiceInterim(interim.trim());
      idle();                                  // 6 s of silence ends listening
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      const why: Record<string, string> = {
        "not-allowed": "Microphone is blocked. Click the 🔒 icon in the address bar → allow Microphone, then try again.",
        "service-not-allowed": "Microphone is blocked for this site. Allow it in the browser's site settings.",
        "no-speech": "Didn't hear anything — tap the mic and speak a little closer.",
        "audio-capture": "No microphone found. Check it's plugged in and not used by another app.",
        "network": "Voice needs an internet connection to the browser's speech service. Check your connection.",
        "language-not-supported": "This language isn't supported by your browser's voice input.",
      };
      if (e.error !== "aborted") setVoiceMsg(why[e.error] ?? `Voice input stopped (${e.error}).`);
      stopVoice();
    };
    r.onend = () => { setListening(false); setVoiceInterim(""); if (voiceTimer.current) clearTimeout(voiceTimer.current); inputRef.current?.focus(); };
    try { r.start(); recognitionRef.current = r; setListening(true); setVoiceMsg(""); }
    catch { setVoiceMsg("Couldn't start the microphone. Close other tabs using it and try again."); }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, file?: File) => {
    const bid = bizIdRef.current; const uid = userIdRef.current;
    if (!bid || !uid || (!text.trim() && !file)) return;
    (recognitionRef.current as { stop: () => void } | null)?.stop(); recognitionRef.current = null; setListening(false); setVoiceInterim("");
    setLoading(true);

    // Recent conversation sent with every request so follow-up answers keep their context
    const history = messages.filter(m => m.role === "user" || m.role === "ai").slice(-12).map(m => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.role === "user" ? (m.text ?? "")
        : m.transaction?.status === "needs_clarification" ? (m.text ?? m.transaction.needs_clarification[0] ?? "")
        : m.answer ? JSON.stringify({ kind: "answer", tool: m.answer.tool, summary: m.answer.summary })
        : m.transaction ? JSON.stringify({ status: "complete", narrative: m.transaction.narrative, amount: m.transaction.amount, party_name: m.transaction.party_name, invoice_number: m.transaction.invoice_number, document_summary: m.transaction.document_summary ?? null })
        : (m.text ?? ""),
    })).filter(h => h.content);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: [text.trim(), file ? `📎 ${file.name}` : ""].filter(Boolean).join("\n"), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      let body: FormData | string;
      if (file) {
        const fd = new FormData();
        fd.append("message", text || "Book this transaction"); fd.append("business_id", bid);
        fd.append("user_id", uid); if (currentSession) fd.append("session_id", currentSession);
        fd.append("history", JSON.stringify(history));
        fd.append("file", file);
        body = fd;
      } else {
        body = JSON.stringify({ message: text, business_id: bid, user_id: uid, session_id: currentSession, history });
      }

      const res = await fetch(file ? "/api/finance/chat-book" : "/api/finance/chat-book/fast", { method: "POST", body, ...(file ? {} : { headers: { "Content-Type": "application/json" } }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");

      // A document with several vouchers → review them all in the bulk table
      if (data.multi?.sentences?.length) {
        const m = data.multi as { file: string; sentences: string[] };
        setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `📄 ${m.file}: found ${m.sentences.length} vouchers — opening bulk review so each one is posted separately.`, timestamp: Date.now() }]);
        setBulk({ fileName: m.file, fileKey: `${m.file}-${file?.size ?? 0}-${file?.lastModified ?? Date.now()}`, sentences: m.sentences });
        setLoading(false);
        return;
      }

      const { parsed, verdict, session_id, duplicate, fy_locked } = data as { parsed: ParsedTransaction; verdict?: Verdict; session_id: string; duplicate: ChatMessage["duplicate"]; fy_locked: boolean };
      if (!currentSession && session_id) {
        setCurrentSession(session_id);
        if (uid && bid) loadSessions(uid, bid);
      }

      if (data.answer) {
        setMessages(prev => [...prev, { id: `q-${Date.now()}`, role: "ai", answer: data.answer, timestamp: Date.now() }]);
        return;
      }

      if (file && parsed.document_kind === "bank_statement") {
        setStatementFile(file);
        setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: "🏦 This is a bank statement — I've opened it so you can pick a ledger for each transaction and post them together.", timestamp: Date.now() }]);
        return;
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`, role: "ai", transaction: parsed, verdict,
        status: parsed.status === "needs_clarification" ? "pending" : "pending",
        duplicate, fyLocked: fy_locked, timestamp: Date.now(),
        text: parsed.status === "needs_clarification" ? parsed.needs_clarification[0] : undefined,
      };

      // Auto-post mode
      if (autoPost && parsed.status === "complete" && !fy_locked && !duplicate) {
        await postTransaction(parsed, session_id, text, aiMsg.id);
      } else {
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: "system", text: `⚠ ${e instanceof Error ? e.message : "Error"}`, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [currentSession, autoPost, messages]);

  // ── File upload: FreWork template → row queue, anything else → AI reads it ──
  async function handleFile(file: File) {
    if (/statement|stmt|passbook|e-?statement/i.test(file.name)) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", text: `📎 ${file.name}`, timestamp: Date.now() }]);
      setStatementFile(file);
      return;
    }
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      try {
        const simple = await parseSimpleTemplate(file);
        if (simple) {
          setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `📊 ${file.name}: ${simple.length} entr${simple.length === 1 ? "y" : "ies"} found — opening review.`, timestamp: Date.now() }]);
          setSimpleBulk({ fileName: file.name, fileKey: `${file.name}-${file.size}-${file.lastModified}`, entries: simple });
          return;
        }
        const rows = await parseTemplate(file);
        if (rows?.length) {
          // Many rows → review them all in one table and post together; a single row stays in the chat
          if (rows.length > 1) {
            setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `📊 ${file.name}: ${rows.length} entries found — opening bulk review.`, timestamp: Date.now() }]);
            setBulk({ fileName: file.name, fileKey: `${file.name}-${file.size}-${file.lastModified}`, sentences: rows });
            return;
          }
          setBatchTotal(rows.length); setRowQueue(rows);
          setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `📊 ${file.name}: ${rows.length} entry found.`, timestamp: Date.now() }]);
          return;
        }
      } catch { /* not a readable template — let the AI read it */ }
    }
    sendMessage(input, file);
  }

  // Sends the next template row once the previous one is answered (pauses on a question)
  useEffect(() => {
    if (loading || !rowQueue.length) return;
    const last = messages[messages.length - 1];
    if (last?.role === "ai" && last.transaction?.status === "needs_clarification") return;
    const [next, ...rest] = rowQueue;
    setRowQueue(rest);
    sendMessage(next);
  }, [rowQueue, loading, messages, sendMessage]);

  // ── Post transaction ───────────────────────────────────────────────────────
  async function postTransaction(transaction: ParsedTransaction, sessId: string | null, originalMsg: string, msgId: string, accountHeads?: Record<string, string>) {
    const bid = bizIdRef.current; const uid = userIdRef.current;
    if (!bid || !uid) return;
    // One chat entry posts once: ignore repeat clicks while it's sending or after it's posted
    if (postingRef.current.has(msgId) || messagesRef.current.find(m => m.id === msgId)?.status === "posted") return;
    postingRef.current.add(msgId);

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "confirmed" } : m));
    try {
      const res = await fetch("/api/finance/chat-book/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // client_key makes the server post this entry at most once, even if the request is sent again
        body: JSON.stringify({ transaction, business_id: bid, user_id: uid, session_id: sessId, original_message: originalMsg, account_heads: accountHeads, client_key: `${uid}:${msgId}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.needs_heads) {
        // New ledger whose group isn't obvious — ask on the card, then post again
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "pending", transaction, needsHeads: data.needs_heads, willCreate: data.will_create, postArgs: { sessId, originalMsg } } : m));
        return;
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "posted", needsHeads: undefined, entryNo: data.entry_no, journalId: data.journal_id, transaction, createdLedgers: data.created_ledgers, ledgerAccountIds: ((data.lines ?? []) as { account_id: string; account_name: string }[]).map(l => ({ id: l.account_id, name: l.account_name })) } : m));
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "pending" } : m));
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: "system", text: `⚠ Post failed: ${e instanceof Error ? e.message : "Error"}`, timestamp: Date.now() }]);
    } finally {
      postingRef.current.delete(msgId);
    }
  }

  function startEdit(msg: ChatMessage) {
    if (!msg.transaction) return;
    setEditingMsg(msg.id);
    setEditLines(JSON.parse(JSON.stringify(msg.transaction.lines)));
    setEditDate(msg.transaction.transaction_date);
    setEditNarration(msg.transaction.narrative ?? "");
  }

  function applyEdit(msgId: string) {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.transaction) return m;
      return { ...m, status: "edited", transaction: { ...m.transaction, transaction_date: editDate, narrative: editNarration, lines: editLines } };
    }));
    setEditingMsg(null);
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  // Live words while listening, the reason when it can't listen, and the language to listen in
  const voiceBar = (listening || voiceInterim || voiceMsg) ? (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: "0.82rem", padding: "8px 12px", borderRadius: 12, background: voiceMsg ? "#FDECEA" : "#EEF6F1", color: voiceMsg ? "#C2321F" : "#0B7A55" }}>
      {listening && <span className="fb-mic-dot" aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#C2321F", flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 160 }}>{voiceMsg || (voiceInterim ? <>Hearing: <i style={{ color: "#10241F" }}>{voiceInterim}</i></> : "Listening… speak now. It stops after a few seconds of silence.")}</span>
      <select aria-label="Voice language" value={voiceLang} onChange={e => { setVoiceLang(e.target.value); if (listening) { stopVoice(); } }} style={{ height: 36, minWidth: 150, padding: "0 28px 0 10px", lineHeight: "normal", boxSizing: "border-box", borderRadius: 9, border: "1px solid #D8CDB4", background: "#FFFFFF", color: "#10241F", fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit" }}>
        {[["en-IN", "English (India)"], ["hi-IN", "हिन्दी"], ["ml-IN", "മലയാളം"], ["ta-IN", "தமிழ்"], ["ar-AE", "العربية"], ["en-US", "English (US)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {listening ? <button onClick={stopVoice} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: "#C2321F", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>Stop</button>
        : <button onClick={() => setVoiceMsg("")} aria-label="Dismiss" style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "1.25rem", lineHeight: 1 }}>×</button>}
    </div>
  ) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fb-root" style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BG, color: TEXT, fontFamily: "'Manrope',system-ui,sans-serif", overflow: "hidden" }}>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      {/* Top nav */}
      <nav className="fb-top" style={{ borderBottom: "1px solid rgba(217,181,111,0.18)", padding: "0 1rem", display: "flex", alignItems: "center", gap: "0.6rem", height: 60, background: "#0F2B25", flexShrink: 0, zIndex: 20, overflowX: "auto", paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => setSidebarOpen(o => !o)} aria-label="Previous chats" style={{ background: "none", border: "none", color: "#C9D3CE", cursor: "pointer", fontSize: "1.1rem", padding: "4px 8px" }}>☰</button>
        <Link href="/finance" style={{ display: "flex", alignItems: "baseline", gap: 8, textDecoration: "none" }}><span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontWeight: 700, fontSize: "1.45rem", color: "#FFFFFF" }}>FreBook</span><span className="fb-tag" style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontStyle: "italic", fontSize: "0.85rem", color: "#D9B56F" }}>Chat in. Books out.</span></Link>
                <Link href="/finance/select-business" title="Switch business" style={{ marginLeft: 10, fontSize: "0.78rem", fontWeight: 700, color: "#E7ECE9", border: "1px solid rgba(217,181,111,0.3)", background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", textDecoration: "none" }}>{bizName} <span aria-hidden="true" style={{ color: "#D9B56F" }}>⇄</span></Link>
        <div style={{ flex: 1 }} />
        <InstallApp />
        {[
          { href: "/finance/journals", label: "Journal" },
          { href: "/finance/ledger", label: "Ledger" },
          { href: "/finance/reports?tab=trial_balance", label: "TB" },
          { href: "/finance/reports?tab=profit_loss", label: "P&L" },
          { href: "/finance/reports?tab=balance_sheet", label: "BS" },
          { href: "/finance/audit", label: "Analysis" },
        ].map(l => (
          <Link key={l.label} href={l.href} className="fb-toplink" style={{ fontSize: "0.82rem", fontWeight: 600, color: "#E7ECE9", textDecoration: "none", padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap" }}>{l.label}</Link>
        ))}
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{ width: 220, borderRight: `1px solid ${BORDER}`, background: SIDEBAR, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem" }}>
              <button onClick={newChat} style={{ width: "100%", background: GOLD, color: "#F5F6FA", border: "none", padding: "8px 0", borderRadius: 9, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ✦ New Chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 0.5rem 0.5rem" }}>
              {sessions.length === 0 && <div style={{ fontSize: "0.72rem", color: MUTED, padding: "0.5rem 0.5rem" }}>No sessions yet</div>}
              {sessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s.id)} style={{ width: "100%", textAlign: "left", background: currentSession === s.id ? "rgba(35,42,99,0.1)" : "transparent", border: `1px solid ${currentSession === s.id ? "rgba(35,42,99,0.25)" : "transparent"}`, color: currentSession === s.id ? GOLD : TEXT, padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.76rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title || "Untitled session"}
                </button>
              ))}
            </div>
            <div style={{ padding: "0.5rem 0.75rem", borderTop: `1px solid ${BORDER}`, fontSize: "0.65rem", color: MUTED }}>
              AI-generated entries require confirmation before posting.
            </div>
          </aside>
        )}

        {/* Command Desk — clean start screen until the first message */}
        {!messages.some(m => m.role !== "system") && !loading && rowQueue.length === 0 ? (
          <div className="fb-desk" style={{ flex: 1, overflowY: "auto", background: "#F6F1E7" }}>
            {/* Forest hero: headline left, composer right */}
            <section className="fb-herowrap" style={{ background: "#0F2B25", color: "#F6F1E7", padding: "clamp(28px, 5vw, 56px) clamp(16px, 4vw, 48px)" }}>
              <div className="fb-hero" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)", gap: "clamp(24px, 4vw, 56px)", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#D9B56F" }}>
                    <span aria-hidden="true" style={{ width: 28, height: 1, background: "#D9B56F" }} />AI bookkeeping · {bizName}
                  </div>
                  <h1 className="fb-h1" style={{ margin: 0, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "clamp(2.2rem, 5vw, 3.9rem)", lineHeight: 1.04, fontWeight: 700, color: "#FFFFFF", textWrap: "balance" }}>
                    What happened in the <span style={{ fontStyle: "italic", fontWeight: 400, color: "#D9B56F" }}>business</span> today?
                  </h1>
                  <p className="fb-more" style={{ margin: 0, fontSize: "1.02rem", lineHeight: 1.6, color: "#C9D3CE", maxWidth: 470 }}>Say it the way you&apos;d tell your accountant. FreBook prepares the entry — debit, credit, GST — and waits for your nod.</p>
                  <ul className="fb-more" style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {[["M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z M9 12l2 2 4-4", "Nothing posts until you confirm"], ["M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a2.5 2.5 0 005 0zM19 8l-2.5 6a2.5 2.5 0 005 0", "Every draft balanced, double-entry"], ["M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2", "Full audit trail on every change"]].map(([d, t]) => (
                      <li key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.92rem", color: "#E7ECE9" }}>
                        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(217,181,111,0.35)", background: "rgba(217,181,111,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D9B56F", flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                        </span>{t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Composer card */}
                <div style={{ background: "#F6F1E7", borderRadius: 24, border: "1px solid #D9B56F", boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)", color: "#10241F", overflow: "hidden" }}>
                  <div style={{ background: "#FFFFFF", borderRadius: "22px 22px 0 0", padding: "14px 14px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div role="tablist" style={{ display: "flex", gap: 4, background: "#EFE8D9", borderRadius: 999, padding: 4 }}>
                        {(["Record", "Ask"] as const).map(m => {
                          const on = (m === "Ask") === /^(how|what|who|which|show|list|why|when)\b|\?$/i.test(input.trim());
                          return (
                            <button key={m} role="tab" aria-selected={on} onClick={() => { if (m === "Ask" && !input) setInput("What's my cash today?"); inputRef.current?.focus(); }} style={{ height: 34, padding: "0 16px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6, background: on ? "#0F2B25" : "transparent", color: on ? "#FFFFFF" : "#4D5B56", fontFamily: "inherit" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m === "Record" ? "M4 20h4L19 9l-4-4L4 16zM14 6l4 4" : "M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"} /></svg>{m}
                            </button>
                          );
                        })}
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: "0.74rem", fontWeight: 700, color: "#8A6420" }}>✦ FreBook AI</span>
                    </div>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      autoFocus
                      aria-label="Describe a transaction or ask a question"
                      placeholder="e.g. Paid office rent ₹25,000 from the bank — or ask: how much do customers owe me?"
                      rows={4}
                      style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", borderBottom: "1px solid #EAE3D3", padding: "18px 6px 14px", color: "#10241F", fontSize: "1.05rem", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.55 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0 14px" }}>
                      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                      {[
                        { t: "Attach bill, invoice, statement, Excel or photo", d: "M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.5 3.5 0 015 5l-8.6 8.6a2 2 0 01-2.8-2.8l7.9-7.9", run: () => fileRef.current?.click() },
                        { t: "Snap a bill with your camera", d: "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7", run: () => cameraRef.current?.click() },
                        { t: listening ? "Stop voice input" : "Voice input", d: listening ? "M7 7h10v10H7z" : "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3", run: toggleVoice },
                        { t: "Book a bank statement", d: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18", run: () => fileRef.current?.click() },
                      ].map(b => (
                        <button key={b.t} onClick={b.run} title={b.t} aria-label={b.t} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: listening && b.t.startsWith("Stop") ? "#FDECEA" : "transparent", color: listening && b.t.startsWith("Stop") ? "#C2321F" : "#4D5B56", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={b.d} /></svg>
                        </button>
                      ))}
                      <span style={{ flex: 1, textAlign: "right", fontSize: "0.74rem", color: "#6B7570", paddingRight: 10 }}>Enter ↵ to send</span>
                      <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0F2B25", border: "none", color: "#FFFFFF", padding: "0 8px 0 22px", height: 48, borderRadius: 999, cursor: input.trim() ? "pointer" : "default", fontWeight: 800, fontSize: "0.95rem", fontFamily: "inherit", opacity: input.trim() ? 1 : 0.6 }}>
                        Send <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", background: "#D9B56F", color: "#0F2B25", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg></span>
                      </button>
                    </div>
                  </div>
                  {voiceBar && <div style={{ padding: "10px 14px 0" }}>{voiceBar}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 14px 14px" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", color: "#8A6420", marginRight: 4 }}>TRY</span>
                    {["Paid salary ₹42,000 to Anu", "Sold goods ₹85,000 + GST to Kumar Traders", "What's my cash today?"].map(t => (
                      <button key={t} onClick={() => { setInput(t); inputRef.current?.focus(); }} style={{ height: 34, padding: "0 13px", borderRadius: 999, border: "1px solid #E0D6C1", background: "#FFFFFF", color: "#2E3B36", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(28px, 5vw, 56px) clamp(16px, 4vw, 48px)", display: "flex", flexDirection: "column", gap: 48 }}>
              {snapHint && <button onClick={() => { setSnapHint(false); cameraRef.current?.click(); }} style={{ height: 64, borderRadius: 16, border: "none", background: "#0F2B25", color: "#FFFFFF", fontSize: "1.05rem", fontWeight: 800, cursor: "pointer" }}>📷 Open camera to snap a bill</button>}

              {/* Record */}
              <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>RECORD</div>
                    <h2 style={{ margin: "6px 0 0", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 700, color: "#10241F" }}>Start an entry in one tap</h2>
                  </div>
                  <Link href="/finance/sales/new" style={{ color: "#8A6420", fontWeight: 800, fontSize: "0.9rem", textDecoration: "none" }}>All voucher types →</Link>
                </div>
                <div className="fb-tiles6" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 14 }}>
                  {[
                    { label: "Money paid", sub: "Rent, salary, supplier", d: "M7 17L17 7M9 7h8v8", run: () => { setInput("Paid "); inputRef.current?.focus(); } },
                    { label: "Money received", sub: "Customer, loan, capital", d: "M17 7L7 17M15 17H7V9", run: () => { setInput("Received "); inputRef.current?.focus(); } },
                    { label: "Snap a bill", sub: "Photo to purchase entry", d: "M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M8 9h8M8 12h8M8 15h5", run: () => cameraRef.current?.click() },
                    { label: "Sales invoice", sub: "Raise with GST", d: "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4", run: () => router.push("/finance/sales/new") },
                    { label: "Purchase bill", sub: "Supplier bill, ITC", d: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9", run: () => router.push("/finance/purchases/new") },
                    { label: "Bank transfer", sub: "Contra entry", d: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4", run: () => { setInput("Transferred "); inputRef.current?.focus(); } },
                  ].map(t => (
                    <button key={t.label} onClick={t.run} className="fb-tile" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, textAlign: "left", background: "#FFFFFF", border: "1px solid #E6DFD0", borderRadius: 18, padding: "20px 18px 22px", color: "#10241F", cursor: "pointer", fontFamily: "inherit", minHeight: 170 }}>
                      <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: "50%", background: "#0F2B25", color: "#D9B56F", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "1rem", fontWeight: 700 }}>{t.label}</span>
                        <span style={{ fontSize: "0.8rem", color: "#5E6B66", lineHeight: 1.4 }}>{t.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Ask */}
              <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>ASK YOUR BOOKS</div>
                  <h2 style={{ margin: "6px 0 0", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 700, color: "#10241F" }}>Answers with the ledgers behind them</h2>
                </div>
                <div className="fb-ask" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
                  {[
                    { label: "Who owes me?", sub: "Receivables by age", q: "How much am I owed?", d: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 14a3 3 0 100 6 3 3 0 000-6z" },
                    { label: "Profit this month", sub: "Versus last month", q: "Profit this month vs last month", d: "M4 17l6-6 4 4 6-8M14 7h6v6" },
                    { label: "Biggest expenses", sub: "Top heads this month", q: "Biggest expenses this month", d: "M12 3a9 9 0 109 9h-9zM14 3.3A9 9 0 0120.7 10H14z" },
                    { label: "Cash position", sub: "Cash & bank, today", q: "What's my cash and bank balance today?", d: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v.01M18 14v.01" },
                    { label: "GST payable", sub: "Output tax less ITC", q: "GST payable this month — output tax less input credit", d: "M19 5L5 19M7 9a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" },
                    { label: "Upcoming dues", sub: "Bills, EMIs, TDS", q: "What payments are due in the next 30 days?", d: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3" },
                  ].map(t => (
                    <button key={t.label} onClick={() => sendMessage(t.q)} className="fb-tile" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left", background: "#FFFFFF", border: "1px solid #E6DFD0", borderRadius: 16, padding: "16px 18px", color: "#10241F", cursor: "pointer", fontFamily: "inherit" }}>
                      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, background: "#F3E8D2", color: "#8A6420", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
                      </span>
                      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "1.08rem", fontWeight: 700 }}>{t.label}</span>
                        <span style={{ fontSize: "0.8rem", color: "#5E6B66" }}>{t.sub}</span>
                      </span>
                      <span aria-hidden="true" style={{ color: "#8A6420", fontSize: "1.1rem" }}>→</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Footer strip */}
              <div className="fb-more" style={{ background: "#FFFFFF", border: "1px solid #E6DFD0", borderRadius: 16, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "1.1rem", fontWeight: 700, color: "#10241F", flex: 1, minWidth: 220 }}>Your books, in conversation.</span>
                <Link href="/finance/whatsapp" style={{ color: "#2E3B36", fontSize: "0.85rem", textDecoration: "none" }}>💬 Entries via WhatsApp</Link>
                <button onClick={downloadTemplate} style={{ background: "none", border: "none", color: "#2E3B36", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", padding: 0 }}>⬇ Excel template for bulk entries</button>
                {sessions.length > 0 && <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "#2E3B36", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", padding: 0 }}>🕘 Previous chats ({sessions.length})</button>}
              </div>
            </div>
          </div>
        ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {openDrafts > 0 && (
            <div role="status" style={{ margin: "0.6rem 1.25rem 0", padding: "8px 12px", borderRadius: 10, background: "#FFF4DB", color: "#8A5A00", fontSize: "0.8rem", fontWeight: 600 }}>
              {openDrafts} unposted draft{openDrafts === 1 ? "" : "s"} — post or cancel {openDrafts === 1 ? "it" : "them"}. They're kept on this device if you leave.
            </div>
          )}
          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {messages.map(msg => (
              <div key={msg.id}>
                {/* User bubble */}
                {msg.role === "user" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "65%", background: "rgba(35,42,99,0.12)", border: `1px solid rgba(35,42,99,0.2)`, borderRadius: "14px 14px 4px 14px", padding: "10px 14px", fontSize: "0.88rem", lineHeight: 1.6 }}>
                      {msg.text}
                    </div>
                  </div>
                )}

                {/* System message */}
                {msg.role === "system" && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ maxWidth: "80%", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 16px", fontSize: "0.83rem", color: MUTED, lineHeight: 1.7, whiteSpace: "pre-wrap" }}
                      dangerouslySetInnerHTML={{ __html: (msg.text ?? "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/•/g, "•") }} />
                  </div>
                )}

                {/* Answer from the books */}
                {msg.role === "ai" && msg.answer && <AnswerCard answer={msg.answer} />}

                {/* AI response */}
                {msg.role === "ai" && !msg.answer && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {/* Clarification question */}
                      {msg.transaction?.status === "needs_clarification" && (
                        <div style={{ background: "rgba(31,94,255,0.07)", border: `1px solid rgba(31,94,255,0.2)`, borderRadius: 12, padding: "12px 16px", fontSize: "0.88rem", color: BLUE, lineHeight: 1.6 }}>
                          🤔 {msg.text ?? msg.transaction.needs_clarification[0]}
                        </div>
                      )}

                      {/* Compliance + smart checks, shown above the entry so they're read before posting */}
                      {msg.transaction && msg.transaction.status === "complete" && msg.status !== "posted" && msg.status !== "cancelled" && (
                        <ReviewChecks bizId={bizId}
                          date={editingMsg === msg.id ? editDate : msg.transaction.transaction_date}
                          lines={(editingMsg === msg.id ? editLines : msg.transaction.lines).map(l => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))}
                          onResult={r => setViolations(v => ({ ...v, [msg.id]: r.checks.filter(c => c.tone === "bad").map(c => c.title) }))} />
                      )}
                      {/* Transaction card */}
                      {msg.transaction && msg.transaction.status === "complete" && (
                        <TransactionCard
                          msg={msg}
                          editing={editingMsg === msg.id}
                          editLines={editLines}
                          editDate={editDate}
                          editNarration={editNarration}
                          onEditLines={setEditLines}
                          onEditDate={setEditDate}
                          onEditNarration={setEditNarration}
                          onStartEdit={() => startEdit(msg)}
                          onApplyEdit={() => applyEdit(msg.id)}
                          onCancelEdit={() => setEditingMsg(null)}
                          onConfirm={() => {
                            const tx = editingMsg === msg.id
                              ? { ...msg.transaction!, transaction_date: editDate, narrative: editNarration, lines: editLines }
                              : msg.transaction!;
                            const lastUser = [...messages].reverse().find(m => m.role === "user");
                            const run = () => postTransaction(tx, currentSession, lastUser?.text ?? "", msg.id);
                            const warnings = postWarnings({ compliance: violations[msg.id], questions: msg.verdict?.questions, duplicate: msg.duplicate });
                            if (warnings.length) { setConfirmPost({ msgId: msg.id, warnings, run }); return; }
                            run();
                          }}
                          onSwapAccount={alt => setMessages(prev => prev.map(m => {
                            if (m.id !== msg.id || !m.transaction) return m;
                            const from = m.transaction.counter_account;
                            return { ...m, status: "edited", transaction: {
                              ...m.transaction, counter_account: alt, account_confidence: 1,
                              alternatives: [...(from ? [from] : []), ...(m.transaction.alternatives ?? []).filter(a => a !== alt)].slice(0, 3),
                              lines: m.transaction.lines.map(l => l.account === from ? { ...l, account: alt, confidence: 1, is_new_account: false } : l),
                              rule: m.transaction.rule && from ? m.transaction.rule.replace(from, alt) : m.transaction.rule,
                            } };
                          }))}
                          onPostWithHeads={heads => postTransaction(msg.transaction!, msg.postArgs?.sessId ?? currentSession, msg.postArgs?.originalMsg ?? "", msg.id, heads)}
                          onCancel={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "cancelled" } : m))}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 18px", display: "flex", gap: 6, alignItems: "center" }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, display: "inline-block", animation: `bounce 0.9s ease-in-out ${i * 0.15}s infinite` }} />)}
                  <span style={{ fontSize: "0.78rem", color: MUTED, marginLeft: 4 }}>Analysing transaction…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: "0.75rem 1.25rem", background: "rgba(255,255,255,0.95)", flexShrink: 0 }}>
            {rowQueue.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(31,94,255,0.08)", border: "1px solid rgba(31,94,255,0.25)", borderRadius: 10, padding: "0.5rem 0.9rem", marginBottom: "0.6rem", fontSize: "0.78rem", color: BLUE }}>
                <span style={{ fontWeight: 700 }}>Excel import: {batchTotal - rowQueue.length} of {batchTotal} sent</span>
                {messages[messages.length - 1]?.transaction?.status === "needs_clarification" && <span style={{ color: AMBER }}>Paused — answer the question below to continue</span>}
                <button onClick={() => setRowQueue([])} style={{ marginLeft: "auto", background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: "3px 10px", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>Stop</button>
              </div>
            )}
            {/* Quick action chips */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={downloadTemplate} style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(11,122,85,0.35)", background: "rgba(11,122,85,0.08)", color: GREEN, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", fontWeight: 600 }}>
                ⬇ Excel template
              </button>
              <button onClick={() => fileRef.current?.click()} style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(35,42,99,0.35)", background: "rgba(35,42,99,0.08)", color: GOLD, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", fontWeight: 600 }}>
                📎 Upload Excel / PDF / Word / photo
              </button>
              {["Paid rent ₹25,000 by bank", "Received cash ₹10,000 from customer", "How much am I owed?", "Biggest expenses this year", "Profit this month vs last month"].map(chip => (
                <button key={chip} onClick={() => { setInput(chip); inputRef.current?.focus(); }} style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 20, border: `1px solid ${BORDER}`, background: "#FFFFFF", color: MUTED, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {chip}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a transaction… e.g. 'Paid office rent ₹25,000 from the bank'"
                rows={2}
                style={{ flex: 1, background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "10px 14px", borderRadius: 12, fontSize: "0.9rem", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5 }}
              />
              {/* Attachment */}
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} title="Attach bill, invoice, Excel, Word or photo" style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: MUTED, width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}>📎</button>
              <button onClick={() => cameraRef.current?.click()} title="Snap a bill with your camera" aria-label="Snap a bill" style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: MUTED, width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: "1rem", flexShrink: 0 }}>📷</button>
              {/* Voice */}
              <button onClick={toggleVoice} title="Voice input" style={{ background: listening ? "rgba(194,50,31,0.15)" : "#FFFFFF", border: `1px solid ${listening ? "rgba(194,50,31,0.4)" : BORDER}`, color: listening ? RED : MUTED, width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}>
                {listening ? "⏹" : "🎙"}
              </button>
              {/* Send */}
              <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{ background: GOLD, border: "none", color: "#F5F6FA", width: 40, height: 40, borderRadius: 10, cursor: loading ? "wait" : "pointer", fontSize: "1.15rem", flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1 }}>→</button>
            </div>
            {voiceBar && <div style={{ marginTop: "0.5rem" }}>{voiceBar}</div>}
            <div style={{ fontSize: "0.66rem", color: MUTED, marginTop: "0.4rem" }}>Enter to send · Shift+Enter for newline · All AI entries require confirmation before posting</div>
          </div>
        </div>
        )}
      </div>

      {confirmPost && (
        <div role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={() => setConfirmPost(null)} style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(15,43,37,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 18, maxWidth: 520, width: "100%", padding: 22, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5)", borderTop: "5px solid #C2321F" }}>
            <div id="cp-title" style={{ fontSize: "1.05rem", fontWeight: 800, color: "#C2321F" }}>Check before posting</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: "0.9rem", lineHeight: 1.5, color: "#10241F" }}>
              {confirmPost.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <div style={{ fontSize: "0.8rem", color: "#5E6B66" }}>Better: go back, use Edit to fix it, then post.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button autoFocus onClick={() => setConfirmPost(null)} style={{ height: 42, padding: "0 18px", borderRadius: 11, border: "1px solid #D8CDB4", background: "#FFFFFF", color: "#10241F", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Go back and fix</button>
              <button onClick={() => { const r = confirmPost.run; setConfirmPost(null); r(); }} style={{ height: 42, padding: "0 18px", borderRadius: 11, border: "none", background: "#C2321F", color: "#FFFFFF", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Post anyway</button>
            </div>
          </div>
        </div>
      )}
      {simpleBulk && bizId && (
        <SimpleTemplateModal fileName={simpleBulk.fileName} fileKey={simpleBulk.fileKey} entries={simpleBulk.entries} bizId={bizId}
          onClose={() => setSimpleBulk(null)}
          onPosted={(count, total) => setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `✓ Posted ${count} entr${count > 1 ? "ies" : "y"} (₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}) from ${simpleBulk.fileName}. See them in 📚 Books.`, timestamp: Date.now() }])} />
      )}
      {bulk && bizId && userId && (
        <BulkTemplateModal fileName={bulk.fileName} fileKey={bulk.fileKey} sentences={bulk.sentences} bizId={bizId} userId={userId}
          onClose={() => setBulk(null)}
          onPosted={(count, total) => setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `✓ Posted ${count} template entr${count > 1 ? "ies" : "y"} (₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}) from ${bulk.fileName}. See them in 📚 Books.`, timestamp: Date.now() }])}
          onSendToChat={list => { setBatchTotal(list.length); setRowQueue(list); setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `📊 ${list.length} rows need more detail — answering them here one by one.`, timestamp: Date.now() }]); }} />
      )}

      {statementFile && bizId && userId && (
        <StatementModal
          file={statementFile} bizId={bizId} userId={userId}
          onClose={() => setStatementFile(null)}
          onPosted={(count, total) => setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "system", text: `✓ Posted ${count} bank transaction${count > 1 ? "s" : ""} (₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}) from ${statementFile.name}. See them in 📚 Books.`, timestamp: Date.now() }])}
        />
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes spin { to { transform:rotate(360deg) } }
        .fb-tile { transition: border-color .15s, background .15s; }
        .fb-tile:hover, .fb-tile:focus-visible { border-color: #C99A4E !important; box-shadow: 0 14px 30px -18px rgba(15,43,37,0.45); outline: none; }
        .fb-tile { transition: border-color .15s, box-shadow .15s, transform .15s; } .fb-tile:hover { transform: translateY(-2px); }
        @media (max-width: 1100px) { .fb-hero { grid-template-columns: minmax(0,1fr) !important; } .fb-tiles6 { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } .fb-ask { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
        @media (max-width: 640px) { .fb-tiles6 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .fb-ask { grid-template-columns: minmax(0,1fr) !important; } }
        .fb-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: fbSpin .7s linear infinite; vertical-align: -2px; margin-right: 6px; } @keyframes fbSpin { to { transform: rotate(360deg); } }
        .fb-mic-dot { animation: fbPulse 1.2s ease-in-out infinite; } @keyframes fbPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
        .fb-toplink:hover, .fb-toplink:focus-visible { background: rgba(217,181,111,0.14); color: #FFFFFF !important; outline: none; }
        @media (max-width: 760px) {
          .fb-tag, .fb-more, .fb-toplink { display: none !important; }
          .fb-top { height: 52px !important; }
          .fb-herowrap { padding: 18px 14px 20px !important; }
          .fb-hero { gap: 14px !important; }
          .fb-h1 { font-size: 1.75rem !important; line-height: 1.12 !important; }
          .fb-tiles6 .fb-tile { min-height: 0 !important; padding: 14px !important; gap: 10px !important; }
          .fb-tiles6 .fb-tile > span:first-child { width: 40px !important; height: 40px !important; }
          .fb-ask .fb-tile { padding: 12px 14px !important; }
          .fb-desk h2 { font-size: 1.3rem !important; }
        }
        @media (prefers-reduced-motion: reduce) { .fb-tile, .fb-tile:hover { transition: none; transform: none; } }
        @media (max-width: 640px) { .fb-desk-groups { grid-template-columns: 1fr !important; } .fb-desk { justify-content: flex-start !important; } }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#FFFFFF;border-radius:2px}
      `}</style>
    </div>
  );
}

// ── Group picker for new ledgers ───────────────────────────────────────────────
function HeadPicker({ needs, willCreate, busy, onSubmit }: {
  needs: { account: string; suggested: string }[]; willCreate: { account: string; head: string }[];
  busy: boolean; onSubmit: (heads: Record<string, string>) => void;
}) {
  const [heads, setHeads] = useState<Record<string, string>>(() => Object.fromEntries(needs.map(n => [n.account, n.suggested])));
  return (
    <div style={{ padding: "0.8rem 1rem", borderTop: `1px solid rgba(184,120,0,0.25)`, background: "rgba(184,120,0,0.05)" }}>
      <div style={{ fontSize: "0.82rem", color: AMBER, fontWeight: 700, marginBottom: 8 }}>
        🤔 {needs.length === 1 ? "This is a new ledger." : "These are new ledgers."} Which group should {needs.length === 1 ? "it" : "they"} go under?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {needs.map(n => (
          <label key={n.account} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.82rem", flexWrap: "wrap" }}>
            <span style={{ minWidth: 160, fontWeight: 600 }}>{n.account}</span>
            <select value={heads[n.account]} onChange={e => setHeads(h => ({ ...h, [n.account]: e.target.value }))} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "6px 10px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit" }}>
              {LEDGER_HEADS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      {willCreate.length > 0 && (
        <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 8 }}>Also creating: {willCreate.map(w => `${w.account} → ${w.head}`).join(", ")}</div>
      )}
      <button onClick={() => onSubmit(heads)} disabled={busy} style={{ marginTop: 10, background: GREEN, color: "#F5F6FA", border: "none", padding: "7px 18px", borderRadius: 8, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}>
        {busy ? "Posting…" : "✓ Create ledger & Post"}
      </button>
    </div>
  );
}

// ── Transaction Card ───────────────────────────────────────────────────────────
function TransactionCard({ msg, editing, editLines, editDate, editNarration, onEditLines, onEditDate, onEditNarration, onStartEdit, onApplyEdit, onCancelEdit, onConfirm, onPostWithHeads, onSwapAccount, onCancel }: {
  onPostWithHeads: (heads: Record<string, string>) => void;
  onSwapAccount: (account: string) => void;
  msg: ChatMessage;
  editing: boolean;
  editLines: ParsedTransaction["lines"];
  editDate: string;
  editNarration: string;
  onEditLines: (l: ParsedTransaction["lines"]) => void;
  onEditDate: (d: string) => void;
  onEditNarration: (n: string) => void;
  onStartEdit: () => void;
  onApplyEdit: () => void;
  onCancelEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tx = msg.transaction!;
  const BORDER = "#E1E4EE";
  const lines = editing ? editLines : tx.lines;
  const totalDr = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCr = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;
  const icon = TXN_ICONS[tx.transaction_type] ?? "📒";
  const label = TXN_LABELS[tx.transaction_type] ?? tx.transaction_type;
  const isPosted = msg.status === "posted";
  const isCancelled = msg.status === "cancelled";
  const fmt = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.70)", GOLD = "#232A63", GREEN = "#0B7A55", RED = "#C2321F", AMBER = "#8A5A00", PURPLE = "#5B4BC4", BLUE = "#1F5EFF";
  const inputS: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "5px 8px", borderRadius: 6, fontSize: "0.78rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${isPosted ? "rgba(11,122,85,0.3)" : isCancelled ? "#FFFFFF" : "rgba(35,42,99,0.2)"}`, borderRadius: 14, overflow: "hidden", opacity: isCancelled ? 0.5 : 1 }}>

      {/* Header */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
        <div>
          <div style={{ fontSize: "0.7rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>I understood this as</div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{label}</div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Status comes from FreBook's checks — "Ready" only when nothing was assumed */}
        {msg.verdict && (() => {
          const st = msg.verdict.status;
          const [bg, fg, label] = st === "ready" ? ["rgba(11,122,85,0.1)", GREEN, "✓ Ready"] : st === "blocked" ? ["rgba(194,50,31,0.1)", RED, "⛔ Can't post"] : ["rgba(184,120,0,0.12)", AMBER, "Needs review"];
          return <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: fg }}>{label}</span>;
        })()}
        {isPosted && <span style={{ fontSize: "0.72rem", color: GREEN, fontWeight: 700 }}>✓ Posted</span>}
        {isCancelled && <span style={{ fontSize: "0.72rem", color: MUTED }}>Cancelled</span>}
      </div>

      {msg.verdict && !isPosted && (msg.verdict.blocked.length > 0 || msg.verdict.questions.length > 0 || msg.verdict.assumptions.length > 0) && (
        <div style={{ padding: "0.7rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem", background: msg.verdict.status === "blocked" ? "rgba(194,50,31,0.05)" : "rgba(184,120,0,0.05)" }}>
          {msg.verdict.blocked.map((b, i) => <div key={"b" + i} style={{ color: RED, fontWeight: 700 }}>⛔ {b}</div>)}
          {msg.verdict.questions.map((q, i) => (
            <div key={"q" + i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700 }}>❓ {q.text}</span>
              {q.options && q.options.length > 0 && <span style={{ color: MUTED }}>Options: {q.options.join(" · ")} — use Edit to choose, then post.</span>}
            </div>
          ))}
          {msg.verdict.assumptions.map((a, i) => <div key={"a" + i} style={{ color: AMBER }}>• {a}</div>)}
        </div>
      )}

      {/* Meta row */}
      <div style={{ padding: "0.6rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
        {editing ? (
          <div style={{ display: "flex", gap: "0.75rem", flex: 1, flexWrap: "wrap" }}>
            <div style={{ minWidth: 120 }}>
              <div style={{ color: MUTED, marginBottom: 3, fontSize: "0.68rem", textTransform: "uppercase" }}>Date</div>
              <input type="date" value={editDate} onChange={e => onEditDate(e.target.value)} style={inputS} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: MUTED, marginBottom: 3, fontSize: "0.68rem", textTransform: "uppercase" }}>Narration</div>
              <input value={editNarration} onChange={e => onEditNarration(e.target.value)} style={inputS} />
            </div>
          </div>
        ) : (
          <>
            <div><span style={{ color: MUTED }}>Date: </span><strong>{new Date(tx.transaction_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
            {tx.party_name && <div><span style={{ color: MUTED }}>Party: </span><strong>{tx.party_name}</strong></div>}
            {tx.payment_mode && <div><span style={{ color: MUTED }}>Mode: </span><strong style={{ textTransform: "capitalize" }}>{tx.payment_mode}</strong></div>}
            {tx.invoice_number && <div><span style={{ color: MUTED }}>Ref: </span><strong>{tx.invoice_number}</strong></div>}
          </>
        )}
      </div>

      {/* GST block */}
      {tx.gst.applicable && (
        <div style={{ padding: "0.5rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "1.5rem", fontSize: "0.76rem", background: "rgba(31,94,255,0.04)" }}>
          <span style={{ color: BLUE, fontWeight: 700 }}>GST {tx.gst.rate}%</span>
          <span style={{ color: MUTED }}>Taxable: <strong style={{ color: TEXT }}>{fmt(tx.gst.taxable_value)}</strong></span>
          {tx.gst.cgst > 0 && <span style={{ color: MUTED }}>CGST: <strong style={{ color: TEXT }}>{fmt(tx.gst.cgst)}</strong></span>}
          {tx.gst.sgst > 0 && <span style={{ color: MUTED }}>SGST: <strong style={{ color: TEXT }}>{fmt(tx.gst.sgst)}</strong></span>}
          {tx.gst.igst > 0 && <span style={{ color: MUTED }}>IGST: <strong style={{ color: TEXT }}>{fmt(tx.gst.igst)}</strong></span>}
          <span style={{ fontSize: "0.66rem", color: tx.gst.transaction_type === "inter" ? PURPLE : BLUE, background: "rgba(31,94,255,0.1)", padding: "1px 7px", borderRadius: 10 }}>{tx.gst.transaction_type === "inter" ? "Inter-state" : "Intra-state"}</span>
        </div>
      )}

      {/* TDS block */}
      {tx.tds.applicable && (
        <div style={{ padding: "0.5rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "1.5rem", fontSize: "0.76rem", background: "rgba(184,120,0,0.04)" }}>
          <span style={{ color: AMBER, fontWeight: 700 }}>TDS {tx.tds.section}</span>
          <span style={{ color: MUTED }}>Rate: <strong style={{ color: TEXT }}>{tx.tds.rate}%</strong></span>
          <span style={{ color: MUTED }}>TDS Amount: <strong style={{ color: TEXT }}>{fmt(tx.tds.amount)}</strong></span>
          <span style={{ color: MUTED }}>Net Payment: <strong style={{ color: GREEN }}>{fmt(tx.tds.net_payment)}</strong></span>
        </div>
      )}

      {/* Journal entry table */}
      <div style={{ padding: "0 0 0.25rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ padding: "0.45rem 1rem", textAlign: "left", color: MUTED, fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>Account</th>
              <th style={{ padding: "0.45rem 1rem", textAlign: "right", color: MUTED, fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>Debit</th>
              <th style={{ padding: "0.45rem 1rem", textAlign: "right", color: MUTED, fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ borderBottom: `1px solid #E1E4EE` }}>
                <td style={{ padding: "0.45rem 1rem" }}>
                  {editing ? (
                    <input value={line.account} onChange={e => { const l = [...editLines]; l[i] = { ...l[i], account: e.target.value }; onEditLines(l); }} style={{ ...inputS, width: "100%", minWidth: 140 }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{line.account}</span>
                      {line.is_new_account && <span style={{ fontSize: "0.62rem", color: AMBER, background: "rgba(184,120,0,0.1)", padding: "1px 6px", borderRadius: 8, border: `1px solid rgba(184,120,0,0.25)` }}>New</span>}

                    </div>
                  )}
                </td>
                <td style={{ padding: "0.45rem 1rem", textAlign: "right", fontFamily: MONO, color: (editing ? line.debit : line.debit) > 0 ? RED : MUTED }}>
                  {editing ? (
                    <input type="number" value={line.debit || ""} onChange={e => { const l = [...editLines]; l[i] = { ...l[i], debit: parseFloat(e.target.value) || 0 }; onEditLines(l); }} style={{ ...inputS, textAlign: "right", width: 100 }} />
                  ) : line.debit > 0 ? fmt(line.debit) : "—"}
                </td>
                <td style={{ padding: "0.45rem 1rem", textAlign: "right", fontFamily: MONO, color: (editing ? line.credit : line.credit) > 0 ? GREEN : MUTED }}>
                  {editing ? (
                    <input type="number" value={line.credit || ""} onChange={e => { const l = [...editLines]; l[i] = { ...l[i], credit: parseFloat(e.target.value) || 0 }; onEditLines(l); }} style={{ ...inputS, textAlign: "right", width: 100 }} />
                  ) : line.credit > 0 ? fmt(line.credit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid #C9CEDF`, background: "#F7F8FC" }}>
              <td style={{ padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.8rem", color: MUTED }}>Total</td>
              <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: RED, fontSize: "0.88rem" }}>{fmt(totalDr)}</td>
              <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: GREEN, fontSize: "0.88rem" }}>{fmt(totalCr)}</td>
            </tr>
            {!balanced && <tr><td colSpan={3} style={{ padding: "0.4rem 1rem", fontSize: "0.75rem", color: RED, background: "rgba(194,50,31,0.07)" }}>⚠ Entry not balanced — Dr ≠ Cr. Edit the amounts before posting.</td></tr>}
          </tfoot>
        </table>
      </div>

      {/* Narrative */}
      {tx.narrative && !editing && (
        <div style={{ padding: "0.5rem 1rem", borderTop: `1px solid ${BORDER}`, fontSize: "0.76rem", color: MUTED, fontStyle: "italic" }}>
          {tx.narrative}
        </div>
      )}

      {/* Why — rule applied, AI reason, evidence from earlier entries, account choice */}
      {!editing && (tx.rule || tx.reason || tx.history_evidence) && (
        <div style={{ padding: "0.6rem 1rem", borderTop: `1px solid ${BORDER}`, background: "rgba(91,75,196,0.04)", display: "flex", flexDirection: "column", gap: 5, fontSize: "0.76rem" }}>
          <div style={{ fontSize: "0.62rem", color: PURPLE, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Why this entry</div>
          {tx.rule && <div><span style={{ color: MUTED }}>Accounting rule: </span><span style={{ color: TEXT }}>{tx.rule}</span></div>}
          {tx.reason && <div><span style={{ color: MUTED }}>Reading: </span><span style={{ color: TEXT }}>{tx.reason}</span></div>}
          {tx.history_evidence && <div><span style={{ color: MUTED }}>Your books: </span><span style={{ color: TEXT }}>{tx.history_evidence}</span></div>}
          {tx.counter_account && !isPosted && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ color: MUTED }}>Account:</span>
              <strong>{tx.counter_account}</strong>
              {typeof window !== "undefined" && /[?&]debug=1/.test(window.location.search) && typeof tx.account_confidence === "number" && (
                <span style={{ fontSize: "0.66rem", padding: "1px 7px", borderRadius: 10, color: tx.account_confidence >= 0.85 ? GREEN : tx.account_confidence >= 0.7 ? AMBER : RED, background: tx.account_confidence >= 0.85 ? "rgba(11,122,85,0.1)" : tx.account_confidence >= 0.7 ? "rgba(184,120,0,0.1)" : "rgba(194,50,31,0.1)" }}>
                  {tx.account_confidence < 0.7 ? "⚠ Needs review · " : ""}{Math.round(tx.account_confidence * 100)}%
                </span>
              )}
              {(tx.alternatives ?? []).length > 0 && <span style={{ color: MUTED, marginLeft: 6 }}>Or:</span>}
              {(tx.alternatives ?? []).map(alt => (
                <button key={alt} onClick={() => onSwapAccount(alt)} style={{ fontSize: "0.7rem", padding: "2px 9px", borderRadius: 12, border: `1px solid rgba(91,75,196,0.35)`, background: "rgba(91,75,196,0.08)", color: PURPLE, cursor: "pointer", fontFamily: "inherit" }}>{alt}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {tx.warnings.length > 0 && (
        <div style={{ padding: "0.4rem 1rem", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
          {tx.warnings.map((w, i) => <div key={i} style={{ fontSize: "0.74rem", color: AMBER }}>⚠ {w}</div>)}
        </div>
      )}

      {/* Duplicate warning */}
      {msg.duplicate && !isPosted && (
        <div style={{ padding: "0.5rem 1rem", borderTop: `1px solid rgba(184,120,0,0.2)`, background: "rgba(184,120,0,0.06)", fontSize: "0.76rem" }}>
          <div style={{ color: AMBER, fontWeight: 700, marginBottom: 4 }}>⚠ Possible duplicate: {msg.duplicate.entry_no} — {msg.duplicate.narration?.slice(0, 60)}</div>
        </div>
      )}

      {/* Posted confirmation */}
      {isPosted && (
        <div style={{ padding: "0.6rem 1rem", borderTop: `1px solid rgba(11,122,85,0.2)`, background: "rgba(11,122,85,0.05)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: GREEN, fontWeight: 700 }}>✓ Posted — {msg.entryNo}</span>
          {msg.createdLedgers?.length ? <span style={{ fontSize: "0.72rem", color: AMBER }}>New ledger{msg.createdLedgers.length > 1 ? "s" : ""}: {msg.createdLedgers.map(c => `${c.name} (${c.head})`).join(", ")}</span> : null}
          <Link href="/finance/books?filter=chat" style={{ fontSize: "0.75rem", color: GOLD, textDecoration: "none" }}>Books / Push to Tally →</Link>
          {msg.journalId && <Link href={`/finance/journals?id=${msg.journalId}`} style={{ fontSize: "0.75rem", color: BLUE, textDecoration: "none" }}>Journal →</Link>}
          {msg.ledgerAccountIds?.map((a, i) => (
            <Link key={a.id + i} href={`/finance/ledger?account=${a.id}`} style={{ fontSize: "0.75rem", color: MUTED, textDecoration: "none" }}>{a.name} ledger →</Link>
          ))}
          <Link href="/finance/reports?tab=trial_balance" style={{ fontSize: "0.75rem", color: MUTED, textDecoration: "none" }}>Trial Balance →</Link>
          <Link href="/finance/reports?tab=profit_loss" style={{ fontSize: "0.75rem", color: MUTED, textDecoration: "none" }}>P&amp;L →</Link>
          <Link href="/finance/reports?tab=balance_sheet" style={{ fontSize: "0.75rem", color: MUTED, textDecoration: "none" }}>Balance Sheet →</Link>
        </div>
      )}

      {/* New ledger needs a group */}
      {!isPosted && !isCancelled && msg.needsHeads?.length ? (
        <HeadPicker needs={msg.needsHeads} willCreate={msg.willCreate ?? []} busy={msg.status === "confirmed"} onSubmit={onPostWithHeads} />
      ) : null}

      {/* Action buttons */}
      {!isPosted && !isCancelled && !msg.needsHeads?.length && (
        <div style={{ padding: "0.65rem 1rem", borderTop: `1px solid ${BORDER}`, display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {editing ? (
            <>
              <button onClick={onApplyEdit} style={{ background: GOLD, color: "#F5F6FA", border: "none", padding: "7px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}>Apply Changes</button>
              <button onClick={onCancelEdit} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: MUTED, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={onConfirm} disabled={!balanced || !!msg.fyLocked || msg.status === "confirmed"} aria-busy={msg.status === "confirmed"} style={{ background: balanced && !msg.fyLocked ? GREEN : "rgba(11,122,85,0.15)", color: balanced && !msg.fyLocked ? "#F5F6FA" : "rgba(11,122,85,0.4)", border: "none", padding: "7px 20px", borderRadius: 8, fontWeight: 800, cursor: msg.status === "confirmed" ? "wait" : balanced && !msg.fyLocked ? "pointer" : "not-allowed", opacity: msg.status === "confirmed" ? 0.7 : 1, fontFamily: "inherit", fontSize: "0.84rem" }}>
                {msg.fyLocked ? "🔒 Period Locked" : msg.status === "confirmed" ? <><span className="fb-spin" aria-hidden="true" /> Posting…</> : "✓ Confirm & Post"}
              </button>
              <button onClick={onStartEdit} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}>✏ Edit</button>
              <button onClick={onCancel} style={{ background: "rgba(194,50,31,0.07)", border: `1px solid rgba(194,50,31,0.2)`, color: RED, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}>✕</button>
              {msg.status === "edited" && <span style={{ fontSize: "0.7rem", color: AMBER, marginLeft: 4 }}>● Edited</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
