"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ── Tally XML helpers ────────────────────────────────────────────────────────

function tallyDate(iso: string) {
  // Tally expects YYYYMMDD
  return iso.slice(0, 10).replace(/-/g, "");
}

function ledgerGroupForType(type: string): string {
  const map: Record<string, string> = {
    asset: "Current Assets",
    bank: "Bank Accounts",
    cash: "Cash-in-Hand",
    liability: "Current Liabilities",
    equity: "Capital Account",
    income: "Sales Accounts",
    expense: "Indirect Expenses",
    cost_of_goods: "Direct Expenses",
    tax: "Duties & Taxes",
    loan: "Loans (Liability)",
    fixed_asset: "Fixed Assets",
  };
  return map[type] ?? "Indirect Expenses";
}

function buildLedgerXML(accounts: { name: string; type: string }[]) {
  const entries = accounts.map(a => `
  <TALLYMESSAGE xmlns:UDF="TallyUDF">
   <LEDGER NAME="${a.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}" ACTION="Create">
    <NAME>${a.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</NAME>
    <PARENT>${ledgerGroupForType(a.type)}</PARENT>
    <ISBILLWISEON>No</ISBILLWISEON>
    <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
   </LEDGER>
  </TALLYMESSAGE>`).join("");
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY></SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${entries}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

function voucherType(jtype: string) {
  const m: Record<string, string> = {
    sales: "Sales", purchase: "Purchase", payment: "Payment",
    receipt: "Receipt", contra: "Contra", journal: "Journal",
    debit_note: "Debit Note", credit_note: "Credit Note",
  };
  return m[jtype] ?? "Journal";
}

function buildVoucherXML(journals: {
  date: string; narration: string; voucher_type: string;
  lines: { account_name: string; dr_amount: number; cr_amount: number }[];
}[]) {
  const entries = journals.map(j => {
    const allLedgers = j.lines.map(l => {
      const amt = l.dr_amount > 0 ? l.dr_amount : l.cr_amount;
      const isDr = l.dr_amount > 0;
      return `<ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${l.account_name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>${isDr ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
       <AMOUNT>${isDr ? -amt : amt}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
    }).join("");
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
   <VOUCHER VCHTYPE="${voucherType(j.voucher_type)}" ACTION="Create">
    <DATE>${tallyDate(j.date)}</DATE>
    <NARRATION>${(j.narration ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</NARRATION>
    <VOUCHERTYPENAME>${voucherType(j.voucher_type)}</VOUCHERTYPENAME>
    <VOUCHERNUMBER></VOUCHERNUMBER>
    ${allLedgers}
   </VOUCHER>
  </TALLYMESSAGE>`;
  }).join("");
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY></SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${entries}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

// ── Parse company name from any Tally XML response ───────────────────────────

function extractCompanyName(xml: string): string {
  // Try specific company tags only — avoid generic <NAME> which matches ledger names
  const patterns = [
    /<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/i,
    /<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i,
    /<BASICCOMPANYNAME[^>]*>([^<]+)<\/BASICCOMPANYNAME>/i,
    // NAME inside a COMPANY block
    /<COMPANY[^>]*NAME="([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

// ── Import ledgers FROM Tally → fw_fin_accounts ──────────────────────────────

function parseTallyLedgers(xml: string): { name: string; parent: string }[] {
  const seen = new Set<string>();
  const results: { name: string; parent: string }[] = [];

  // Method 1: Tally Prime collection format — <LEDGER NAME="...">...<PARENT.LIST><PARENT>...</PARENT>
  // Tally Prime format: <LEDGER NAME="..."><PARENT TYPE="String">GroupName</PARENT>
  const ledgerBlockRe = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
  let m;
  while ((m = ledgerBlockRe.exec(xml)) !== null) {
    const name = m[1].trim();
    if (!name || name === "0") continue; // skip system/empty ledgers
    const block = m[2];
    // PARENT tag may have attributes like TYPE="String" — match with [^>]*
    const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
    const parent = parentMatch?.[1]?.trim() ?? "";
    if (!seen.has(name)) { seen.add(name); results.push({ name, parent }); }
  }

  // Fallback: child element format
  if (!results.length) {
    const ledgerRe = /<LEDGER[^>]*>([\s\S]*?)<\/LEDGER>/gi;
    while ((m = ledgerRe.exec(xml)) !== null) {
      const block = m[1];
      const nameMatch = block.match(/<NAME\.LIST[^>]*>[\s\S]*?<NAME>([^<]+)<\/NAME>/i)
        ?? block.match(/<NAME>([^<]+)<\/NAME>/i);
      const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
      const name = nameMatch?.[1]?.trim() ?? "";
      const parent = parentMatch?.[1]?.trim() ?? "";
      if (name && name !== "0" && !seen.has(name)) { seen.add(name); results.push({ name, parent }); }
    }
  }

  return results;
}

function tallyParentToType(parent: string): string {
  const p = parent.toLowerCase();
  if (p.includes("bank")) return "bank";
  if (p.includes("cash")) return "cash";
  if (p.includes("sales") || p.includes("income") || p.includes("revenue")) return "income";
  if (p.includes("purchase") || p.includes("direct exp") || p.includes("cost")) return "cost_of_goods";
  if (p.includes("indirect exp") || p.includes("expense")) return "expense";
  if (p.includes("capital") || p.includes("reserve") || p.includes("equity")) return "equity";
  if (p.includes("loan") || p.includes("borrowing")) return "loan";
  if (p.includes("duties") || p.includes("tax")) return "tax";
  if (p.includes("fixed asset") || p.includes("plant") || p.includes("machinery")) return "fixed_asset";
  if (p.includes("current asset") || p.includes("sundry debt") || p.includes("receivable")) return "asset";
  if (p.includes("current liab") || p.includes("sundry cred") || p.includes("payable")) return "liability";
  return "expense";
}

// ── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = "idle" | "connecting" | "connected" | "error";

// ── Component ────────────────────────────────────────────────────────────────

export default function TallyPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string; start_date: string; end_date: string; is_current: boolean }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [journalCount, setJournalCount] = useState<number | null>(null);
  const [journals, setJournals] = useState<{
    id: string; date: string; narration: string; type: string;
    entry_no: string; total_debit: number; total_credit: number;
  }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pushResults, setPushResults] = useState<{ id: string; entry_no: string; date: string; narration: string; ok: boolean; error: string }[]>([]);
  const [creatingLedgers, setCreatingLedgers] = useState(false);
  const [createLedgerResult, setCreateLedgerResult] = useState<string | null>(null);

  // Connector state
  const [tallyPort, setTallyPort] = useState("7001");
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connMsg, setConnMsg] = useState("");
  const [companyName, setCompanyName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("fw_tally_company") ?? "";
    // Reject obviously wrong values (single short words like "abc" that came from ledger name parsing bug)
    return stored.length > 4 ? stored : "";
  });
  const [rawDebug, setRawDebug] = useState<string>("");
  const [syncing, setSyncing] = useState<"ledgers" | "vouchers" | "import" | null>(null);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const tallyUrl = `http://localhost:${tallyPort}`;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date,is_current").eq("business_id", saved).order("start_date", { ascending: false });
      if (fys?.length) {
        setFinancialYears(fys);
        const cur = fys.find(f => f.is_current) ?? fys[0];
        setFyId(cur.id);
        setFrom(cur.start_date);
        setTo(cur.end_date);
      }
      const { count, data: jData } = await supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type,total_debit,total_credit", { count: "exact" }).eq("business_id", saved).eq("status", "posted").order("date");
      setJournalCount(count ?? 0);
      if (jData?.length) { setJournals(jData); setPreviewOpen(true); }
    });
  }, []);

  async function loadJournalPreview() {
    if (!bizId) return;
    setPreviewLoading(true); setPreviewOpen(true); setSyncResult(null);
    let query = supabase
      .from("fw_fin_journals")
      .select("id,entry_no,date,narration,type,total_debit,total_credit")
      .eq("business_id", bizId)
      .eq("status", "posted");
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    const { data } = await query.order("date");
    setJournals(data ?? []);
    setJournalCount(data?.length ?? 0);
    setPreviewLoading(false);
  }

  async function createMissingLedgers() {
    const missingNames = [...new Set(
      pushResults
        .filter(r => !r.ok && r.error.toLowerCase().includes("does not exist"))
        .map(r => { const m = r.error.match(/Ledger '([^']+)' does not exist/i); return m?.[1] ?? null; })
        .filter(Boolean) as string[]
    )];
    if (!missingNames.length) return;
    setCreatingLedgers(true); setCreateLedgerResult(null);

    // Map FrePilot account type → Tally parent group
    const PARENT_MAP: Record<string, string> = {
      "Indirect Expenses": "Indirect Expenses",
      "Direct Expenses": "Direct Expenses",
      "Miscellaneous": "Indirect Expenses",
      "Bank Accounts": "Bank Accounts",
      "Cash": "Cash-in-Hand",
      "Sundry Creditors": "Sundry Creditors",
      "Sundry Debtors": "Sundry Debtors",
    };

    let ledgerXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>`;
    for (const name of missingNames) {
      const parent = PARENT_MAP[name] ?? "Indirect Expenses";
      ledgerXml += `
        <TALLYMESSAGE>
          <LEDGER NAME="${name.replace(/&/g,"&amp;").replace(/</g,"&lt;")}" ACTION="Create">
            <NAME>${name.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</NAME>
            <PARENT>${parent}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>`;
    }
    ledgerXml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      const res = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: ledgerXml, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      const errors = (text.match(/LINEERROR/gi) ?? []).length;
      setCreateLedgerResult(errors === 0
        ? `✓ Created ${missingNames.length} ledger(s) in Tally: ${missingNames.join(", ")}. Now click Push Vouchers again.`
        : `⚠ Some ledgers may already exist in Tally — click Push Vouchers to retry.`);
    } catch (e) {
      setCreateLedgerResult(`❌ ${e instanceof Error ? e.message : "Network error"}`);
    }
    setCreatingLedgers(false);
  }

  // ── Test connection ──────────────────────────────────────────────────────

  async function testConnection() {
    setConnStatus("connecting"); setConnMsg(""); setSyncResult(null); setRawDebug("");
    try {
      // Fetch company info + current period dates
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,StartingFrom,EndingAt</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res = await fetch(tallyUrl, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xml,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const text = await res.text();
        const found = extractCompanyName(text);
        setRawDebug(text.slice(0, 800));
        setCompanyName(found);
        if (found) localStorage.setItem("fw_tally_company", found);
        setConnStatus("connected");
        setConnMsg(found ? `Connected — ${found}` : "Connected to Tally");

        // Parse Tally's current period dates (format: YYYYMMDD or DD-Mon-YYYY)
        const startMatch = text.match(/<STARTINGFROM[^>]*>([^<]+)<\/STARTINGFROM>/i)
          ?? text.match(/<STARTDATE[^>]*>([^<]+)<\/STARTDATE>/i);
        const endMatch = text.match(/<ENDINGAT[^>]*>([^<]+)<\/ENDINGAT>/i)
          ?? text.match(/<ENDDATE[^>]*>([^<]+)<\/ENDDATE>/i);

        function tallyDateToISO(d: string): string | null {
          d = d.trim();
          // YYYYMMDD
          if (/^\d{8}$/.test(d)) return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
          // DD-Mon-YYYY or D-Mon-YY
          const months: Record<string,string> = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
          const m = d.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
          if (m) {
            const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
            return `${yr}-${months[m[2].toLowerCase()] ?? "01"}-${m[1].padStart(2,"0")}`;
          }
          return null;
        }

        if (startMatch) { const iso = tallyDateToISO(startMatch[1]); if (iso) setFrom(iso); }
        if (endMatch)   { const iso = tallyDateToISO(endMatch[1]);   if (iso) setTo(iso);   }
      } else {
        setConnStatus("error"); setConnMsg(`Tally responded with HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setConnStatus("error");
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setConnMsg("Cannot reach bridge on port " + tallyPort + ". Run: node tally-bridge.js in a terminal, then try again.");
      } else if (msg.includes("timeout") || msg.includes("aborted")) {
        setConnMsg("Connection timed out. Is the bridge script running? Run: node tally-bridge.js");
      } else {
        setConnMsg(msg);
      }
    }
  }

  // ── Sync ledgers ─────────────────────────────────────────────────────────

  const syncLedgers = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    setSyncing("ledgers"); setSyncResult(null);
    const { data: accounts } = await supabase
      .from("fw_fin_chart_of_accounts")
      .select("name,type")
      .eq("business_id", bizId)
      .order("name");
    if (!accounts?.length) { setSyncResult({ ok: false, msg: "No accounts found in Chart of Accounts." }); setSyncing(null); return; }
    const xml = buildLedgerXML(accounts);
    try {
      const res = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      const errors = (text.match(/LINEERROR/gi) ?? []).length;
      setSyncResult({ ok: errors === 0, msg: errors === 0 ? `${accounts.length} ledgers pushed to Tally successfully.` : `Pushed ${accounts.length} ledgers — ${errors} already exist or had name mismatch (normal if already created).` });
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(null);
  }, [bizId, connStatus, tallyUrl, from, to]);

  // ── Import ledgers FROM Tally → FrePilot Chart of Accounts ──────────────────

  const importLedgers = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    setSyncing("import"); setSyncResult(null);
    try {
      // Tally Prime format: Collection export using VERSION + TYPE=Collection + DESC
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Ledgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Ledgers" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      setRawDebug(text.slice(0, 2000));
      const ledgers = parseTallyLedgers(text);
      if (!ledgers.length) {
        setSyncResult({ ok: false, msg: `No ledgers found. Open the Raw response above to see what Tally returned.` });
        setSyncing(null); return;
      }

      // Fetch existing account names to avoid duplicates
      const { data: existing } = await supabase
        .from("fw_fin_chart_of_accounts")
        .select("name")
        .eq("business_id", bizId);
      const existingNames = new Set((existing ?? []).map(a => a.name));

      const rows = ledgers
        .filter(l => !existingNames.has(l.name))
        .map((l, idx) => ({
          business_id: bizId,
          code: `TL${String(idx + 1).padStart(3, "0")}`,
          name: l.name,
          type: tallyParentToType(l.parent),
          description: l.parent ? `Imported from Tally — ${l.parent}` : "Imported from Tally",
          is_system: false,
          is_group: false,
          sort_order: (existing?.length ?? 0) + idx + 1,
        }));

      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase
          .from("fw_fin_chart_of_accounts")
          .insert(rows.slice(i, i + 50));
        if (!error) inserted += Math.min(50, rows.length - i);
      }
      setSyncResult({ ok: true, msg: `Imported ${inserted} new ledgers from Tally into Chart of Accounts (${existingNames.size} already existed).` });

      // Refresh journal count
      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId).eq("status", "posted");
      setJournalCount(count ?? 0);
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(null);
  }, [bizId, connStatus, tallyUrl, from, to]);

  // ── Push vouchers ─────────────────────────────────────────────────────────

  const pushVouchers = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    setSyncing("vouchers"); setSyncResult(null);

    const previewIds = journals.map(j => j.id);
    if (!previewIds.length) { setSyncResult({ ok: false, msg: "No journals in preview. Click Refresh Preview first." }); setSyncing(null); return; }

    setPushResults([]);
    try {
      // Step 1: Get per-voucher XML from server (service role bypasses RLS)
      const apiRes = await fetch("/api/finance/tally-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journal_ids: previewIds, business_id: bizId, company_name: companyName }),
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok || !apiData.vouchers) { setSyncResult({ ok: false, msg: apiData.error ?? "Failed to build voucher XML" }); setSyncing(null); return; }

      // Step 2: Push each voucher individually to local Tally bridge, track per-entry results
      const results: typeof pushResults = [];
      for (const v of apiData.vouchers as { id: string; entry_no: string; date: string; narration: string; xml: string }[]) {
        try {
          const tallyRes = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: v.xml, signal: AbortSignal.timeout(15000) });
          const text = await tallyRes.text();
          const hasError = /LINEERROR/i.test(text);
          const errMatch = text.match(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i);
          const rawErr = errMatch?.[1]?.trim() ?? "";
          const decodedErr = rawErr.replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
          results.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: !hasError, error: decodedErr });
        } catch (e) {
          results.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: false, error: e instanceof Error ? e.message : "Network error" });
        }
      }
      setPushResults(results);
      const succeeded = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      setSyncResult({ ok: failed === 0, msg: failed === 0 ? `✓ All ${succeeded} vouchers pushed to Tally successfully.` : `${succeeded} pushed ✓ · ${failed} failed ✗ — see details below.` });
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error reaching Tally bridge" });
    }
    setSyncing(null);
  }, [bizId, connStatus, tallyUrl, companyName, journals]);

  function buildExportUrl() {
    const params = new URLSearchParams({ business_id: bizId! });
    if (fyId) params.set("fy_id", fyId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/finance/tally-export?${params}`;
  }

  const inp: React.CSSProperties = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", outline: "none" };
  const statusColors: Record<ConnStatus, string> = { idle: "#8A9BB8", connecting: "#F59E0B", connected: "#4ade80", error: "#f87171" };
  const statusLabels: Record<ConnStatus, string> = { idle: "Not connected", connecting: "Connecting…", connected: "Connected", error: "Error" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(59,130,246,0.15)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#3B82F6", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Tally Bridge</span>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>Tally Bridge</h1>
        <p style={{ margin: "0 0 2rem", color: "rgba(237,232,220,0.5)", fontSize: "0.88rem" }}>Push ledgers and vouchers directly into Tally — no XML import needed. Follow the 3 steps below.</p>

        {/* ── SETUP STEPS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {/* Step 1 */}
          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "1rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Step 1 — One-time setup</div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>Download Bridge</div>
            <p style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.5)", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Browser security blocks direct calls to Tally. Download and double-click the launcher below.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <a href="/run-tally-bridge.bat" download="run-tally-bridge.bat"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", background: "#3B82F6", color: "#fff", borderRadius: 7, padding: "8px 0", fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>
                ⬇ Download &amp; Run (Windows .bat)
              </a>
              <a href="/tally-bridge.js" download="tally-bridge.js"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", background: "rgba(59,130,246,0.1)", color: "#60A5FA", borderRadius: 7, padding: "6px 0", fontWeight: 600, fontSize: "0.75rem", textDecoration: "none", border: "1px solid rgba(59,130,246,0.25)" }}>
                ⬇ tally-bridge.js (manual)
              </a>
            </div>
            <p style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.3)", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
              Download both files to the same folder. Double-click the .bat file — keep the window open while syncing. Requires <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" style={{ color: "#60A5FA" }}>Node.js</a>.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "1rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Step 2 — In Tally</div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>Enable HTTP Server</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {["Open Tally Prime", "F12 → Client/Server configuration", "TallyPrime acts as → Both or Server", "Enable ODBC → Yes · Port → 9000", "Press Escape to save"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <span style={{ background: "rgba(237,232,220,0.12)", color: "rgba(237,232,220,0.6)", width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.6rem", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: "0.73rem", color: "rgba(237,232,220,0.55)", lineHeight: 1.4 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 12, padding: "1rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "rgba(74,222,128,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Step 3 — Here</div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>Connect &amp; Sync</div>
            <p style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.5)", margin: "0", lineHeight: 1.5 }}>
              With the bridge running (port 7001) and Tally open, click <strong style={{ color: "#4ade80" }}>Connect to Tally</strong> below, then sync ledgers and push vouchers.
            </p>
          </div>
        </div>

        {/* ── LIVE CONNECTOR ── */}
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "1.3rem" }}>🔌</span>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#60A5FA" }}>Live Tally Connector</span>
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: `${statusColors[connStatus]}18`, color: statusColors[connStatus], border: `1px solid ${statusColors[connStatus]}40` }}>
              ● {statusLabels[connStatus]}
            </span>
          </div>

          {/* Port + connect */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem" }}>Bridge Port</label>
              <input value={tallyPort} onChange={e => setTallyPort(e.target.value)} style={{ ...inp, width: 100 }} placeholder="7001" />
            </div>
            <button onClick={testConnection} disabled={connStatus === "connecting"}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: connStatus === "connecting" ? 0.6 : 1 }}>
              {connStatus === "connecting" ? "Testing…" : connStatus === "connected" ? "Re-test" : "Connect to Tally"}
            </button>
          </div>

          {connStatus === "connected" && companyName && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🏢</span>
              <div>
                <div style={{ fontSize: "0.62rem", color: "rgba(74,222,128,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Connected Tally Company</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#4ade80", marginTop: 2 }}>{companyName}</div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "rgba(74,222,128,0.6)" }}>● Live</span>
            </div>
          )}

          {connStatus === "connected" && !companyName && (
            <div style={{ fontSize: "0.8rem", color: "#4ade80", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem" }}>
              ✓ Connected to Tally (company name not returned — check Tally is in a company)
            </div>
          )}

          {connStatus === "error" && connMsg && (
            <div style={{ fontSize: "0.8rem", color: "#f87171", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem" }}>
              {connMsg}
            </div>
          )}

          {(connStatus === "error") && (
            <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)", marginBottom: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "0.6rem 0.9rem" }}>
              💡 Make sure <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>node tally-bridge.js</code> is running in a terminal on this PC, and Tally is open.
            </div>
          )}

          {/* Debug panel — always expanded so we can see what Tally returns */}
          {rawDebug && (
            <details open style={{ marginBottom: "1rem" }}>
              <summary style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", cursor: "pointer", marginBottom: "0.4rem" }}>🔍 Raw Tally response</summary>
              <pre style={{ marginTop: "0.25rem", fontSize: "0.66rem", color: "rgba(237,232,220,0.55)", background: "rgba(0,0,0,0.4)", padding: "0.75rem", borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }}>
                {rawDebug}
              </pre>
            </details>
          )}

          {/* Date range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem" }}>From Date</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem" }}>To Date</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginBottom: "0.5rem", fontSize: "0.65rem", fontWeight: 700, color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Tally → FrePilot</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button onClick={importLedgers} disabled={connStatus !== "connected" || !!syncing}
              style={{ flex: 1, minWidth: 220, padding: "13px 0", borderRadius: 10, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.08)", color: connStatus === "connected" ? "#4ade80" : "rgba(74,222,128,0.3)", fontWeight: 700, fontSize: "0.88rem", cursor: connStatus === "connected" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {syncing === "import" ? "⏳ Importing…" : "⬇ Import Ledgers from Tally"}
            </button>
          </div>
          {/* Journal Preview */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>FrePilot → Tally</div>
              <button onClick={loadJournalPreview} style={{ background: "none", border: "1px solid rgba(237,232,220,0.15)", color: "rgba(237,232,220,0.55)", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                {previewOpen ? "↺ Refresh Preview" : "👁 Preview Journals"}
              </button>
            </div>

            {previewOpen && (
              <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, marginBottom: "1rem", overflow: "hidden" }}>
                {previewLoading ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "rgba(237,232,220,0.35)", fontSize: "0.8rem" }}>Loading journals…</div>
                ) : journals.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.8rem" }}>No posted journals in this date range.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(237,232,220,0.08)" }}>
                          {["Entry No", "Date", "Type", "Narration", "DR (₹)", "CR (₹)"].map(h => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "rgba(237,232,220,0.35)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {journals.map((j, i) => {
                          const typeColor: Record<string, string> = { sales: "#4ade80", purchase: "#60a5fa", expense: "#f59e0b", payment: "#a78bfa", receipt: "#34d399", journal: "rgba(237,232,220,0.4)" };
                          return (
                            <tr key={j.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(237,232,220,0.05)" }}>
                              <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", color: "rgba(237,232,220,0.4)", whiteSpace: "nowrap" }}>{j.entry_no}</td>
                              <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", color: "rgba(237,232,220,0.6)" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                              <td style={{ padding: "0.5rem 0.75rem" }}>
                                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: typeColor[j.type] ?? "rgba(237,232,220,0.4)", background: `${typeColor[j.type] ?? "rgba(237,232,220,0.1)"}18`, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>{j.type}</span>
                              </td>
                              <td style={{ padding: "0.5rem 0.75rem", color: "rgba(237,232,220,0.7)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#4ade80", whiteSpace: "nowrap" }}>₹{Number(j.total_debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#60a5fa", whiteSpace: "nowrap" }}>₹{Number(j.total_credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "1px solid rgba(237,232,220,0.12)", background: "rgba(255,255,255,0.02)" }}>
                          <td colSpan={4} style={{ padding: "0.5rem 0.75rem", fontWeight: 700, fontSize: "0.72rem", color: "rgba(237,232,220,0.5)" }}>{journals.length} journal{journals.length !== 1 ? "s" : ""} ready to push</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>₹{journals.reduce((s, j) => s + Number(j.total_debit), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>₹{journals.reduce((s, j) => s + Number(j.total_credit), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={syncLedgers} disabled={connStatus !== "connected" || !!syncing}
              style={{ flex: 1, minWidth: 180, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.1)", color: connStatus === "connected" ? "#60A5FA" : "rgba(96,165,250,0.35)", fontWeight: 700, fontSize: "0.88rem", cursor: connStatus === "connected" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {syncing === "ledgers" ? "⏳ Syncing Ledgers…" : "📒 Push Ledgers to Tally"}
            </button>
            <button onClick={pushVouchers} disabled={connStatus !== "connected" || !!syncing}
              style={{ flex: 1, minWidth: 180, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(129,140,248,0.35)", background: "rgba(129,140,248,0.1)", color: connStatus === "connected" ? "#818CF8" : "rgba(129,140,248,0.35)", fontWeight: 700, fontSize: "0.88rem", cursor: connStatus === "connected" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {syncing === "vouchers" ? "⏳ Pushing Vouchers…" : `🧾 Push Vouchers (${journalCount ?? "—"} entries)${companyName ? ` → ${companyName}` : ""}`}
            </button>
          </div>

          {syncResult && (
            <div style={{ marginTop: "1rem", fontSize: "0.82rem", fontWeight: 600, color: syncResult.ok ? "#4ade80" : "#fbbf24", background: syncResult.ok ? "rgba(74,222,128,0.07)" : "rgba(251,191,36,0.07)", border: `1px solid ${syncResult.ok ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)"}`, borderRadius: 8, padding: "0.7rem 1rem" }}>
              {syncResult.ok ? "✓ " : "⚠ "}{syncResult.msg}
            </div>
          )}

          {pushResults.length > 0 && (
            <div style={{ marginTop: "0.75rem", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "0.6rem 0.9rem", fontSize: "0.65rem", fontWeight: 700, color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(237,232,220,0.06)" }}>
                Push Results — {pushResults.filter(r => r.ok).length} success · {pushResults.filter(r => !r.ok).length} failed
              </div>
              {pushResults.some(r => r.error.toLowerCase().includes("does not exist")) && (
                <div style={{ padding: "0.7rem 1rem", background: "rgba(251,191,36,0.06)", borderBottom: "1px solid rgba(251,191,36,0.15)", fontSize: "0.78rem", color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ flex: 1 }}>💡 Missing ledgers detected in Tally</span>
                  <button onClick={createMissingLedgers} disabled={creatingLedgers || connStatus !== "connected"}
                    style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "5px 14px", borderRadius: 6, fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {creatingLedgers ? "Creating…" : "⚡ Create Missing Ledgers in Tally"}
                  </button>
                </div>
              )}
              {createLedgerResult && (
                <div style={{ padding: "0.6rem 1rem", background: createLedgerResult.startsWith("✓") ? "rgba(74,222,128,0.07)" : "rgba(251,191,36,0.07)", borderBottom: "1px solid rgba(237,232,220,0.06)", fontSize: "0.78rem", color: createLedgerResult.startsWith("✓") ? "#4ade80" : "#fbbf24" }}>
                  {createLedgerResult}
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <tbody>
                  {pushResults.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(237,232,220,0.05)" }}>
                      <td style={{ padding: "0.45rem 0.9rem", width: 22, textAlign: "center", fontSize: "0.9rem" }}>{r.ok ? "✅" : "❌"}</td>
                      <td style={{ padding: "0.45rem 0.5rem", fontFamily: "monospace", color: "rgba(237,232,220,0.4)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>{r.entry_no}</td>
                      <td style={{ padding: "0.45rem 0.5rem", color: "rgba(237,232,220,0.5)", whiteSpace: "nowrap", fontSize: "0.72rem" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      <td style={{ padding: "0.45rem 0.5rem", color: r.ok ? "rgba(237,232,220,0.65)" : "#fbbf24", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.ok ? r.narration : (r.error || "Tally rejected — check ledger names")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── TIPS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
          {[
            { icon: "1️⃣", title: "Sync Ledgers First", desc: "Always push Chart of Accounts before pushing vouchers — Tally needs ledgers to exist first." },
            { icon: "🏢", title: "Active Company", desc: "Vouchers are pushed into whichever company is currently open in Tally. Switch company in Tally if needed." },
            { icon: "🔁", title: "Duplicates", desc: "Tally does not deduplicate vouchers. Push once per date range to avoid double entries." },
            { icon: "🌐", title: "Same PC only", desc: "The browser must be on the same PC as Tally. Won't work from mobile or another device." },
          ].map(t => (
            <div key={t.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 10, padding: "0.9rem 1rem" }}>
              <div style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{t.title}</div>
              <div style={{ fontSize: "0.74rem", color: "rgba(237,232,220,0.4)", lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* ── XML EXPORT (kept as fallback) ── */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.25rem", fontSize: "0.88rem" }}>⬇ Manual XML Export (fallback)</div>
          <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>If the live connector doesn&apos;t work, download XML and import manually via Gateway of Tally → Import → Vouchers.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem" }}>Financial Year</label>
              <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
                {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              {bizId && (
                <a href={buildExportUrl()} download style={{ display: "block", width: "100%", textAlign: "center", background: "rgba(237,232,220,0.08)", color: "#EDE8DC", padding: "9px 0", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.85rem", border: "1px solid rgba(237,232,220,0.12)" }}>
                  Download Tally XML
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
