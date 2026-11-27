"use client";
// Bank reconciliation — upload the bank statement for a month, match it with the bank ledger in FreBook,
// and get the Bank Reconciliation Statement. Nothing is posted from here; missing entries open in FreBook.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { readBankStatement } from "@/lib/readStatement";
import { reconcileBank, type BankLine, type BookLine, type BankRecon } from "@/lib/bankRecon";
import PeriodPicker, { periodFrom, periodTo, periodLabel } from "@/components/finance/PeriodPicker";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type Acc = { id: string; name: string };
const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 16, overflow: "hidden" };
const th: React.CSSProperties = { textAlign: "left", padding: "9px 12px", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: HT.muted, fontWeight: 500, borderBottom: `1px solid ${HT.line}` };
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: `1px solid ${HT.line}`, fontSize: 13.5, verticalAlign: "top" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const btn: React.CSSProperties = { border: `1px solid ${HT.line}`, background: HT.paper, borderRadius: 999, padding: "8px 16px", fontSize: 14, cursor: "pointer", color: HT.ink, fontFamily: "inherit" };
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

export default function BankReconPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [banks, setBanks] = useState<Acc[]>([]);
  const [bankId, setBankId] = useState("");
  const [month, setMonth] = useState(lastMonth());
  const [stmt, setStmt] = useState<BankLine[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [res, setRes] = useState<BankRecon | null>(null);
  const [tab, setTab] = useState<"bank" | "book" | "matched">("bank");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").trim();
      if (!id) { router.push("/finance/setup"); return; }
      setBizId(id);
      const { data } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,sub_type").eq("business_id", id).eq("is_group", false).eq("type", "asset").order("name");
      const list = (data ?? []).filter((a: { sub_type: string | null; name: string }) => a.sub_type === "bank" || /bank|a\/c|account|od\b|cc\b/i.test(a.name)).map((a: Acc) => ({ id: a.id, name: a.name }));
      setBanks(list); if (list.length) setBankId(list[0].id);
    });
  }, [router]);

  const from = periodFrom(month), to = periodTo(month);

  async function onFile(f: File) {
    setErr(""); setRes(null); setFileName(f.name); setBusy("Reading the statement…");
    try {
      let tx: { date: string; description: string; debit: number; credit: number; balance?: number }[];
      if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
        const out = await readBankStatement(f, { bizId });
        tx = out.transactions;
      } else tx = (await readBankStatement(f, { bizId, onProgress: p => setBusy(p.label) })).transactions;
      setStmt(tx.map((t, i) => ({ id: `s${i}`, ...t })));
      if (!tx.length) setErr("No transactions found in this file.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read this file."); }
    setBusy("");
  }

  async function run() {
    if (!stmt || !bankId) return;
    setBusy("Matching with FreBook…"); setErr("");
    // Use the statement's own date range when it spans more than the chosen month
    const sf = stmt.reduce((m, t) => t.date < m ? t.date : m, from), st = stmt.reduce((m, t) => t.date > m ? t.date : m, to);
    const page = async <T,>(q: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }>) => { const out: T[] = []; for (let i = 0; ; i += 1000) { const { data } = await q(i, i + 999); const got = (data ?? []) as T[]; out.push(...got); if (got.length < 1000) return out; } };
    type Raw = { id: string; dr_amount: number; cr_amount: number; narration: string | null; fw_fin_journals: { entry_no: string; date: string; narration: string | null; reference_no: string | null; metadata: { bank_ref?: string | null } | null } };
    const [lines, open] = await Promise.all([
      page<Raw>((a, b) => supabase.from("fw_fin_journal_lines").select("id,dr_amount,cr_amount,narration,fw_fin_journals!inner(entry_no,date,narration,reference_no,metadata,business_id,status)")
        .eq("account_id", bankId).eq("fw_fin_journals.business_id", bizId).eq("fw_fin_journals.status", "posted").gte("fw_fin_journals.date", sf).lte("fw_fin_journals.date", st).order("id").range(a, b)),
      page<{ dr_amount: number; cr_amount: number }>((a, b) => supabase.from("fw_fin_journal_lines").select("dr_amount,cr_amount,fw_fin_journals!inner(business_id,status,date)")
        .eq("account_id", bankId).eq("fw_fin_journals.business_id", bizId).eq("fw_fin_journals.status", "posted").lt("fw_fin_journals.date", sf).order("id").range(a, b)),
    ]);
    const book: BookLine[] = lines.map(l => ({ id: l.id, date: l.fw_fin_journals.date, entryNo: l.fw_fin_journals.entry_no, narration: l.narration || l.fw_fin_journals.narration || "", ref: l.fw_fin_journals.metadata?.bank_ref ?? l.fw_fin_journals.reference_no ?? null, dr: +l.dr_amount || 0, cr: +l.cr_amount || 0 }));
    const openingBook = open.reduce((s, l) => s + (+l.dr_amount || 0) - (+l.cr_amount || 0), 0);
    setRes(reconcileBank(stmt, book, { openingBook }));
    setTab("bank"); setBusy("");
  }

  function exportXl() {
    if (!res) return;
    const bank = banks.find(b => b.id === bankId)?.name ?? "Bank";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`Bank Reconciliation Statement — ${bank}`], [`Period ${from} to ${to}`], [], ...res.brs.map(x => [x.label, x.amount]), ["Balance as per bank (worked out)", res.computedBank], ["Balance as per bank statement", res.bankBalance ?? ""], ["Difference", res.difference ?? ""]]), "BRS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Description", "Withdrawal", "Deposit"], ...res.bankOnly.map(b => [b.date, b.description, b.debit || "", b.credit || ""])]), "In bank, not in FreBook");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Entry", "Narration", "Debit", "Credit"], ...res.bookOnly.map(l => [l.date, l.entryNo, l.narration, l.dr || "", l.cr || ""])]), "In FreBook, not in bank");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Bank date", "Description", "Amount", "FreBook entry", "Book date", "Matched by"], ...res.matched.map(p => [p.bank.date, p.bank.description, p.bank.credit || -p.bank.debit, p.book.entryNo, p.book.date, p.how === "ref" ? "Reference" : "Amount and date"])]), "Matched");
    XLSX.writeFile(wb, `BRS-${bank.replace(/[^\w]+/g, "-")}-${month}.xlsx`.replace(/[^A-Za-z0-9.-]+/g, "-"));
  }

  // Bank statements already on the Shelf — one click reads them here instead of uploading again
  type ShelfDoc = { id: string; title: string; file_name: string | null; size_bytes: number | null; created_at: string };
  const [shelf, setShelf] = useState<ShelfDoc[]>([]);
  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/finance/shelf?business_id=${bizId}`).then(r => r.ok ? r.json() : null).then(d => {
      const list = ((d?.items ?? []) as (ShelfDoc & { rack: string; doc_type: string | null })[])
        .filter(i => /\.(pdf|xlsx?|csv)$/i.test(i.file_name ?? "") && (i.rack === "bank" || /statement|passbook|stmt/i.test(`${i.doc_type ?? ""} ${i.title}`)));
      setShelf(list.slice(0, 4));
    }).catch(() => null);
  }, [bizId]);
  async function fromShelf(d: ShelfDoc) {
    setBusy("Opening from the Shelf…"); setErr("");
    try {
      const { url } = await fetch(`/api/finance/shelf?business_id=${bizId}&download=${encodeURIComponent(d.id)}&inline=1`).then(r => r.json());
      const blob = await fetch(url).then(r => r.blob());
      await onFile(new File([blob], d.file_name || d.title, { type: blob.type }));
    } catch { setErr("Couldn't open that file from the Shelf. Upload it instead."); setBusy(""); }
  }
  const kb = (n: number | null) => n == null ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  const day = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const post = (b: BankLine) => router.push(`/finance/chat-book?q=${encodeURIComponent(`${b.credit ? "Received" : "Paid"} ${b.credit || b.debit} ${b.credit ? "in" : "from"} ${banks.find(x => x.id === bankId)?.name ?? "bank"} on ${b.date} — ${b.description}`)}`);

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <PageHero eyebrow="Banking · Reconciliation" title="Bank statement" accent="against your books"
        sub="Upload the statement, pick the bank ledger, and see what matches, what's missing in FreBook and what hasn't cleared the bank yet."
        overlap={64} />
      <style>{`.rc-bar{display:grid;grid-template-columns:minmax(180px,1.1fr) auto minmax(200px,1.3fr) auto;gap:18px;align-items:end}
        @media(max-width:980px){.rc-bar{grid-template-columns:1fr 1fr}}@media(max-width:560px){.rc-bar{grid-template-columns:1fr}}
        .rc-lab{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:${HT.muted};margin-bottom:8px}
        .rc-field{height:52px;border-radius:14px;border:1px solid ${HT.line};background:#FBF7EE;padding:0 16px;font:inherit;font-size:16px;color:${HT.ink};width:100%;box-sizing:border-box}
        .rc-up{display:flex;align-items:center;gap:10px;height:52px;border-radius:14px;border:1.5px dashed #D9C79A;background:#FFFBF0;padding:0 16px;cursor:pointer;color:${HT.goldInk};font-size:16px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:background .15s,border-color .15s}
        .rc-up:hover{background:#FFF5DC;border-color:${HT.gold}}
        .rc-go{height:52px;padding:0 30px;border:none;border-radius:14px;background:linear-gradient(160deg,#DDBE78,${HT.gold});color:${HT.ink};font:inherit;font-size:17px;cursor:pointer;display:inline-flex;align-items:center;gap:10px;box-shadow:0 12px 24px -12px rgba(201,162,74,.95);transition:transform .14s}
        .rc-go:hover:not(:disabled){transform:translateY(-2px)}.rc-go:disabled{opacity:.5;cursor:not-allowed}
        .rc-trays{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}@media(max-width:860px){.rc-trays{grid-template-columns:1fr}}
        .rc-tray{background:${HT.paper};border:1px solid ${HT.line};border-radius:22px;padding:28px 30px;text-align:left;font:inherit;color:inherit;display:flex;flex-direction:column;gap:10px}
        button.rc-tray{cursor:pointer;transition:transform .15s,box-shadow .15s}button.rc-tray:hover{transform:translateY(-2px);box-shadow:0 16px 30px -22px rgba(16,36,31,.5)}
        .rc-tray.on{border-color:${HT.gold};box-shadow:0 0 0 2px rgba(201,162,74,.35)}
        .rc-ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;font-size:20px}
        .rc-shelf{background:${HT.green};border-radius:24px;padding:26px 30px;display:grid;grid-template-columns:minmax(220px,.9fr) 2fr;gap:20px;align-items:center;color:#fff}
        @media(max-width:860px){.rc-shelf{grid-template-columns:1fr}}
        .rc-file{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#fff;font:inherit;text-align:left;cursor:pointer;min-width:0;transition:background .15s,border-color .15s}
        .rc-file:hover{background:rgba(255,255,255,.09);border-color:rgba(226,201,138,.5)}`}</style>
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "0 clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ marginTop: -64, background: HT.paper, borderRadius: 24, padding: "24px 28px", boxShadow: "0 24px 50px -30px rgba(16,36,31,.55)", border: `1px solid ${HT.line}` }}>
          <div className="rc-bar">
            <label style={{ minWidth: 0 }}><div className="rc-lab">Bank ledger</div>
              <select className="rc-field" value={bankId} onChange={e => { setBankId(e.target.value); setRes(null); }}>
                {!banks.length && <option value="">No bank ledgers yet</option>}
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <div><div className="rc-lab">Period</div>
              <PeriodPicker value={month} onChange={k => { setMonth(k); setRes(null); }} />
            </div>
            <div style={{ minWidth: 0 }}><div className="rc-lab">Statement</div>
              <label className="rc-up">
                <span aria-hidden style={{ fontSize: 18 }}>{fileName ? "📄" : "⤒"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{fileName || "Upload PDF, Excel or CSV"}</span>
                <input type="file" accept=".pdf,.xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
              </label>
            </div>
            <button className="rc-go" onClick={run} disabled={!stmt || !bankId || !!busy}>Reconcile <span aria-hidden>⇄</span></button>
          </div>
          {(busy || err || (stmt && !busy) || res) && (
            <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 14.5 }}>
              {busy && <span style={{ color: HT.muted }}>{busy}</span>}
              {err && <span role="alert" style={{ color: "#8A2A1A" }}>{err}</span>}
              {stmt && !busy && <span style={{ color: HT.muted }}>{stmt.length} statement lines read · {periodLabel(month)}</span>}
              {res && <button onClick={exportXl} style={{ ...btn, marginLeft: "auto" }}>Download BRS (Excel)</button>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <h2 style={{ margin: 0, fontWeight: 400, fontSize: "clamp(26px,3vw,36px)" }}>{res ? "What we " : "What you'll "}<i style={{ color: HT.goldInk }}>{res ? "found" : "see"}</i></h2>
          <span style={{ color: HT.muted, fontSize: 15.5 }}>{res ? (res.difference == null ? "The statement has no running balance to compare." : res.difference === 0 ? "✓ Reconciled — bank and books agree." : `Difference ${inr(res.difference)} — check the unmatched items.`) : `Results land in three trays once you reconcile ${periodLabel(month)}.`}</span>
        </div>
        <div className="rc-trays">
          {([
            { k: "matched" as const, ic: "✓", bg: "#E5F3EC", fg: "#2F7A57", t: "Matched", d: "On the statement and in your books, same date window and amount. Nothing to do.", n: res?.matched.length },
            { k: "bank" as const, ic: "!", bg: "#FBEFD9", fg: "#9A6B22", t: "Missing in FreBook", d: "In the bank, not in your books. Assign a ledger and post in one click.", n: res?.bankOnly.length },
            { k: "book" as const, ic: "◷", bg: "#E8EEF8", fg: "#3C5A8C", t: "Not yet cleared", d: "In your books, not yet on the statement: cheques issued, deposits in transit.", n: res?.bookOnly.length },
          ]).map(x => {
            const body = <>
              <span className="rc-ic" style={{ background: x.bg, color: x.fg }}>{x.ic}</span>
              <span style={{ fontSize: 26, marginTop: 8 }}>{x.t}</span>
              <span style={{ color: HT.muted, fontSize: 15.5, lineHeight: 1.6 }}>{x.d}</span>
              <span style={{ borderTop: `1px solid ${HT.line}`, marginTop: 8, paddingTop: 16, fontSize: x.n == null ? 22 : 34, color: x.n == null ? "#C9C2B2" : x.fg, fontVariantNumeric: "tabular-nums" }}>{x.n == null ? "—" : x.n}</span>
            </>;
            return res
              ? <button key={x.k} className={`rc-tray${tab === x.k ? " on" : ""}`} onClick={() => setTab(x.k)}>{body}</button>
              : <div key={x.k} className="rc-tray">{body}</div>;
          })}
        </div>

        {!res && shelf.length > 0 && (
          <div className="rc-shelf">
            <div>
              <div style={{ fontSize: 12.5, letterSpacing: ".3em", textTransform: "uppercase", color: HT.gold }}>On your shelf</div>
              <div style={{ fontSize: "clamp(20px,2vw,26px)", marginTop: 8, lineHeight: 1.3 }}>Skip the upload. <i style={{ color: "#E2C98A" }}>Use a statement you&apos;ve already filed.</i></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
              {shelf.map(d => (
                <button key={d.id} className="rc-file" onClick={() => fromShelf(d)} disabled={!!busy} title={`Read ${d.file_name ?? d.title}`}>
                  <span style={{ background: "#FBE9E6", color: "#B0402C", fontSize: 12, letterSpacing: ".08em", padding: "6px 8px", borderRadius: 7, flexShrink: 0 }}>{/\.pdf$/i.test(d.file_name ?? "") ? "PDF" : /\.csv$/i.test(d.file_name ?? "") ? "CSV" : "XLS"}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.file_name ?? d.title}</span>
                    <span style={{ display: "block", fontSize: 13.5, color: "#AFC0B9", marginTop: 2 }}>{day(d.created_at)}{d.size_bytes ? ` · ${kb(d.size_bytes)}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {res && (
          <>
            <div style={card}>
              <div style={{ padding: "12px 16px", fontSize: 18 }}>Bank Reconciliation Statement</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                {res.brs.map(x => <tr key={x.label}><td style={td}>{x.label}</td><td style={num}>{inr(x.amount)}</td></tr>)}
                <tr><td style={{ ...td, fontWeight: 600 }}>Balance as per bank (worked out)</td><td style={{ ...num, fontWeight: 600 }}>{inr(res.computedBank)}</td></tr>
                <tr><td style={td}>Balance as per bank statement</td><td style={num}>{res.bankBalance == null ? "—" : inr(res.bankBalance)}</td></tr>
                {res.difference != null && <tr><td style={{ ...td, color: res.difference === 0 ? "#0B5E42" : "#8A2A1A" }}>{res.difference === 0 ? "✓ Reconciled" : "Difference — usually an opening balance or an item outside the period"}</td><td style={{ ...num, color: res.difference === 0 ? "#0B5E42" : "#8A2A1A" }}>{inr(res.difference)}</td></tr>}
              </tbody></table>
            </div>

            <div style={{ ...card, borderRadius: 22, overflowX: "auto" }}>
              <div style={{ padding: "16px 18px 6px", fontSize: 20 }}>{tab === "bank" ? "Missing in FreBook" : tab === "book" ? "Not yet cleared" : "Matched"}</div>
              {tab === "bank" && <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Date</th><th style={th}>Description</th><th style={{ ...th, textAlign: "right" }}>Withdrawal</th><th style={{ ...th, textAlign: "right" }}>Deposit</th><th style={th}></th></tr></thead>
                <tbody>{res.bankOnly.length ? res.bankOnly.map(b => <tr key={b.id}><td style={td}>{dt(b.date)}</td><td style={td}>{b.description}</td><td style={num}>{b.debit ? inr(b.debit) : ""}</td><td style={num}>{b.credit ? inr(b.credit) : ""}</td><td style={{ ...td, textAlign: "right" }}><button style={{ ...btn, padding: "4px 12px", fontSize: 12.5 }} onClick={() => post(b)}>Post in FreBook</button></td></tr>)
                  : <tr><td style={td} colSpan={5}>Everything in the statement is in FreBook.</td></tr>}</tbody></table>}
              {tab === "book" && <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Date</th><th style={th}>Entry</th><th style={th}>Narration</th><th style={{ ...th, textAlign: "right" }}>Receipt (Dr)</th><th style={{ ...th, textAlign: "right" }}>Payment (Cr)</th></tr></thead>
                <tbody>{res.bookOnly.length ? res.bookOnly.map(l => <tr key={l.id}><td style={td}>{dt(l.date)}</td><td style={td}>{l.entryNo}</td><td style={td}>{l.narration}</td><td style={num}>{l.dr ? inr(l.dr) : ""}</td><td style={num}>{l.cr ? inr(l.cr) : ""}</td></tr>)
                  : <tr><td style={td} colSpan={5}>Every FreBook entry has cleared the bank.</td></tr>}</tbody></table>}
              {tab === "matched" && <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Bank date</th><th style={th}>Description</th><th style={{ ...th, textAlign: "right" }}>Amount</th><th style={th}>FreBook entry</th><th style={th}>Matched by</th></tr></thead>
                <tbody>{res.matched.map(p => <tr key={p.bank.id}><td style={td}>{dt(p.bank.date)}</td><td style={td}>{p.bank.description}</td><td style={num}>{inr(p.bank.credit || -p.bank.debit)}</td><td style={td}>{p.book.entryNo} · {dt(p.book.date)}</td><td style={td}>{p.how === "ref" ? "Reference" : "Amount and date"}</td></tr>)}</tbody></table>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
