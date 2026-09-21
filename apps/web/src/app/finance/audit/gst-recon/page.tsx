"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
type FY = { id: string; label: string; is_current: boolean; start_date: string; end_date: string };
type GSTLine = {
  journal_id: string; entry_no: string; date: string; narration: string;
  jType: string; reference_no: string | null;
  account_id: string; account_name: string;
  dr: number; cr: number;
  gstCategory: "output" | "input"; gstType: "cgst" | "sgst" | "igst";
  amount: number; // net GST amount (cr for output liability, dr for input credit)
};
type MonthSummary = {
  month: string; label: string;
  outputCGST: number; outputSGST: number; outputIGST: number;
  inputCGST: number; inputSGST: number; inputIGST: number;
  outputTotal: number; inputTotal: number; netPayable: number;
};
type Gstr2aInvoice = {
  gstin: string; trade_name: string; invoice_no: string; invoice_date: string;
  taxable_value: number; cgst: number; sgst: number; igst: number;
  matched?: boolean; matchedEntry?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function isGSTAccount(name: string): { is: boolean; category: "output" | "input"; gstType: "cgst" | "sgst" | "igst" } | null {
  const n = name.toLowerCase();
  const isOutput = n.includes("payable") || n.includes("output") || n.includes("collected") || n.includes("liability");
  const isInput = n.includes("input") || n.includes("receivable") || n.includes("credit") || n.includes("claimable");
  const isCGST = n.includes("cgst") || n.includes("central");
  const isSGST = n.includes("sgst") || n.includes("state") || n.includes("ut gst") || n.includes("utgst");
  const isIGST = n.includes("igst") || n.includes("integrated");

  if (!(isCGST || isSGST || isIGST)) return null;
  if (!(isOutput || isInput)) {
    // Fallback: payable = output, input in name = input
    const cat = n.includes("payable") ? "output" : "input";
    return { is: true, category: cat, gstType: isCGST ? "cgst" : isSGST ? "sgst" : "igst" };
  }
  return {
    is: true,
    category: isOutput ? "output" : "input",
    gstType: isCGST ? "cgst" : isSGST ? "sgst" : "igst",
  };
}

function groupByMonth(lines: GSTLine[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const l of lines) {
    const month = l.date.slice(0, 7); // YYYY-MM
    const d = new Date(l.date + "-01");
    const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
    if (!map.has(month)) {
      map.set(month, { month, label, outputCGST: 0, outputSGST: 0, outputIGST: 0, inputCGST: 0, inputSGST: 0, inputIGST: 0, outputTotal: 0, inputTotal: 0, netPayable: 0 });
    }
    const row = map.get(month)!;
    if (l.gstCategory === "output") {
      if (l.gstType === "cgst") row.outputCGST += l.amount;
      else if (l.gstType === "sgst") row.outputSGST += l.amount;
      else row.outputIGST += l.amount;
    } else {
      if (l.gstType === "cgst") row.inputCGST += l.amount;
      else if (l.gstType === "sgst") row.inputSGST += l.amount;
      else row.inputIGST += l.amount;
    }
  }
  for (const row of map.values()) {
    row.outputTotal = row.outputCGST + row.outputSGST + row.outputIGST;
    row.inputTotal = row.inputCGST + row.inputSGST + row.inputIGST;
    row.netPayable = row.outputTotal - row.inputTotal;
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

// ── Styles ───────────────────────────────────────────────────────────────────
const BG = "#050914";
const CARD = "rgba(255,255,255,0.025)";
const BORDER = "rgba(255,255,255,0.07)";
const GOLD = "#C9A84C";
const GREEN = "#34D399";
const RED = "#F87171";
const BLUE = "#60A5FA";
const TEXT = "#E8EDF5";
const MUTED = "rgba(232,237,245,0.45)";

export default function GSTReconPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [fys, setFys] = useState<FY[]>([]);
  const [selectedFy, setSelectedFy] = useState<FY | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "itc" | "output" | "upload">("summary");
  const [gstLines, setGstLines] = useState<GSTLine[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthSummary[]>([]);
  const [gstr2a, setGstr2a] = useState<Gstr2aInvoice[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const bizIdRef = useRef<string | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) { if (!user) router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      bizIdRef.current = saved;
      setBizId(saved);
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
      if (!cancelled && biz) setBizName(biz.name);
      const { data: fysData } = await supabase.from("fw_fin_financial_years")
        .select("id,label,is_current,start_date,end_date").eq("business_id", saved).order("start_date", { ascending: false });
      if (!cancelled && fysData?.length) {
        setFys(fysData);
        const cur = fysData.find(f => f.is_current) ?? fysData[0];
        setSelectedFy(cur);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Load GST lines when FY changes ───────────────────────────────────────
  const loadGSTLines = useCallback(async (fy: FY) => {
    const bid = bizIdRef.current;
    if (!bid) return;
    setLoading(true);
    setGstLines([]);
    setMonthSummary([]);

    // 1. Load all accounts that look like GST accounts
    const { data: allAccounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("id,name,type")
      .eq("business_id", bid)
      .eq("is_group", false);

    const gstAccounts = (allAccounts ?? []).filter(a => isGSTAccount(a.name) !== null);
    const gstAccountIds = gstAccounts.map(a => a.id);
    const accMap = new Map((allAccounts ?? []).map(a => [a.id, a]));

    if (!gstAccountIds.length) { setLoading(false); return; }

    // 2. Load journal lines for GST accounts within FY date range
    const { data: jLines } = await supabase
      .from("fw_fin_journal_lines")
      .select("id,journal_id,account_id,dr_amount,cr_amount,narration")
      .in("account_id", gstAccountIds);

    if (!jLines?.length) { setLoading(false); return; }

    // 3. Load parent journals to get date/narration/type
    const journalIds = [...new Set(jLines.map(l => l.journal_id))];
    const { data: journals } = await supabase
      .from("fw_fin_journals")
      .select("id,entry_no,date,narration,type,reference_no,status")
      .in("id", journalIds)
      .eq("business_id", bid)
      .gte("date", fy.start_date)
      .lte("date", fy.end_date)
      .eq("status", "posted")
      .order("date");

    if (!journals?.length) { setLoading(false); return; }
    const journalMap = new Map(journals.map(j => [j.id, j]));

    const lines: GSTLine[] = [];
    for (const l of jLines) {
      const j = journalMap.get(l.journal_id);
      if (!j) continue;
      const acc = accMap.get(l.account_id);
      if (!acc) continue;
      const gstInfo = isGSTAccount(acc.name);
      if (!gstInfo) continue;

      // For output (liability): credit increases liability = GST collected
      // For input (asset): debit increases ITC = GST paid
      let amount = 0;
      if (gstInfo.category === "output") amount = l.cr_amount - l.dr_amount; // net credit = liability
      else amount = l.dr_amount - l.cr_amount; // net debit = ITC

      if (Math.abs(amount) < 0.01) continue;

      lines.push({
        journal_id: l.journal_id, entry_no: j.entry_no, date: j.date,
        narration: j.narration, jType: j.type, reference_no: j.reference_no,
        account_id: l.account_id, account_name: acc.name,
        dr: l.dr_amount, cr: l.cr_amount,
        gstCategory: gstInfo.category, gstType: gstInfo.gstType,
        amount: Math.abs(amount),
      });
    }
    lines.sort((a, b) => a.date.localeCompare(b.date));
    setGstLines(lines);
    setMonthSummary(groupByMonth(lines));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedFy && bizId) loadGSTLines(selectedFy);
  }, [selectedFy, bizId, loadGSTLines]);

  // ── GSTR-2A/2B JSON upload ────────────────────────────────────────────────
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("Parsing…");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Handle both GSTR-2A and GSTR-2B formats
        const invoices: Gstr2aInvoice[] = [];
        const b2b = json?.data?.docdata?.b2b ?? json?.b2b ?? [];
        for (const supplier of b2b) {
          const gstin = supplier.ctin ?? supplier.gstin ?? "";
          const tradeName = supplier.trdnm ?? supplier.trade_name ?? "";
          for (const inv of (supplier.inv ?? supplier.invoices ?? [])) {
            const taxable = inv.val ?? inv.txval ?? 0;
            let cgst = 0, sgst = 0, igst = 0;
            for (const item of (inv.itms ?? inv.items ?? [])) {
              cgst += item.itm_det?.camt ?? item.cgst ?? 0;
              sgst += item.itm_det?.samt ?? item.sgst ?? 0;
              igst += item.itm_det?.iamt ?? item.igst ?? 0;
            }
            invoices.push({
              gstin, trade_name: tradeName,
              invoice_no: inv.inum ?? inv.invoice_no ?? "",
              invoice_date: inv.idt ?? inv.invoice_date ?? "",
              taxable_value: taxable, cgst, sgst, igst,
            });
          }
        }
        // Match against books by invoice number / reference
        const matched = invoices.map(inv => {
          const ref = inv.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, "");
          const found = gstLines.find(l =>
            l.reference_no && l.reference_no.toLowerCase().replace(/[^a-z0-9]/g, "") === ref
          );
          return { ...inv, matched: !!found, matchedEntry: found?.entry_no };
        });
        setGstr2a(matched);
        setUploadMsg(`Loaded ${matched.length} invoices — ${matched.filter(i => i.matched).length} matched with books, ${matched.filter(i => !i.matched).length} unmatched.`);
        setTab("upload");
      } catch {
        setUploadMsg("Invalid JSON — download GSTR-2A or GSTR-2B JSON from GST portal and upload.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [gstLines]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const filteredLines = filterMonth === "all" ? gstLines : gstLines.filter(l => l.date.startsWith(filterMonth));
  const outputLines = filteredLines.filter(l => l.gstCategory === "output");
  const inputLines = filteredLines.filter(l => l.gstCategory === "input");
  const totalOutput = outputLines.reduce((s, l) => s + l.amount, 0);
  const totalInput = inputLines.reduce((s, l) => s + l.amount, 0);
  const netPayable = totalOutput - totalInput;
  const unmatchedGstr2a = gstr2a.filter(i => !i.matched);
  const unmatchedInBooks = gstLines.filter(l => l.gstCategory === "input" && l.reference_no &&
    !gstr2a.some(g => g.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, "") === l.reference_no!.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );

  const months = [...new Set(gstLines.map(l => l.date.slice(0, 7)))].sort();

  // ── UI helpers ───────────────────────────────────────────────────────────
  const tabStyle = (t: typeof tab) => ({
    padding: "0.45rem 1.1rem", borderRadius: 8, border: "none", cursor: "pointer",
    fontFamily: "inherit", fontWeight: 600, fontSize: "0.8rem",
    background: tab === t ? GOLD : "rgba(255,255,255,0.04)",
    color: tab === t ? "#050914" : MUTED,
    transition: "all 0.15s",
  });

  const statCard = (label: string, value: string, color: string, sub?: string) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem 1.25rem", minWidth: 160 }}>
      <div style={{ fontSize: "0.6rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.25rem", fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: "0.68rem", color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui,sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 2rem", display: "flex", alignItems: "center", gap: "0.75rem", height: 52, flexShrink: 0 }}>
        <Link href="/finance" style={{ color: GOLD, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" }}>FreWork Finance</Link>
        <span style={{ color: MUTED }}>›</span>
        <Link href="/finance/audit" style={{ color: MUTED, textDecoration: "none", fontSize: "0.82rem" }}>Audit</Link>
        <span style={{ color: MUTED }}>›</span>
        <span style={{ color: TEXT, fontSize: "0.82rem", fontWeight: 600 }}>GST Reconciliation</span>
        <div style={{ flex: 1 }} />
        {/* FY selector */}
        <select value={selectedFy?.id ?? ""} onChange={e => { const f = fys.find(x => x.id === e.target.value); if (f) setSelectedFy(f); }}
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: TEXT, padding: "4px 10px", borderRadius: 8, fontSize: "0.78rem", fontFamily: "inherit" }}>
          {fys.map(f => <option key={f.id} value={f.id}>{f.label}{f.is_current ? " (Current)" : ""}</option>)}
        </select>
        {/* Upload 2A/2B */}
        <button onClick={() => fileRef.current?.click()}
          style={{ background: "rgba(96,165,250,0.1)", border: `1px solid rgba(96,165,250,0.3)`, color: BLUE, padding: "5px 14px", borderRadius: 8, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
          ↑ Upload GSTR-2A/2B
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleUpload} />
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.5rem 3rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: TEXT }}>GST Reconciliation</h1>
          <div style={{ fontSize: "0.8rem", color: MUTED, marginTop: 4 }}>
            {bizName} · {selectedFy?.label} · Output Tax vs Input Tax Credit
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED, padding: "3rem 0" }}>
            <span style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            Loading GST data…
          </div>
        ) : gstLines.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "2.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏷️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>No GST accounts found</div>
            <div style={{ color: MUTED, fontSize: "0.84rem", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
              Make sure your Chart of Accounts includes accounts named with "CGST", "SGST", or "IGST" (e.g., "CGST Payable", "Input CGST"). Import from Tally or add them manually.
            </div>
          </div>
        ) : (
          <>
            {/* Summary stat cards */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {statCard("Output GST (Liability)", fmtShort(totalOutput), RED, "GST collected on sales")}
              {statCard("Input ITC (Credit)", fmtShort(totalInput), GREEN, "GST paid on purchases")}
              {statCard("Net GST Payable", fmtShort(Math.abs(netPayable)), netPayable >= 0 ? RED : GREEN,
                netPayable >= 0 ? "Payable to govt" : "Excess ITC (carry forward)")}
              {gstr2a.length > 0 && statCard("GSTR-2A/2B Unmatched", `${unmatchedGstr2a.length}`, unmatchedGstr2a.length > 0 ? "#FBBF24" : GREEN,
                unmatchedGstr2a.length > 0 ? "ITC at risk" : "All matched")}
            </div>

            {/* Month filter + tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.35rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "4px" }}>
                <button style={tabStyle("summary")} onClick={() => setTab("summary")}>Monthly Summary</button>
                <button style={tabStyle("output")} onClick={() => setTab("output")}>Output Tax ({outputLines.length})</button>
                <button style={tabStyle("itc")} onClick={() => setTab("itc")}>ITC / Input ({inputLines.length})</button>
                {gstr2a.length > 0 && <button style={tabStyle("upload")} onClick={() => setTab("upload")}>2A/2B Match ({gstr2a.length})</button>}
              </div>
              <div style={{ flex: 1 }} />
              {/* Month filter */}
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT, padding: "5px 10px", borderRadius: 8, fontSize: "0.78rem", fontFamily: "inherit" }}>
                <option value="all">All Months</option>
                {months.map(m => {
                  const d = new Date(m + "-01");
                  return <option key={m} value={m}>{d.toLocaleString("en-IN", { month: "long", year: "numeric" })}</option>;
                })}
              </select>
            </div>

            {/* Upload status msg */}
            {uploadMsg && (
              <div style={{ background: "rgba(96,165,250,0.07)", border: `1px solid rgba(96,165,250,0.2)`, borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.8rem", color: BLUE, marginBottom: "0.75rem" }}>
                {uploadMsg}
              </div>
            )}

            {/* ── TAB: Monthly Summary ─────────────────────────────────────── */}
            {tab === "summary" && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: `1px solid ${BORDER}` }}>
                      {["Month", "Output CGST", "Output SGST", "Output IGST", "Total Output", "Input CGST", "Input SGST", "Input IGST", "Total ITC", "Net Payable"].map(h => (
                        <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: h === "Month" ? "left" : "right", color: MUTED, fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthSummary.map((row, i) => (
                      <tr key={row.month} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                        <td style={{ padding: "0.55rem 0.75rem", fontWeight: 600, color: TEXT, whiteSpace: "nowrap" }}>{row.label}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.outputCGST > 0 ? RED : MUTED }}>{row.outputCGST > 0 ? fmt(row.outputCGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.outputSGST > 0 ? RED : MUTED }}>{row.outputSGST > 0 ? fmt(row.outputSGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.outputIGST > 0 ? RED : MUTED }}>{row.outputIGST > 0 ? fmt(row.outputIGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: row.outputTotal > 0 ? RED : MUTED }}>{row.outputTotal > 0 ? fmt(row.outputTotal) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.inputCGST > 0 ? GREEN : MUTED }}>{row.inputCGST > 0 ? fmt(row.inputCGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.inputSGST > 0 ? GREEN : MUTED }}>{row.inputSGST > 0 ? fmt(row.inputSGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.inputIGST > 0 ? GREEN : MUTED }}>{row.inputIGST > 0 ? fmt(row.inputIGST) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: row.inputTotal > 0 ? GREEN : MUTED }}>{row.inputTotal > 0 ? fmt(row.inputTotal) : "—"}</td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: row.netPayable > 0 ? RED : row.netPayable < 0 ? GREEN : MUTED }}>
                          {row.netPayable !== 0 ? (row.netPayable < 0 ? "(" : "") + fmt(Math.abs(row.netPayable)) + (row.netPayable < 0 ? " ITC)" : "") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid rgba(255,255,255,0.1)`, background: "rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, color: MUTED, fontSize: "0.72rem" }}>TOTAL</td>
                      {[
                        { v: monthSummary.reduce((s, r) => s + r.outputCGST, 0), c: RED },
                        { v: monthSummary.reduce((s, r) => s + r.outputSGST, 0), c: RED },
                        { v: monthSummary.reduce((s, r) => s + r.outputIGST, 0), c: RED },
                        { v: totalOutput, c: RED },
                        { v: monthSummary.reduce((s, r) => s + r.inputCGST, 0), c: GREEN },
                        { v: monthSummary.reduce((s, r) => s + r.inputSGST, 0), c: GREEN },
                        { v: monthSummary.reduce((s, r) => s + r.inputIGST, 0), c: GREEN },
                        { v: totalInput, c: GREEN },
                        { v: netPayable, c: netPayable >= 0 ? RED : GREEN },
                      ].map((cell, i) => (
                        <td key={i} style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: cell.c, fontSize: "0.84rem" }}>
                          {fmt(Math.abs(cell.v))}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ── TAB: Output Tax ──────────────────────────────────────────── */}
            {tab === "output" && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "1rem", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Output Tax (GST Collected on Sales)</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: RED, fontWeight: 700 }}>{fmt(totalOutput)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}>{outputLines.length} entries</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: `1px solid ${BORDER}` }}>
                      {["Date", "Entry No", "Account", "Narration", "Ref", "CGST", "SGST", "IGST", "Amount"].map(h => (
                        <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: ["Date","Entry No","Account","Narration","Ref"].includes(h) ? "left" : "right", color: MUTED, fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {outputLines.map((l, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.035)`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED, whiteSpace: "nowrap" }}>{new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                        <td style={{ padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: GOLD, whiteSpace: "nowrap" }}>{l.entry_no}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: TEXT, fontSize: "0.78rem" }}>{l.account_name}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.narration}</td>
                        <td style={{ padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: MUTED }}>{l.reference_no ?? "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "cgst" ? RED : MUTED }}>{l.gstType === "cgst" ? fmt(l.amount) : "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "sgst" ? RED : MUTED }}>{l.gstType === "sgst" ? fmt(l.amount) : "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "igst" ? RED : MUTED }}>{l.gstType === "igst" ? fmt(l.amount) : "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: RED }}>{fmt(l.amount)}</td>
                      </tr>
                    ))}
                    {outputLines.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: MUTED }}>No output tax entries for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── TAB: ITC / Input ─────────────────────────────────────────── */}
            {tab === "itc" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* ITC flags */}
                {unmatchedInBooks.length > 0 && (
                  <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.8rem" }}>
                    <span style={{ color: "#FBBF24", fontWeight: 700 }}>⚠ {unmatchedInBooks.length} ITC entries have invoice references not matched in uploaded GSTR-2A/2B.</span>
                    {" "}<span style={{ color: MUTED }}>Upload GSTR-2A/2B JSON to check ITC eligibility.</span>
                  </div>
                )}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "1rem", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Input Tax Credit (ITC Claimed)</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: GREEN, fontWeight: 700 }}>{fmt(totalInput)}</span>
                    <span style={{ fontSize: "0.72rem", color: MUTED }}>{inputLines.length} entries</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: `1px solid ${BORDER}` }}>
                        {["Date", "Entry No", "Account", "Narration", "Ref / Invoice", "CGST", "SGST", "IGST", "Amount", "2A/2B"].map(h => (
                          <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: ["Date","Entry No","Account","Narration","Ref / Invoice"].includes(h) ? "left" : "right", color: MUTED, fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inputLines.map((l, i) => {
                        const inGstr2a = gstr2a.length > 0
                          ? gstr2a.some(g => l.reference_no && g.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, "") === l.reference_no.toLowerCase().replace(/[^a-z0-9]/g, ""))
                          : null;
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.035)`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                            <td style={{ padding: "0.5rem 0.75rem", color: MUTED, whiteSpace: "nowrap" }}>{new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: GOLD, whiteSpace: "nowrap" }}>{l.entry_no}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: TEXT, fontSize: "0.78rem" }}>{l.account_name}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: MUTED, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.narration}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: l.reference_no ? TEXT : MUTED }}>{l.reference_no ?? "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "cgst" ? GREEN : MUTED }}>{l.gstType === "cgst" ? fmt(l.amount) : "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "sgst" ? GREEN : MUTED }}>{l.gstType === "sgst" ? fmt(l.amount) : "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: l.gstType === "igst" ? GREEN : MUTED }}>{l.gstType === "igst" ? fmt(l.amount) : "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: GREEN }}>{fmt(l.amount)}</td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                              {inGstr2a === null ? <span style={{ color: MUTED, fontSize: "0.7rem" }}>—</span>
                                : inGstr2a ? <span style={{ color: GREEN, fontSize: "0.72rem", fontWeight: 700 }}>✓ Matched</span>
                                : <span style={{ color: "#FBBF24", fontSize: "0.72rem", fontWeight: 700 }}>⚠ Not in 2B</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {inputLines.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: MUTED }}>No ITC entries for this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: GSTR-2A/2B Match ────────────────────────────────────── */}
            {tab === "upload" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {gstr2a.length === 0 ? (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "3rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload GSTR-2A or GSTR-2B JSON</div>
                    <div style={{ color: MUTED, fontSize: "0.84rem", maxWidth: 420, margin: "0 auto 1.25rem", lineHeight: 1.7 }}>
                      Download the JSON from <strong style={{ color: TEXT }}>GST Portal → Return Dashboard → GSTR-2A/2B → Download JSON</strong> and upload here to match with your books and check ITC eligibility.
                    </div>
                    <button onClick={() => fileRef.current?.click()}
                      style={{ background: GOLD, color: "#050914", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" }}>
                      ↑ Upload JSON File
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Summary cards */}
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {[
                        { label: "Total in GSTR-2A/2B", v: gstr2a.length, color: BLUE },
                        { label: "Matched with Books", v: gstr2a.filter(i => i.matched).length, color: GREEN },
                        { label: "Not in Books (missing)", v: unmatchedGstr2a.length, color: unmatchedGstr2a.length ? "#FBBF24" : GREEN },
                        { label: "ITC in 2B (total)", v: fmt(gstr2a.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0)), color: GREEN },
                      ].map(c => (
                        <div key={c.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.9rem 1.1rem", minWidth: 150 }}>
                          <div style={{ fontSize: "0.6rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{c.label}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.15rem", fontWeight: 700, color: c.color }}>{c.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Unmatched invoices (ITC at risk) */}
                    {unmatchedGstr2a.length > 0 && (
                      <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(251,191,36,0.15)", fontWeight: 700, fontSize: "0.84rem", color: "#FBBF24" }}>
                          ⚠ {unmatchedGstr2a.length} Invoices in GSTR-2A/2B — NOT recorded in your books
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.79rem" }}>
                          <thead>
                            <tr style={{ background: "rgba(251,191,36,0.04)", borderBottom: "1px solid rgba(251,191,36,0.1)" }}>
                              {["Supplier GSTIN", "Trade Name", "Invoice No", "Date", "Taxable", "CGST", "SGST", "IGST"].map(h => (
                                <th key={h} style={{ padding: "0.45rem 0.75rem", textAlign: ["Supplier GSTIN","Trade Name","Invoice No","Date"].includes(h) ? "left" : "right", color: "rgba(251,191,36,0.6)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {unmatchedGstr2a.map((inv, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(251,191,36,0.06)" }}>
                                <td style={{ padding: "0.45rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: TEXT }}>{inv.gstin}</td>
                                <td style={{ padding: "0.45rem 0.75rem", color: TEXT }}>{inv.trade_name || "—"}</td>
                                <td style={{ padding: "0.45rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "#FBBF24" }}>{inv.invoice_no}</td>
                                <td style={{ padding: "0.45rem 0.75rem", color: MUTED }}>{inv.invoice_date}</td>
                                <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: TEXT }}>{fmt(inv.taxable_value)}</td>
                                <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.cgst > 0 ? GREEN : MUTED }}>{inv.cgst > 0 ? fmt(inv.cgst) : "—"}</td>
                                <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.sgst > 0 ? GREEN : MUTED }}>{inv.sgst > 0 ? fmt(inv.sgst) : "—"}</td>
                                <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.igst > 0 ? GREEN : MUTED }}>{inv.igst > 0 ? fmt(inv.igst) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Matched invoices */}
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, fontWeight: 700, fontSize: "0.84rem", color: GREEN }}>
                        ✓ {gstr2a.filter(i => i.matched).length} Matched — Invoice found in both GSTR-2A/2B and Books
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.79rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(52,211,153,0.04)", borderBottom: "1px solid rgba(52,211,153,0.1)" }}>
                            {["Supplier GSTIN", "Trade Name", "Invoice No", "Date", "Taxable", "CGST", "SGST", "IGST", "Matched Entry"].map(h => (
                              <th key={h} style={{ padding: "0.45rem 0.75rem", textAlign: ["Supplier GSTIN","Trade Name","Invoice No","Date","Matched Entry"].includes(h) ? "left" : "right", color: "rgba(52,211,153,0.5)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gstr2a.filter(i => i.matched).map((inv, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(52,211,153,0.06)" }}>
                              <td style={{ padding: "0.45rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: TEXT }}>{inv.gstin}</td>
                              <td style={{ padding: "0.45rem 0.75rem", color: TEXT }}>{inv.trade_name || "—"}</td>
                              <td style={{ padding: "0.45rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: GOLD }}>{inv.invoice_no}</td>
                              <td style={{ padding: "0.45rem 0.75rem", color: MUTED }}>{inv.invoice_date}</td>
                              <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: TEXT }}>{fmt(inv.taxable_value)}</td>
                              <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.cgst > 0 ? GREEN : MUTED }}>{inv.cgst > 0 ? fmt(inv.cgst) : "—"}</td>
                              <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.sgst > 0 ? GREEN : MUTED }}>{inv.sgst > 0 ? fmt(inv.sgst) : "—"}</td>
                              <td style={{ padding: "0.45rem 0.75rem", textAlign: "right", color: inv.igst > 0 ? GREEN : MUTED }}>{inv.igst > 0 ? fmt(inv.igst) : "—"}</td>
                              <td style={{ padding: "0.45rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: GREEN }}>{inv.matchedEntry}</td>
                            </tr>
                          ))}
                          {gstr2a.filter(i => i.matched).length === 0 && (
                            <tr><td colSpan={9} style={{ padding: "1.5rem", textAlign: "center", color: MUTED }}>No matched invoices yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
