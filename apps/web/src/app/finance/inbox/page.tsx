"use client";
// Smart Inbox — drop every statement, bill, invoice and Excel at once. FreWork reads each file,
// drafts the entries, marks each "Ready" or "Needs a look", posts the ready ones in one click
// and sends them to Tally. Nothing is posted until the user presses Approve.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { parseCashBankGrid, parseSimpleGrid, type SimpleLine } from "@/lib/simpleTemplate";
import GroupChips, { guessGroup } from "@/components/GroupChips";
import { useTally } from "@/lib/tallyConnection";
import { pushToTally } from "@/lib/tallyPushRun";
import { openDocs, matchLine, type OpenDoc, type MatchJournal } from "@/lib/billMatch";

type Line = { account: string; debit: number; credit: number };
type ItemState = "ready" | "check" | "posting" | "posted" | "failed";
type Item = {
  id: string; fileId: string; date: string; narration: string; amount: number; lines: Line[];
  state: ItemState; reason?: string; matched?: string; entryNo?: string; journalId?: string; tally?: "pushed" | "failed"; tallyError?: string;
  kind: "template" | "statement" | "bill";
};
type FileJob = { id: string; name: string; size: number; kind: string; status: "queued" | "reading" | "done" | "error"; note?: string; key: string };

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", amber: "#8A5A00", amberSoft: "#FFF4DB", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const isCashBank = (s: string) => /\b(cash|bank|hdfc|icici|sbi|axis|kotak|federal|canara|pnb|idfc|indusind|yes bank|credit card|card)\b/i.test(s);
const STATEMENT_NAME = /statement|stmt|passbook|e-?statement|account\s*summary/i;
const CARD_NAME = /credit\s*card|card\s*statement|\bcc\b|amex|visa|mastercard|rupay/i;
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

async function readGrid(file: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets["Entries"] ?? wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][];
}

