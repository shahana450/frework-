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

  const from = `${month}-01`;
  const to = useMemo(() => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); }, [month]);

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
    XLSX.writeFile(wb, `BRS-${bank.replace(/[^\w]+/g, "-")}-${month}.xlsx`);
  }

  const post = (b: BankLine) => router.push(`/finance/chat-book?q=${encodeURIComponent(`${b.credit ? "Received" : "Paid"} ${b.credit || b.debit} ${b.credit ? "in" : "from"} ${banks.find(x => x.id === bankId)?.name ?? "bank"} on ${b.date} — ${b.description}`)}`);

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <PageHero eyebrow="Banking · Reconciliation" title="Bank statement" accent="against your books"
        sub="Upload the statement, pick the bank ledger, and see what matches, what's missing in FreBook and what hasn't cleared the bank yet."
        tiles={res ? [
          { label: "Matched", value: String(res.matched.length), tone: "good" },
          { label: "In bank, not in FreBook", value: String(res.bankOnly.length), tone: res.bankOnly.length ? "warn" : "good" },
          { label: "In FreBook, not in bank", value: String(res.bookOnly.length), tone: res.bookOnly.length ? "warn" : "good" },
          { label: "Difference", value: res.difference == null ? "—" : inr(res.difference), sub: res.difference == null ? "Statement has no balances" : res.difference === 0 ? "Reconciled" : "Check unmatched items", tone: res.difference === 0 ? "good" : res.difference == null ? "plain" : "bad" },
        ] : undefined} />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...card, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 13, color: HT.muted }}>Bank ledger
            <select value={bankId} onChange={e => { setBankId(e.target.value); setRes(null); }} style={{ height: 40, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontSize: 14, fontFamily: "inherit", minWidth: 220, background: "#FFFFFF", color: HT.ink }}>
              {!banks.length && <option value="">No bank ledgers yet</option>}
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13, color: HT.muted }}>Month
            <input type="month" value={month} onChange={e => { setMonth(e.target.value); setRes(null); }} style={{ height: 40, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontSize: 14, fontFamily: "inherit", background: "#FFFFFF", color: HT.ink }} />
          </label>
          <label style={{ ...btn, display: "inline-flex", alignItems: "center", height: 40, boxSizing: "border-box" }}>
            {fileName ? `📄 ${fileName}` : "Upload statement (PDF, Excel, CSV)"}
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </label>
          <button onClick={run} disabled={!stmt || !bankId || !!busy} style={{ ...btn, height: 40, background: HT.ink, color: HT.paper, borderColor: HT.ink, opacity: !stmt || !bankId ? 0.5 : 1 }}>Reconcile</button>
          {res && <button onClick={exportXl} style={{ ...btn, height: 40 }}>Download BRS (Excel)</button>}
          {stmt && !busy && <span style={{ fontSize: 13, color: HT.muted }}>{stmt.length} statement lines read</span>}
        </div>
        {busy && <div style={{ color: HT.muted }}>{busy}</div>}
        {err && <div role="alert" style={{ color: "#8A2A1A" }}>{err}</div>}

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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([["bank", `In bank, not in FreBook · ${res.bankOnly.length}`], ["book", `In FreBook, not in bank · ${res.bookOnly.length}`], ["matched", `Matched · ${res.matched.length}`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ ...btn, background: tab === k ? HT.ink : HT.paper, color: tab === k ? HT.paper : HT.ink }}>{l}</button>
              ))}
            </div>
            <div style={{ ...card, overflowX: "auto" }}>
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
