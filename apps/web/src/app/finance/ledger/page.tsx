"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Suspense } from "react";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { writeStyledWorkbook } from "@/lib/styledWorkbook";
import type { Cell } from "@/lib/statementExport";

type Account = { id: string; code: string; name: string; type: string };
type LedgerEntry = {
  id: string;
  journal_id: string;
  date: string;
  entry_no: string;
  narration: string;
  dr: number;
  cr: number;
  balance: number;
  balance_type: "Dr" | "Cr";
  journal_type: string;
};

function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bizId, setBizId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccId, setSelectedAccId] = useState(searchParams.get("account") ?? "");
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openingBal, setOpeningBal] = useState(0);
  const [openingType, setOpeningType] = useState<"Dr" | "Cr">("Dr");
  const [bizName, setBizName] = useState("");
  const [xlBusy, setXlBusy] = useState(false);
  // Period from the report that linked here (?from=&to=); none = the whole ledger
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const BACK: Record<string, string> = { trial_balance: "Trial Balance", profit_loss: "Profit & Loss", balance_sheet: "Balance Sheet" };
  const back = searchParams.get("back") ?? "";
  const backLabel = BACK[back];
  const goBack = () => { if (window.history.length > 1) router.back(); else router.push(`/finance/reports?tab=${back}`); };
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      supabase.from("fw_fin_businesses").select("name").eq("id", saved).maybeSingle().then(({ data }) => setBizName(data?.name ?? ""));
      const { data } = await supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code");
      setAccounts(data ?? []);
    });
  }, []);

  // Load once the accounts are known; a date being typed waits until it's a full date
  const reqNo = useRef(0);
  useEffect(() => {
    if (!selectedAccId || !bizId || !accounts.length) return;
    if ((from && !isDate(from)) || (to && !isDate(to))) return;
    const acc = accounts.find(a => a.id === selectedAccId);
    setSelectedAcc(acc ?? null);
    const timer = setTimeout(() => fetchLedger(selectedAccId, bizId, acc?.type ?? ""), 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccId, bizId, accounts.length, from, to]);

  async function fetchLedger(accId: string, bid: string, accType: string) {
    const req = ++reqNo.current;   // a newer request (another account or date) wins over a slower older one
    setLoading(true);
    const f = isDate(from) ? from : "", t = isDate(to) ? to : "";
    // Rows in the period, page by page (the database returns at most 1,000 rows per request)
    const page = async <T,>(make: (a: number, b: number) => PromiseLike<{ data: unknown }>) => {
      const out: T[] = [];
      for (let a = 0; ; a += 1000) {
        const { data } = await make(a, a + 999);
        const got = (data ?? []) as T[];
        out.push(...got);
        if (got.length < 1000) return out;
      }
    };
    const periodQ = (a: number, b: number) => {
      let q = supabase.from("fw_fin_journal_lines")
        .select("id, dr_amount, cr_amount, narration, fw_fin_journals!inner(id, entry_no, date, narration, type, status, business_id)")
        .eq("account_id", accId).eq("fw_fin_journals.business_id", bid).eq("fw_fin_journals.status", "posted")
        .lte("fw_fin_journals.date", t || "9999-12-31");
      if (f) q = q.gte("fw_fin_journals.date", f);
      return q.order("id").range(a, b);
    };
    // Opening balance: only the amounts before the period (balance-sheet accounts; P&L accounts open at nil)
    const plType = accType === "income" || accType === "expense";
    const openQ = (a: number, b: number) => supabase.from("fw_fin_journal_lines")
      .select("dr_amount, cr_amount, fw_fin_journals!inner(business_id, status, date)")
      .eq("account_id", accId).eq("fw_fin_journals.business_id", bid).eq("fw_fin_journals.status", "posted")
      .lt("fw_fin_journals.date", f).order("id").range(a, b);
    const [data, opening] = await Promise.all([
      page<unknown>(periodQ),
      f && !plType ? page<{ dr_amount: number; cr_amount: number }>(openQ) : Promise.resolve([]),
    ]);
    if (req !== reqNo.current) return;

    type RawLine = {
      id: string;
      dr_amount: number;
      cr_amount: number;
      narration: string | null;
      fw_fin_journals: {
        id: string; entry_no: string; date: string; narration: string;
        type: string; status: string; business_id: string;
      } | null;
    };

    const all = ((data as unknown as RawLine[]) ?? []).sort((a, b) => (a.fw_fin_journals?.date ?? "").localeCompare(b.fw_fin_journals?.date ?? ""));
    // Opening = everything before the period. Income and expense accounts start each year at nil.
    const plAcc = accType === "income" || accType === "expense";
    const openNet = plAcc ? 0 : opening.reduce((s, r) => s + (r.dr_amount ?? 0) - (r.cr_amount ?? 0), 0);
    setOpeningBal(Math.abs(openNet)); setOpeningType(openNet >= 0 ? "Dr" : "Cr");
    const rows = all;
    let runningBal = Math.abs(openNet);
    let balType: "Dr" | "Cr" = openNet >= 0 ? "Dr" : "Cr";

    const ledgerRows: LedgerEntry[] = rows.map(row => {
      const j = row.fw_fin_journals;
      const dr = row.dr_amount ?? 0;
      const cr = row.cr_amount ?? 0;

      // Running balance logic
      if (balType === "Dr") {
        const net = runningBal + dr - cr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Dr" : "Cr";
      } else {
        const net = runningBal + cr - dr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Cr" : "Dr";
      }

      return {
        id: row.id,
        journal_id: j?.id ?? "",
        date: j?.date ?? "",
        entry_no: j?.entry_no ?? "",
        narration: row.narration ?? j?.narration ?? "",
        dr, cr,
        balance: runningBal,
        balance_type: balType,
        journal_type: j?.type ?? "",
      };
    });

    setEntries(ledgerRows);
    setLoading(false);
  }

  const totalDr = entries.reduce((s, e) => s + e.dr, 0);
  const totalCr = entries.reduce((s, e) => s + e.cr, 0);
  const closingNet = (openingType === "Dr" ? openingBal : -openingBal) + totalDr - totalCr;
  const closingBalance = Math.abs(closingNet);
  const closingType: "Dr" | "Cr" = closingNet >= 0 ? "Dr" : "Cr";
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  const filteredAccounts = search
    ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    : accounts;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`.lg-row:hover{background:rgba(35,42,99,0.06)}`}</style>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        {backLabel
          ? <button onClick={goBack} style={{ background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.2)", color: "#232A63", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", padding: "5px 12px", borderRadius: 8 }}>← Back to {backLabel}</button>
          : <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>}
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Ledger{selectedAcc ? ` · ${selectedAcc.name}` : ""}</span>
        <div style={{ flex: 1 }} />
        {selectedAcc && entries.length > 0 && (
          <button disabled={xlBusy} onClick={async () => {
            setXlBusy(true);
            try {
              const dmy = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
              const period = from || to ? `${from ? dmy(from) : "Start"} to ${to ? dmy(to) : "date"}` : "All dates";
              const rows: Cell[][] = [
                [`Ledger — ${selectedAcc.name}`], [bizName || "Business"], [`${period} · Account code ${selectedAcc.code || "—"}`], [],
                ["Date", "Entry No", "Narration", "Debit", "Credit", "Balance", "Dr/Cr"],
                [null, null, "Opening Balance", openingType === "Dr" && openingBal ? openingBal : null, openingType === "Cr" && openingBal ? openingBal : null, openingBal, openingType],
                ...entries.map(e => [dmy(e.date), e.entry_no, e.narration, e.dr || null, e.cr || null, e.balance, e.balance_type] as Cell[]),
                [null, null, "Closing Balance", totalDr, totalCr, closingBalance, closingType],
              ];
              const name = `Ledger-${selectedAcc.name}-${bizName}-${period}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) + ".xlsx";
              await writeStyledWorkbook([{ name: "Ledger", rows, widths: [14, 16, 48, 16, 16, 18, 7], moneyFrom: 3 }], name, `Prepared with FreBook · ${dmy(new Date().toISOString().slice(0, 10))}`);
            } finally { setXlBusy(false); }
          }} style={{ background: "#0B7A55", border: "none", color: "#FFFFFF", padding: "5px 14px", borderRadius: 6, cursor: xlBusy ? "wait" : "pointer", fontSize: "0.8rem", fontWeight: 700 }}>
            {xlBusy ? "Preparing…" : "⬇ Excel"}
          </button>
        )}
        <button onClick={() => window.print()} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
          🖨 Print
        </button>
      </nav>

      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
        {/* Sidebar — Account List */}
        <div style={{ width: 260, borderRight: "1px solid rgba(20,26,58,0.11)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
              style={{ width: "100%", background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "6px 10px", borderRadius: 6, fontSize: "0.8rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {["asset", "liability", "equity", "income", "expense"].map(type => {
              const typeAccounts = filteredAccounts.filter(a => a.type === type);
              if (!typeAccounts.length) return null;
              const typeLabels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Capital", income: "Income", expense: "Expenses" };
              return (
                <div key={type}>
                  <div style={{ padding: "0.4rem 1rem", fontSize: "0.68rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, background: "#FFFFFF" }}>
                    {typeLabels[type]}
                  </div>
                  {typeAccounts.map(acc => (
                    <div key={acc.id} onClick={() => setSelectedAccId(acc.id)} style={{
                      padding: "0.55rem 1rem", cursor: "pointer", fontSize: "0.82rem",
                      background: selectedAccId === acc.id ? "rgba(35,42,99,0.12)" : "transparent",
                      color: selectedAccId === acc.id ? "#232A63" : "rgba(20,26,58,0.95)",
                      borderLeft: selectedAccId === acc.id ? "2px solid #232A63" : "2px solid transparent",
                    }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(20,26,58,0.55)", marginRight: "0.5rem" }}>{acc.code}</span>
                      {acc.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main — Ledger */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {!selectedAcc ? (
            <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📒</div>
              <div style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.9rem" }}>Select an account from the left to view its ledger</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.2rem", fontWeight: 800 }}>{selectedAcc.name}</h2>
                <div style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>Account Code: {selectedAcc.code} · Type: {selectedAcc.type}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: "0.8rem", color: "rgba(20,26,58,0.7)" }}>
                  Period
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ border: "1px solid rgba(20,26,58,0.17)", borderRadius: 6, padding: "4px 8px", fontSize: "0.8rem", color: "#141A3A", background: "#FFFFFF" }} />
                  to
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ border: "1px solid rgba(20,26,58,0.17)", borderRadius: 6, padding: "4px 8px", fontSize: "0.8rem", color: "#141A3A", background: "#FFFFFF" }} />
                  {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} style={{ border: "none", background: "none", color: "#232A63", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}>All dates</button>}
                  <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "rgba(20,26,58,0.55)" }}>Click an entry to view it</span>
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: `Opening Balance (${openingType})`, value: openingBal, color: "rgba(20,26,58,0.75)" },
                  { label: "Total Debit", value: totalDr, color: "#C2321F" },
                  { label: "Total Credit", value: totalCr, color: "#0B7A55" },
                  { label: `Closing Balance (${closingType})`, value: closingBalance, color: "#232A63" },
                ].map(k => (
                  <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 10, padding: "0.85rem 1rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(k.value)}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>Loading ledger…</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>No posted transactions for this account{from || to ? " in this period" : ""}.</div>
              ) : (
                <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FFFFFF" }}>
                        {["Date", "Entry No", "Narration", "Debit (" + cur() + ")", "Credit (" + cur() + ")", "Balance"].map(h => (
                          <th key={h} style={{ padding: "0.55rem 0.85rem", textAlign: ["Debit (" + cur() + ")", "Credit (" + cur() + ")", "Balance"].includes(h) ? "right" : "left", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: "rgba(35,42,99,0.04)", borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
                        <td colSpan={3} style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem", fontWeight: 600, color: "rgba(20,26,58,0.75)" }}>Opening Balance</td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", color: "rgba(20,26,58,0.75)", fontVariantNumeric: "tabular-nums" }}>
                          {openingType === "Dr" && openingBal > 0 ? fmt(openingBal) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", color: "rgba(20,26,58,0.75)", fontVariantNumeric: "tabular-nums" }}>
                          {openingType === "Cr" && openingBal > 0 ? fmt(openingBal) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: "#232A63" }}>
                          {fmt(openingBal)} {openingType}
                        </td>
                      </tr>
                      {entries.map((e, i) => (
                        <tr key={i} className="lg-row" onClick={() => e.journal_id && router.push(`/finance/journals?id=${e.journal_id}&from=ledger`)} title="View this entry" style={{ borderTop: "1px solid rgba(20,26,58,0.08)", cursor: e.journal_id ? "pointer" : undefined }}>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.78rem", color: "rgba(20,26,58,0.75)", whiteSpace: "nowrap" }}>
                            {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(20,26,58,0.7)" }}>{e.entry_no}</td>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.82rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.narration}</td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: e.dr > 0 ? "#C2321F" : "rgba(20,26,58,0.28)" }}>
                            {e.dr > 0 ? fmt(e.dr) : "—"}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: e.cr > 0 ? "#0B7A55" : "rgba(20,26,58,0.28)" }}>
                            {e.cr > 0 ? fmt(e.cr) : "—"}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#141A3A" }}>
                            {fmt(e.balance)} <span style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.60)" }}>{e.balance_type}</span>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid rgba(35,42,99,0.3)", background: "rgba(35,42,99,0.06)" }}>
                        <td colSpan={3} style={{ padding: "0.6rem 0.85rem", fontWeight: 800, fontSize: "0.85rem" }}>Closing Balance <span style={{ fontWeight: 500, fontSize: "0.75rem", color: "rgba(20,26,58,0.6)" }}>(debits and credits in the period)</span></td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#C2321F" }}>{fmt(totalDr)}</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#0B7A55" }}>{fmt(totalCr)}</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 800, color: "#232A63", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(closingBalance)} {closingType}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F5F6FA" }} />}><LedgerContent /></Suspense>;
}