export default function SmartInbox() {
  const router = useRouter();
  const tally = useTally();
  const [bizId, setBizId] = useState("");
  const [accounts, setAccounts] = useState<{ name: string; sub_type: string | null }[]>([]);
  const [bankLedger, setBankLedger] = useState("");
  const [cardLedger, setCardLedger] = useState("");
  const docsRef = useRef<OpenDoc[]>([]);
  const usedDocs = useRef<Set<string>>(new Set());
  const [files, setFiles] = useState<FileJob[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "check" | "posted">("all");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const queue = useRef<{ job: FileJob; file: File }[]>([]);
  const running = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const list: { name: string; sub_type: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("fw_fin_chart_of_accounts").select("name,sub_type").eq("business_id", saved).eq("is_group", false).range(from, from + 999);
        list.push(...((data ?? []) as { name: string; sub_type: string | null }[]));
        if (!data || data.length < 1000) break;
      }
      setAccounts(list);
      const bank = list.find(a => a.sub_type === "bank") ?? list.find(a => /bank/i.test(a.name));
      if (bank) setBankLedger(bank.name);
      const card = list.find(a => /credit\s*card/i.test(a.name));
      if (card) setCardLedger(card.name);
      // Unpaid sales and purchases (last 18 months) for matching statement lines
      const since = new Date(Date.now() - 548 * 86400000).toISOString().slice(0, 10);
      fetch(`/api/finance/books?business_id=${saved}&from=${since}`).then(r => r.json()).then(d => {
        const js = ((d.journals ?? []) as { id: string; entry_no: string; date: string; type: string; status: string; fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string } | null }[] }[])
          .filter(j => j.status === "posted")
          .map(j => ({ id: j.id, entry_no: j.entry_no, date: j.date, type: j.type, lines: (j.fw_fin_journal_lines ?? []).map(l => ({ name: l.fw_fin_chart_of_accounts?.name ?? "", dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })) })) as MatchJournal[];
        docsRef.current = openDocs(js);
      }).catch(() => { /* matching is a bonus */ });
    });
  }, [router]);

  const known = useMemo(() => new Set(accounts.map(a => a.name.trim().toLowerCase())), [accounts]);
  const isNew = useCallback((n: string) => !!n.trim() && !known.has(n.trim().toLowerCase()), [known]);

  // ── Reading files ──
  const addItems = (list: Item[]) => setItems(prev => [...prev, ...list]);
  const setJob = (id: string, patch: Partial<FileJob>) => setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const fromSimple = (job: FileJob, entries: ReturnType<typeof parseSimpleGrid>): Item[] =>
    (entries ?? []).map(e => ({
      id: uid("t"), fileId: job.id, date: e.date, narration: e.narration, amount: e.debit,
      lines: e.lines.map((l: SimpleLine) => ({ account: l.ledger, debit: l.debit, credit: l.credit })),
      state: e.error ? "check" : "ready", reason: e.error ?? undefined, kind: "template",
    }));

  async function readStatement(job: FileJob, file: File, card = CARD_NAME.test(file.name)) {
    const fd = new FormData(); fd.append("file", file); fd.append("business_id", bizId);
    const res = await fetch("/api/finance/parse-bank-pdf", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.transactions)) throw new Error(data.error ?? "Couldn't read this statement.");
    const rows = (data.transactions as { date: string; description: string; debit: number; credit: number }[])
      .filter(t => (Number(t.debit) || 0) > 0 || (Number(t.credit) || 0) > 0)
      .map((t, i) => ({ id: `${job.id}-${i}`, date: String(t.date ?? "").slice(0, 10), description: String(t.description ?? ""), debit: Number(t.debit) || 0, credit: Number(t.credit) || 0 }));
    const sugg = new Map<string, { account: string; confidence: number }>();
    for (let i = 0; i < rows.length; i += 25) {
      setJob(job.id, { note: `Matching ledgers ${Math.min(i + 25, rows.length)}/${rows.length}…` });
      try {
        const r = await fetch("/api/finance/bank-ai-categorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, rows: rows.slice(i, i + 25) }) });
        const s = await r.json();
        for (const x of (s.suggestions ?? []) as { id: string; account: string; confidence: number }[]) sugg.set(x.id, x);
      } catch { /* those rows stay "Needs a look" */ }
    }
    // A credit card statement: spends are debits on the card (a liability), payments to the card are credits
    const bank = card ? (cardLedger || "Credit Card") : (bankLedger || "Bank Account");
    let matched = 0;
    addItems(rows.map(r => {
      const s = sugg.get(r.id); const amount = r.debit || r.credit;
      let other = s?.account ?? "";
      const out = r.debit > 0;
      let sure = !!other && (s?.confidence ?? 0) >= 0.75;
      let reason: string | undefined = sure ? undefined : other ? "Not sure about the ledger" : "Choose a ledger";
      let matchedTo: string | undefined;
      // Money in/out against an unpaid sale or purchase → post to that customer / supplier
      const m = card ? null : matchLine(r, docsRef.current, usedDocs.current);
      if (m) {
        other = m.doc.ledger; matchedTo = `${m.doc.kind === "sale" ? "Sale" : "Bill"} ${m.doc.entryNo} · ${m.doc.date}`;
        if (m.sure) { usedDocs.current.add(m.doc.id); sure = true; reason = undefined; matched++; }
        else { sure = false; reason = `Possible match: ${m.doc.ledger} — ${matchedTo} (open ₹${m.doc.open.toLocaleString("en-IN")})`; }
      }
      return {
        id: uid("s"), fileId: job.id, date: r.date, narration: r.description.slice(0, 200), amount, kind: "statement" as const, matched: matchedTo,
        lines: out ? [{ account: other, debit: amount, credit: 0 }, { account: bank, debit: 0, credit: amount }] : [{ account: bank, debit: amount, credit: 0 }, { account: other, debit: 0, credit: amount }],
        state: sure ? "ready" as const : "check" as const, reason,
      };
    }));
    return `${rows.length} ${card ? "card " : ""}transactions${matched ? ` · ${matched} matched to bills` : ""}`;
  }

  async function readDocument(job: FileJob, file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    const fd = new FormData();
    fd.append("message", "Book this document"); fd.append("business_id", bizId); fd.append("user_id", user?.id ?? ""); fd.append("history", "[]"); fd.append("file", file);
    const res = await fetch("/api/finance/chat-book", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't read this file.");
    if (data.parsed?.document_kind === "bank_statement") return readStatement(job, file);
    if (data.multi?.sentences?.length) {
      // Several invoices in one PDF: split them and draft each one on its own
      const sentences = data.multi.sentences as string[];
      let readyCount = 0;
      for (let i = 0; i < sentences.length; i += 4) {
        setJob(job.id, { note: `Splitting: invoice ${Math.min(i + 4, sentences.length)} of ${sentences.length}…` });
        const parts = await Promise.all(sentences.slice(i, i + 4).map(async s => {
          try {
            const r = await fetch("/api/finance/chat-book/fast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: s, business_id: bizId, user_id: user?.id ?? "", history: [] }) });
            const d = await r.json();
            const p = d.parsed as { status: string; transaction_date: string; narrative: string; amount: number; confidence?: number; account_confidence?: number; lines: Line[]; needs_clarification?: string[] } | undefined;
            if (!r.ok || !p) throw new Error();
            const lines = (p.lines ?? []).map(l => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
            const sure = p.status === "complete" && lines.length >= 2 && (p.account_confidence ?? p.confidence ?? 1) >= 0.75;
            if (sure) readyCount++;
            return { id: uid("m"), fileId: job.id, date: p.transaction_date ?? "", narration: p.narrative || s.slice(0, 200), amount: Number(p.amount) || lines.reduce((t, l) => t + l.debit, 0), lines, kind: "bill" as const,
              state: sure ? "ready" as const : "check" as const, reason: sure ? undefined : p.needs_clarification?.[0] ?? "Check the ledgers" };
          } catch {
            return { id: uid("m"), fileId: job.id, date: "", narration: s.slice(0, 200), amount: 0, lines: [], state: "check" as const, reason: "Couldn't draft this one — open in FreBook", kind: "bill" as const };
          }
        }));
        addItems(parts);
      }
      return `${sentences.length} invoices split · ${readyCount} ready`;
    }
    const p = data.parsed as { status: string; transaction_date: string; narrative: string; amount: number; confidence?: number; account_confidence?: number; lines: Line[]; needs_clarification?: string[] } | undefined;
    if (!p) throw new Error("Nothing to book in this file.");
    const lines = (p.lines ?? []).map(l => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    const sure = p.status === "complete" && lines.length >= 2 && (p.account_confidence ?? p.confidence ?? 1) >= 0.75;
    addItems([{ id: uid("b"), fileId: job.id, date: p.transaction_date ?? "", narration: p.narrative ?? file.name, amount: Number(p.amount) || lines.reduce((s, l) => s + l.debit, 0), lines, kind: "bill",
      state: sure ? "ready" : "check", reason: sure ? undefined : p.needs_clarification?.[0] ?? "Check the ledgers" }]);
    return sure ? "1 entry ready" : "1 entry to check";
  }

  async function readOne(job: FileJob, file: File) {
    setJob(job.id, { status: "reading", note: "Reading…" });
    try {
      let note = "";
      if (/26\s?as|form[\s_-]?(16|130|168)/i.test(file.name) && /\.pdf$/i.test(file.name)) {
        setJob(job.id, { status: "done", note: "Tax document — open Reports → Form 168 / 130 to read it" });
        return;
      }
      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const grid = await readGrid(file);
        const tpl = parseCashBankGrid(grid) ?? parseSimpleGrid(grid);
        if (tpl && tpl.length) { addItems(fromSimple(job, tpl)); note = `${tpl.length} entries (template)`; }
        else note = await readStatement(job, file);
      } else if (STATEMENT_NAME.test(file.name) || CARD_NAME.test(file.name)) note = await readStatement(job, file);
      else note = await readDocument(job, file);
      setJob(job.id, { status: "done", note });
    } catch (e) {
      setJob(job.id, { status: "error", note: e instanceof Error ? e.message : "Couldn't read this file" });
    }
  }

  const pump = useCallback(() => {
    while (running.current < 3 && queue.current.length) {
      const next = queue.current.shift()!; running.current++;
      readOne(next.job, next.file).finally(() => { running.current--; pump(); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, bankLedger]);

  function addFiles(list: FileList | File[]) {
    const accepted = Array.from(list).filter(f => /\.(pdf|png|jpe?g|webp|heic|xlsx|xls|csv)$/i.test(f.name));
    const jobs = accepted.map(f => ({ job: { id: uid("f"), name: f.name, size: f.size, kind: /\.(xlsx|xls|csv)$/i.test(f.name) ? "Excel" : /\.pdf$/i.test(f.name) ? "PDF" : "Photo", status: "queued" as const, key: `${f.name}-${f.size}-${f.lastModified}` }, file: f }));
    setFiles(prev => [...prev, ...jobs.map(j => j.job)]);
    queue.current.push(...jobs);
    pump();
    if (accepted.length < Array.from(list).length) setMsg(`${Array.from(list).length - accepted.length} file(s) skipped — only PDF, photos, Excel and CSV are read.`);
  }

  // ── New ledgers used by entries waiting to post ──
  const newLedgers = useMemo(() => {
    const m = new Map<string, "in" | "out" | null>();
    for (const it of items) if (it.state === "ready" || it.state === "check") for (const l of it.lines) {
      if (!isNew(l.account) || m.has(l.account)) continue;
      if (/credit\s*card/i.test(l.account)) { m.set(l.account, null); continue; }
      const cb = it.lines.find(x => isCashBank(x.account));
      m.set(l.account, cb ? (cb.debit > 0 ? "in" : "out") : null);
    }
    return m;
  }, [items, isNew]);
  useEffect(() => {
    setHeads(h => { const n = { ...h }; let changed = false; for (const [name, side] of newLedgers) if (!n[name]) { n[name] = guessGroup(name, side); changed = true; } return changed ? n : h; });
  }, [newLedgers]);

  // ── Approve & post ──
  async function post(list: Item[]) {
    const todo = list.filter(i => (i.state === "ready" || i.state === "failed") && i.lines.length >= 2 && i.lines.every(l => l.account.trim()) && i.date);
    if (!todo.length || !bizId) return;
    setBusy("Posting…"); setMsg("");
    const fileKey = new Map(files.map(f => [f.id, f.key]));
    let ok = 0;
    for (let i = 0; i < todo.length; i += 100) {
      const chunk = todo.slice(i, i + 100);
      setBusy(`Posting ${i + 1}–${i + chunk.length} of ${todo.length}…`);
      setItems(prev => prev.map(x => chunk.some(c => c.id === x.id) ? { ...x, state: "posting" } : x));
      const payload = chunk.map(it => ({
        ref: it.id, client_key: `inbox:${fileKey.get(it.fileId)}:${it.narration.slice(0, 40)}:${it.date}:${it.amount}`.slice(0, 160),
        original_message: `Smart Inbox: ${it.narration}`,
        transaction: { status: "complete", transaction_date: it.date, transaction_type: it.lines.some(l => isCashBank(l.account) && l.credit > 0) ? "payment" : it.lines.some(l => isCashBank(l.account) && l.debit > 0) ? "receipt" : "journal",
          narrative: it.narration.slice(0, 200), amount: it.amount, party_name: null, party_type: null, invoice_number: null, payment_mode: null, bank_account_name: null,
          lines: it.lines.map(l => ({ account: l.account.trim(), debit: l.debit, credit: l.credit, confidence: 1, is_new_account: isNew(l.account), suggested_type: null })),
          needs_clarification: [], warnings: [], confidence: 1 },
      }));
      const r = await fetch("/api/finance/chat-book/confirm-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: payload, business_id: bizId, account_heads: heads, source: chunk[0].kind === "statement" ? "statement" : "template" }) });
      const d = await r.json().catch(() => ({}));
      if (d.needs_heads?.length) {
        setHeads(h => ({ ...Object.fromEntries((d.needs_heads as { account: string; suggested: string }[]).map(n => [n.account, guessGroup(n.account)])), ...h }));
        setItems(prev => prev.map(x => chunk.some(c => c.id === x.id) ? { ...x, state: "ready" } : x));
        setBusy(""); setMsg("Check the groups for the new ledgers below, then press Approve again."); return;
      }
      if (!r.ok) { setItems(prev => prev.map(x => chunk.some(c => c.id === x.id) ? { ...x, state: "failed", reason: d.error ?? "Couldn't post" } : x)); continue; }
      const done = new Map(((d.results ?? []) as { ref: string; entry_no: string; journal_id: string }[]).map(x => [x.ref, x]));
      const fails = new Map(((d.failures ?? []) as { ref: string; error: string }[]).map(f => [f.ref, f.error]));
      ok += done.size;
      setItems(prev => prev.map(x => done.has(x.id) ? { ...x, state: "posted", entryNo: done.get(x.id)!.entry_no, journalId: done.get(x.id)!.journal_id, reason: undefined }
        : fails.has(x.id) ? { ...x, state: "failed", reason: fails.get(x.id) } : x));
      if (d.created_ledgers?.length) setAccounts(prev => [...prev, ...(d.created_ledgers as { name: string }[]).map(c => ({ name: c.name, sub_type: null }))]);
    }
    setBusy(""); setMsg(`✓ ${ok} entr${ok === 1 ? "y" : "ies"} posted to your books.${tally.status === "connected" ? " Send them to Tally with one click." : ""}`);
  }

  async function sendToTally() {
    const list = items.filter(i => i.state === "posted" && i.journalId && i.tally !== "pushed");
    if (!list.length || tally.status !== "connected") return;
    setBusy("Sending to Tally…");
    const r = await pushToTally({ bizId, ids: list.map(i => i.journalId!), dates: Object.fromEntries(list.map(i => [i.journalId!, i.date])), company: tally.company, port: tally.port, educational: tally.educational, onProgress: setBusy });
    setItems(prev => prev.map(x => x.journalId && r.results[x.journalId] ? { ...x, tally: "at" in r.results[x.journalId] ? "pushed" : "failed", tallyError: "error" in r.results[x.journalId] ? (r.results[x.journalId] as { error: string }).error : undefined } : x));
    setBusy(""); setMsg(r.message);
  }

  // ── Editing a "Needs a look" entry: the non cash/bank ledger ──
  function setLedger(id: string, idx: number, account: string) {
    setItems(prev => prev.map(x => x.id !== id ? x : { ...x, lines: x.lines.map((l, k) => k === idx ? { ...l, account } : l) }));
  }
  function markReady(id: string) { setItems(prev => prev.map(x => x.id === id && x.lines.length >= 2 && x.lines.every(l => l.account.trim()) && x.date ? { ...x, state: "ready", reason: undefined } : x)); }
  function remove(id: string) { setItems(prev => prev.filter(x => x.id !== id)); }

  const count = (s: ItemState) => items.filter(i => i.state === s).length;
  const ready = items.filter(i => i.state === "ready");
  const toTally = items.filter(i => i.state === "posted" && i.tally !== "pushed").length;
  const reading = files.filter(f => f.status === "queued" || f.status === "reading").length;
  const shown = items.filter(i => filter === "all" ? true : filter === "posted" ? i.state === "posted" : filter === "check" ? i.state === "check" || i.state === "failed" : i.state === "ready");
  const fileName = new Map(files.map(f => [f.id, f.name]));

  const pill = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" });
  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({ height: 46, padding: "0 20px", borderRadius: 999, border: primary ? "none" : "1px solid #D9CDB2", background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14.5, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <input ref={fileInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={folderInput} type="file" multiple style={{ display: "none" }} {...({ webkitdirectory: "" } as Record<string, string>)} onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 20 }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }} className="ib-head">
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>SMART INBOX</div>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.5rem)", fontWeight: 700, lineHeight: 1.1 }}>Drop it all in. <span style={{ fontStyle: "italic", fontWeight: 400, color: "#8A6420" }}>We&apos;ll do the typing.</span></h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
            Bank ledger
            <input list="inbox-banks" value={bankLedger} onChange={e => setBankLedger(e.target.value)} placeholder="e.g. HDFC Bank" style={{ height: 38, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: "inherit", fontSize: 14, width: 180 }} />
            <datalist id="inbox-banks">{accounts.filter(a => a.sub_type === "bank" || /bank/i.test(a.name)).map(a => <option key={a.name} value={a.name} />)}</datalist>
            <span style={{ marginLeft: 8 }}>Card ledger</span>
            <input list="inbox-cards" value={cardLedger} onChange={e => setCardLedger(e.target.value)} placeholder="e.g. HDFC Credit Card" style={{ height: 38, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: "inherit", fontSize: 14, width: 180 }} />
            <datalist id="inbox-cards">{accounts.filter(a => /card/i.test(a.name)).map(a => <option key={a.name} value={a.name} />)}</datalist>
          </div>
        </header>

        {/* Steps */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }} className="ib-steps">
          {[["Drop files", "Bank & card statements, bills, invoices, Excel — even a whole folder", files.length > 0],
            ["Review", "Ready entries are matched for you. Fix only the few marked “Needs a look”", count("posted") > 0],
            ["Send to Tally", tally.status === "connected" ? `Connected to ${tally.company || "Tally"}` : "Connect Tally once — then it's one click", items.some(i => i.tally === "pushed")]].map(([t, d, done], i) => (
            <li key={String(t)} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", background: done ? C.pos : C.forest, color: done ? "#FFFFFF" : C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{done ? "✓" : i + 1}</span>
              <span><b style={{ display: "block", fontSize: 15 }}>{t as string}</b><span style={{ fontSize: 12.5, color: C.muted }}>{d as string}</span></span>
            </li>
          ))}
        </ol>

        {/* Drop zone */}
        <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${drag ? C.gold : "#CDBF9F"}`, background: drag ? "#FFF8E8" : C.card, borderRadius: 22, padding: "clamp(22px,4vw,40px)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transition: "background .15s, border-color .15s" }}>
          <span aria-hidden="true" style={{ width: 58, height: 58, borderRadius: "50%", background: C.forest, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
          </span>
          <div style={{ fontFamily: SERIF, fontSize: "1.35rem", fontWeight: 700 }}>Drag files here</div>
          <div style={{ fontSize: 13.5, color: C.muted, maxWidth: 520 }}>Bank and credit-card statements, scanned or photographed bills (even handwritten), invoices, Excel and CSV. Hundreds at once is fine. Payments are matched to your unpaid bills and invoices automatically.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => fileInput.current?.click()} style={btn(true)}>Choose files</button>
            <button onClick={() => folderInput.current?.click()} style={btn(false)}>Choose a folder</button>
          </div>
        </div>

        {/* Files being read */}
        {files.length > 0 && (
          <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>{files.length} file{files.length === 1 ? "" : "s"}{reading ? ` · reading ${reading}…` : " · all read"}</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
              {files.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                  <span style={pill("#EFE8D9", C.ink)}>{f.kind}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ color: f.status === "error" ? C.neg : C.muted, fontSize: 12.5 }}>{f.status === "queued" ? "Waiting…" : f.note}</span>
                  {f.status === "done" && <span style={pill(C.posSoft, C.pos)}>Read</span>}
                  {f.status === "error" && <span style={pill(C.negSoft, C.neg)}>Couldn&apos;t read</span>}
                  {(f.status === "reading" || f.status === "queued") && <span className="ib-spin" aria-label="Reading" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action bar */}
        {items.length > 0 && (
          <section style={{ position: "sticky", top: 8, zIndex: 5, background: C.forest, color: "#FFFFFF", borderRadius: 18, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 18px 40px -26px rgba(15,43,37,0.8)" }}>
            {([["all", `All ${items.length}`], ["ready", `Ready ${count("ready")}`], ["check", `Needs a look ${count("check") + count("failed")}`], ["posted", `Posted ${count("posted")}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ height: 34, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(217,181,111,0.4)", background: filter === k ? C.gold : "transparent", color: filter === k ? C.forest : "#FFFFFF", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
            <span style={{ flex: 1 }} />
            <span role="status" style={{ fontSize: 12.5, color: "#C9D3CE" }}>{busy}</span>
            <button onClick={() => post(ready)} disabled={!!busy || !ready.length} style={{ ...btn(false, !!busy || !ready.length), background: C.gold, border: "none", color: C.forest }}>✓ Approve {ready.length} ready</button>
            <button onClick={sendToTally} disabled={!!busy || !toTally || tally.status !== "connected"} title={tally.status !== "connected" ? "Connect Tally on the Tally page first" : ""} style={{ ...btn(false, !!busy || !toTally || tally.status !== "connected") }}>⇪ Send {toTally} to Tally</button>
          </section>
        )}
        {msg && <div role="status" style={{ background: msg.startsWith("✓") ? C.posSoft : C.amberSoft, color: msg.startsWith("✓") ? C.pos : C.amber, borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 13.5 }}>{msg}{tally.status !== "connected" && msg.startsWith("✓") && <> <Link href="/finance/tally" style={{ color: C.pos }}>Connect Tally →</Link></>}</div>}

        {/* New ledgers */}
        {newLedgers.size > 0 && (
          <section style={{ background: C.amberSoft, borderRadius: 18, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <b style={{ fontSize: 14 }}>{newLedgers.size} new ledger{newLedgers.size === 1 ? "" : "s"} will be created — the likely group is ticked ✓. Change any that are wrong.</b>
            {[...newLedgers.keys()].map(n => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFFFF", borderRadius: 12, padding: "8px 12px" }}>
                <b style={{ minWidth: 160, fontSize: 13.5 }}>{n}</b>
                <GroupChips compact value={heads[n] ?? ""} onChange={k => setHeads(h => ({ ...h, [n]: k }))} />
              </div>
            ))}
          </section>
        )}

        {/* Entries */}
        {shown.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.slice(0, 300).map(it => {
              const st = it.state;
              const chip = st === "posted" ? (it.tally === "pushed" ? pill(C.posSoft, C.pos) : pill("#E8F0FF", "#1F5EFF")) : st === "ready" ? pill(C.posSoft, C.pos) : st === "posting" ? pill("#EFE8D9", C.ink) : pill(C.amberSoft, C.amber);
              const label = st === "posted" ? (it.tally === "pushed" ? "In Tally" : it.tally === "failed" ? "Tally failed" : `Posted ${it.entryNo ?? ""}`) : st === "ready" ? "Ready" : st === "posting" ? "Posting…" : st === "failed" ? "Failed" : "Needs a look";
              const editable = st === "check" || st === "failed";
              return (
                <article key={it.id} style={{ background: C.card, border: `1px solid ${editable ? "#EBCB8B" : C.line}`, borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={chip}>{label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',ui-monospace,monospace", fontSize: 12.5, color: C.muted }}>{it.date || "no date"}</span>
                    <b style={{ flex: 1, minWidth: 180, fontSize: 14 }}>{it.narration}</b>
                    {it.matched && it.state !== "check" && <span style={pill("#E8F0FF", "#1F5EFF")} title="Matched to an unpaid entry">🔗 {it.matched}</span>}
                    <b style={{ fontFamily: "'IBM Plex Mono',ui-monospace,monospace" }}>{it.amount ? inr(it.amount) : ""}</b>
                    <span style={{ fontSize: 11.5, color: C.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fileName.get(it.fileId)}>{fileName.get(it.fileId)}</span>
                  </div>
                  {it.lines.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13 }}>
                      {it.lines.map((l, k) => (
                        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: l.debit ? C.neg : C.pos, fontWeight: 700, fontSize: 12 }}>{l.debit ? "Dr" : "Cr"}</span>
                          {editable && !isCashBank(l.account)
                            ? <input list="inbox-ledgers" value={l.account} onChange={e => setLedger(it.id, k, e.target.value)} placeholder="Ledger name" aria-label="Ledger" style={{ height: 32, borderRadius: 8, border: `1px solid ${l.account ? C.line : "#EBCB8B"}`, padding: "0 10px", fontFamily: "inherit", fontSize: 13, width: 200 }} />
                            : <span>{l.account || "—"}</span>}
                          <span style={{ color: C.muted }}>{inr(l.debit || l.credit)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {(it.reason || it.tallyError) && <div style={{ fontSize: 12.5, color: st === "failed" || it.tally === "failed" ? C.neg : C.amber, fontWeight: 600 }}>{it.tallyError ?? it.reason}</div>}
                  {editable && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {it.lines.length >= 2 && <button onClick={() => markReady(it.id)} style={{ ...btn(true), height: 34, fontSize: 13 }}>Looks right</button>}
                      {it.lines.length < 2 && <Link href="/finance/chat-book" style={{ ...btn(false), height: 34, fontSize: 13, textDecoration: "none" }}>Open FreBook</Link>}
                      <button onClick={() => remove(it.id)} style={{ ...btn(false), height: 34, fontSize: 13 }}>Skip</button>
                    </div>
                  )}
                </article>
              );
            })}
            {shown.length > 300 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>Showing the first 300 — approve these and the rest move up.</div>}
            <datalist id="inbox-ledgers">{accounts.map(a => <option key={a.name} value={a.name} />)}</datalist>
          </section>
        )}

        {!files.length && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>Nothing is posted until you press <b>Approve</b>. Entries already posted from the same file are never posted twice.</p>
        )}
      </div>
      <style>{`
        .ib-spin { width: 14px; height: 14px; border: 2px solid #C99A4E; border-right-color: transparent; border-radius: 50%; animation: ibspin .7s linear infinite; display: inline-block; }
        @keyframes ibspin { to { transform: rotate(360deg); } }
        @media (max-width: 760px) { .ib-steps { grid-template-columns: minmax(0,1fr) !important; } }
        @media (prefers-reduced-motion: reduce) { .ib-spin { animation: none; } }
      `}</style>
    </div>
  );
}
