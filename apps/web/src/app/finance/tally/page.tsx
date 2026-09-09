"use client";
import React, { useState, useEffect, useCallback } from "react";
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
  const patterns = [
    /<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/i,
    /<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i,
    /<BASICCOMPANYNAME[^>]*>([^<]+)<\/BASICCOMPANYNAME>/i,
    // attribute anywhere in COMPANY tag (other attrs may come before NAME)
    /<COMPANY[^>]+NAME="([^"]+)"/i,
    // NAME child inside COMPANY (may be wrapped in NAME.LIST)
    /<COMPANY[^>]*>(?:(?!<\/COMPANY>)[\s\S]){0,400}<NAME[^>]*>([^<]{2,})<\/NAME>/i,
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m?.[1] && m[1].trim().length >= 2) return m[1].trim();
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

// ── Derive Indian FY end date from any start date ────────────────────────────
function fyEnd(startIso: string): string {
  const [y, m] = startIso.split("-").map(Number);
  // Indian FY: Apr–Mar. If start month >= 4, FY ends 31-Mar of (year+1)
  const endYear = m >= 4 ? y + 1 : y;
  return `${endYear}-03-31`;
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
  const [pushResults, setPushResults] = useState<{ id: string; entry_no: string; date: string; narration: string; ok: boolean; error: string; xml?: string; tallyResponse?: string }[]>([]);
  const [creatingLedgers, setCreatingLedgers] = useState(false);
  const [createLedgerResult, setCreateLedgerResult] = useState<string | null>(null);
  const [allLedgerNames, setAllLedgerNames] = useState<{ name: string; type: string }[]>([]);

  // Connector state
  const [tallyPort, setTallyPort] = useState("7001");
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connMsg, setConnMsg] = useState("");
  const [companyName, setCompanyName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("fw_tally_company") ?? "";
    // Reject obviously wrong values (single short words like "abc" that came from ledger name parsing bug)
    return stored.length >= 2 ? stored : "";
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
        setTo(fyEnd(cur.start_date));
      }
      const { count, data: jData } = await supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type,total_debit,total_credit", { count: "exact" }).eq("business_id", saved).eq("status", "posted").order("date");
      setJournalCount(count ?? 0);
      if (jData?.length) { setJournals(jData); setPreviewOpen(true); }

      // Auto-reconnect if Tally was previously connected
      const storedCompany = localStorage.getItem("fw_tally_company") ?? "";
      const storedPort = localStorage.getItem("fw_tally_port") ?? "7001";
      if (storedCompany.length > 4) {
        setTallyPort(storedPort);
        // Silently test connection in background
        try {
          const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,CompanyName,StartingFrom,EndingAt</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
          const res = await fetch(`http://localhost:${storedPort}`, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            setConnStatus("connected");
            setConnMsg(`Connected — ${storedCompany}`);
          }
        } catch { /* bridge not running — stay idle, user will click Connect */ }
      }
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
    setCreatingLedgers(true); setCreateLedgerResult(null);

    const failingIds = pushResults.filter(r => !r.ok).map(r => r.id);

    // Use ledger names returned by the server API (service role, bypasses RLS) — stored during last push
    // Also collect any names explicitly mentioned in error messages
    const fromErrors = pushResults
      .filter(r => !r.ok)
      .map(r => { const m = r.error.match(/Ledger '([^']+)' does not exist/i); return m?.[1] ?? null; })
      .filter(Boolean) as string[];

    const nameTypeMap = new Map(allLedgerNames.map(a => [a.name, a.type]));
    for (const n of fromErrors) if (!nameTypeMap.has(n)) nameTypeMap.set(n, "expense");

    const allNames = Array.from(nameTypeMap.keys());
    if (!allNames.length) {
      // No ledger names yet — call push API to fetch them
      const apiRes = await fetch("/api/finance/tally-push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journal_ids: failingIds, business_id: bizId, company_name: companyName }) });
      const apiData = await apiRes.json();
      if (apiData.all_ledger_names) { for (const a of apiData.all_ledger_names) nameTypeMap.set(a.name, a.type); }
    }

    const finalNames = Array.from(nameTypeMap.keys());
    if (!finalNames.length) { setCreateLedgerResult("No ledger names found — click Push Vouchers first."); setCreatingLedgers(false); return; }

    let ledgerXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${companyName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName.replace(/&/g,"&amp;")}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC>
      <REQUESTDATA>`;
    for (const name of finalNames) {
      const accType = nameTypeMap.get(name) ?? "expense";
      const parent = ledgerGroupForType(accType);
      const safeName = name.replace(/&/g,"&amp;").replace(/</g,"&lt;");
      ledgerXml += `
        <TALLYMESSAGE>
          <LEDGER NAME="${safeName}" ACTION="Create">
            <NAME>${safeName}</NAME>
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
        ? `✓ Created/verified ${finalNames.length} ledger(s) in Tally. Now click Push Vouchers again.`
        : `⚠ Some ledgers may already exist (that's OK). Click Push Vouchers to retry.`);
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
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,CompanyName,StartingFrom,EndingAt</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
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
        localStorage.setItem("fw_tally_port", tallyPort);

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

        // Set FROM from Tally's start date; derive TO as the Indian FY end (31 Mar) from that start
        if (startMatch) { const iso = tallyDateToISO(startMatch[1]); if (iso) { setFrom(iso); setTo(fyEnd(iso)); } }
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
      if (apiData.all_ledger_names) setAllLedgerNames(apiData.all_ledger_names);

      // Step 1.5: Auto-create all ledgers used by these journals in Tally before pushing
      if (apiData.all_ledger_names?.length) {
        const ledgerXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${companyName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName.replace(/&/g,"&amp;")}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC>
    <REQUESTDATA>
      ${(apiData.all_ledger_names as { name: string; type: string }[]).map(a => {
        const safeName = a.name.replace(/&/g,"&amp;").replace(/</g,"&lt;");
        return `<TALLYMESSAGE><LEDGER NAME="${safeName}" ACTION="Create"><NAME>${safeName}</NAME><PARENT>${ledgerGroupForType(a.type)}</PARENT></LEDGER></TALLYMESSAGE>`;
      }).join("")}
    </REQUESTDATA>
  </IMPORTDATA></BODY>
</ENVELOPE>`;
        try {
          await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: ledgerXml, signal: AbortSignal.timeout(15000) });
        } catch { /* ledger pre-create failed — continue anyway, push will surface real errors */ }
      }

      // Step 2: Push each voucher individually to local Tally bridge, track per-entry results
      const results: typeof pushResults = [];
      for (const v of apiData.vouchers as { id: string; entry_no: string; date: string; narration: string; xml: string }[]) {
        try {
          const tallyRes = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: v.xml, signal: AbortSignal.timeout(15000) });
          const text = await tallyRes.text();
          const hasError = /LINEERROR/i.test(text);
          const errMatch = text.match(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i);
          const rawErr = errMatch?.[1]?.trim() ?? "";
          let decodedErr = rawErr.replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
          // "Voucher date is missing" is Tally's misleading error for missing ledgers — show actual ledger names instead
          if (hasError && decodedErr.toLowerCase().includes("voucher date is missing")) {
            const ledgerNames = [...v.xml.matchAll(/<LEDGERNAME>([^<]+)<\/LEDGERNAME>/g)].map(m => m[1]);
            if (ledgerNames.length) decodedErr = `Missing ledgers in Tally: ${ledgerNames.join(", ")} — click ⚡ Create Missing Ledgers`;
          }
          results.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: !hasError, error: decodedErr, xml: v.xml, tallyResponse: text.slice(0, 2000) });
        } catch (e) {
          results.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: false, error: e instanceof Error ? e.message : "Network error", xml: v.xml });
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

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid #1B2E4A", color: "#DEE8F5", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem", outline: "none", fontFamily: "'DM Sans',system-ui,sans-serif" };
  const statusColors: Record<ConnStatus, string> = { idle: "#4A6FA5", connecting: "#F59E0B", connected: "#10B981", error: "#EF4444" };
  const statusLabels: Record<ConnStatus, string> = { idle: "Not connected", connecting: "Connecting…", connected: "Connected", error: "Error" };
  const typeColor: Record<string, [string,string]> = {
    sales: ["#10B981","rgba(16,185,129,0.12)"], purchase: ["#3B82F6","rgba(59,130,246,0.12)"],
    expense: ["#F59E0B","rgba(245,158,11,0.12)"], payment: ["#A78BFA","rgba(167,139,250,0.12)"],
    receipt: ["#34D399","rgba(52,211,153,0.12)"], journal: ["#7A93B4","rgba(122,147,180,0.1)"],
    contra: ["#FB923C","rgba(251,146,60,0.12)"],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05091A", color: "#DEE8F5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #05091A; }
        .tb-bg { background: #05091A; background-image: radial-gradient(circle, rgba(59,130,246,0.06) 1px, transparent 1px); background-size: 28px 28px; }
        .tb-nav { background: rgba(5,9,26,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #1B2E4A; }
        .tb-step { background: #0B1428; border: 1px solid #1B2E4A; border-radius: 14px; padding: 1.1rem; transition: border-color 0.2s; }
        .tb-step-active { border-color: #1E4080; background: linear-gradient(135deg,#0C1830,#0B1428); }
        .tb-step-done { border-color: rgba(16,185,129,0.3); background: linear-gradient(135deg,#071A12,#0B1428); }
        .tb-card { background: #0B1428; border: 1px solid #1B2E4A; border-radius: 16px; padding: 1.5rem; }
        .tb-btn { border: none; border-radius: 10px; font-family: 'DM Sans',system-ui,sans-serif; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform 0.1s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .tb-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .tb-btn:active:not(:disabled) { transform: translateY(0); }
        .tb-btn:disabled { cursor: not-allowed; opacity: 0.4; }
        .tb-btn-primary { background: #2563EB; color: #fff; }
        .tb-btn-blue { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.35) !important; color: #60A5FA; }
        .tb-btn-indigo { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.35) !important; color: #818CF8; }
        .tb-btn-green { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3) !important; color: #34D399; }
        .tb-btn-gold { background: #D4A843; color: #05091A; }
        .tb-link-btn { background: none; border: none; cursor: pointer; font-family: 'DM Sans',system-ui,sans-serif; padding: 0; }
        .tb-mono { font-family: 'IBM Plex Mono',monospace; }
        .tb-table th, .tb-table td { padding: 0.55rem 0.8rem; }
        .tb-table tr:hover td { background: rgba(255,255,255,0.015); }
        .tb-input-label { display: block; font-size: 0.65rem; font-weight: 700; color: #4A6FA5; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
        .tb-result-row { transition: background 0.1s; }
        .tb-result-ok { border-left: 3px solid #10B981; }
        .tb-result-fail { border-left: 3px solid #EF4444; }
        @keyframes pulse-ring { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        .tb-pulse { animation: pulse-ring 2s ease-in-out infinite; }
        details summary { list-style: none; }
        details summary::-webkit-details-marker { display: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); }
        select option { background: #0B1428; }
      `}</style>

      <nav className="tb-nav" style={{ padding: "0 2rem", display: "flex", alignItems: "center", gap: "0.75rem", height: 56, position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/finance" style={{ color: "#60A5FA", fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" }}>FreWork Finance</Link>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1l4 4-4 4" stroke="#2A4060" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span style={{ color: "#DEE8F5", fontSize: "0.88rem", fontWeight: 600 }}>Tally Bridge</span>
      </nav>

      <div className="tb-bg" style={{ minHeight: "calc(100vh - 56px)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 2rem 4rem" }}>

          {/* ── PAGE HEADER ── */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#1E40AF,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🔗</div>
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Tally Bridge</h1>
            </div>
            <p style={{ margin: "0 0 0 52px", color: "#4A6FA5", fontSize: "0.88rem" }}>Push ledgers and vouchers directly into Tally Prime — no XML import file needed.</p>
          </div>

          {/* ── SETUP STEPS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Step 1 */}
            <div className="tb-step tb-step-active">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#2563EB", color: "#fff", fontWeight: 800, fontSize: "0.68rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#60A5FA", textTransform: "uppercase", letterSpacing: "0.1em" }}>One-time setup</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem", color: "#DEE8F5" }}>Download Bridge</div>
              <p style={{ fontSize: "0.74rem", color: "#4A6FA5", margin: "0 0 0.9rem", lineHeight: 1.6 }}>
                Browser security blocks direct Tally calls. Download and double-click the launcher.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <a href="/run-tally-bridge.bat" download="run-tally-bridge.bat" className="tb-btn tb-btn-primary" style={{ padding: "9px 0", fontSize: "0.8rem", borderRadius: 8, textDecoration: "none" }}>
                  ⬇ Download &amp; Run (.bat)
                </a>
                <a href="/tally-bridge.js" download="tally-bridge.js" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA", borderRadius: 8, padding: "7px 0", fontWeight: 600, fontSize: "0.72rem", textDecoration: "none" }}>
                  ⬇ tally-bridge.js (manual)
                </a>
              </div>
              <p style={{ fontSize: "0.67rem", color: "#2A4060", margin: "0.6rem 0 0", lineHeight: 1.5 }}>
                Keep the .bat window open while syncing. Requires <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" style={{ color: "#60A5FA" }}>Node.js</a>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="tb-step">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#1B2E4A", color: "#4A6FA5", fontWeight: 800, fontSize: "0.68rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.1em" }}>In Tally</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.6rem", color: "#DEE8F5" }}>Enable HTTP Server</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {["Open Tally Prime", "F12 → Client/Server config", "TallyPrime acts as → Both or Server", "Enable ODBC → Yes · Port → 9000", "Press Escape to save"].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                    <span style={{ background: "#111E33", color: "#4A6FA5", width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.58rem", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: "0.72rem", color: "#6E88A8", lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 */}
            <div className="tb-step tb-step-done">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(16,185,129,0.2)", color: "#10B981", fontWeight: 800, fontSize: "0.68rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(16,185,129,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Here</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem", color: "#DEE8F5" }}>Connect &amp; Sync</div>
              <p style={{ fontSize: "0.74rem", color: "#4A6FA5", margin: "0", lineHeight: 1.6 }}>
                With the bridge running and Tally open, click <strong style={{ color: "#34D399" }}>Connect to Tally</strong> below, then sync ledgers and push vouchers.
              </p>
            </div>
          </div>

          {/* ── LIVE CONNECTOR ── */}
          <div className="tb-card" style={{ marginBottom: "1.5rem" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid #111E33" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0E2040,#1B3A6B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>⚡</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#DEE8F5" }}>Live Tally Connector</div>
                <div style={{ fontSize: "0.72rem", color: "#2A4060" }}>Real-time sync over port {tallyPort}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", background: `${statusColors[connStatus]}14`, border: `1px solid ${statusColors[connStatus]}30`, borderRadius: 20, padding: "4px 12px" }}>
                <span className={connStatus === "connected" ? "tb-pulse" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: statusColors[connStatus], display: "block", flexShrink: 0 }} />
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusColors[connStatus] }}>{statusLabels[connStatus]}</span>
              </div>
            </div>

            {/* Connected company card */}
            {connStatus === "connected" && companyName && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "linear-gradient(135deg,#071A12,#091C14)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>🏢</div>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(52,211,153,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Connected Tally Company</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#34D399", marginTop: 3, letterSpacing: "-0.01em" }}>{companyName}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "0.62rem", color: "rgba(52,211,153,0.5)", fontWeight: 600 }}>● LIVE</div>
                  <div style={{ fontSize: "0.68rem", color: "#2A4060", marginTop: 2 }}>Port {tallyPort}</div>
                </div>
              </div>
            )}

            {connStatus === "connected" && !companyName && (
              <div style={{ fontSize: "0.8rem", color: "#34D399", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.25rem" }}>
                ✓ Connected to Tally — open a company in Tally to see its name here.
              </div>
            )}

            {connStatus === "error" && connMsg && (
              <div style={{ fontSize: "0.8rem", color: "#FCA5A5", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.25rem" }}>
                {connMsg}
                <div style={{ marginTop: "0.4rem", color: "#7A93B4", fontSize: "0.74rem" }}>Make sure <code className="tb-mono" style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3, fontSize: "0.7rem" }}>node tally-bridge.js</code> is running and Tally is open.</div>
              </div>
            )}

            {/* Port + connect row */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <div>
                <label className="tb-input-label">Bridge Port</label>
                <input value={tallyPort} onChange={e => setTallyPort(e.target.value)} style={{ ...inp, width: 90 }} placeholder="7001" />
              </div>
              <button onClick={testConnection} disabled={connStatus === "connecting"} className="tb-btn tb-btn-primary" style={{ padding: "9px 24px", fontSize: "0.875rem" }}>
                {connStatus === "connecting" ? "Testing…" : connStatus === "connected" ? "Re-test" : "Connect to Tally"}
              </button>
            </div>

            {rawDebug && (
              <details style={{ marginBottom: "1.25rem" }}>
                <summary style={{ fontSize: "0.72rem", color: "#2A4060", cursor: "pointer", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.6rem" }}>▶</span> Raw Tally response
                </summary>
                <pre className="tb-mono" style={{ marginTop: "0.4rem", fontSize: "0.64rem", color: "#4A6FA5", background: "rgba(0,0,0,0.3)", padding: "0.75rem 1rem", borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 180, overflowY: "auto", border: "1px solid #111E33" }}>
                  {rawDebug}
                </pre>
              </details>
            )}

            {/* Date range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div>
                <label className="tb-input-label">From Date</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: "100%" }} />
              </div>
              <div>
                <label className="tb-input-label">To Date</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: "100%" }} />
              </div>
            </div>

            {/* Tally → FrePilot */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#2A4060", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>Tally → FrePilot</div>
              <button onClick={importLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-green" style={{ width: "100%", padding: "11px 0", fontSize: "0.86rem" }}>
                {syncing === "import" ? "Importing…" : "⬇ Import Ledgers from Tally"}
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#111E33", margin: "1.25rem 0" }} />

            {/* Journal Preview */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#2A4060", textTransform: "uppercase", letterSpacing: "0.1em" }}>FrePilot → Tally</div>
                <button onClick={loadJournalPreview} className="tb-btn" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1B2E4A", color: "#6E88A8", padding: "5px 14px", borderRadius: 7, fontSize: "0.74rem", fontWeight: 600 }}>
                  {previewOpen ? "↺ Refresh" : "👁 Preview Journals"}
                </button>
              </div>

              {previewOpen && (
                <div style={{ background: "#080D1C", border: "1px solid #111E33", borderRadius: 10, marginBottom: "1rem", overflow: "hidden" }}>
                  {previewLoading ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#2A4060", fontSize: "0.82rem" }}>Loading journals…</div>
                  ) : journals.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#2A4060", fontSize: "0.82rem" }}>No posted journals in this date range.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="tb-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid #111E33" }}>
                            {["Entry No", "Date", "Type", "Narration", "DR (₹)", "CR (₹)"].map(h => (
                              <th key={h} style={{ textAlign: "left", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {journals.map((j, i) => {
                            const [tc, tbg] = typeColor[j.type] ?? ["#7A93B4","rgba(122,147,180,0.1)"];
                            return (
                              <tr key={j.id} className="tb-result-row" style={{ borderTop: i === 0 ? "none" : "1px solid #0D1827" }}>
                                <td className="tb-mono" style={{ color: "#2A4060", whiteSpace: "nowrap", fontSize: "0.68rem" }}>{j.entry_no}</td>
                                <td style={{ whiteSpace: "nowrap", color: "#6E88A8" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                <td>
                                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: tc, background: tbg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{j.type}</span>
                                </td>
                                <td style={{ color: "#7A93B4", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                                <td className="tb-mono" style={{ textAlign: "right", color: "#10B981", whiteSpace: "nowrap" }}>₹{Number(j.total_debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                                <td className="tb-mono" style={{ textAlign: "right", color: "#60A5FA", whiteSpace: "nowrap" }}>₹{Number(j.total_credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "1px solid #1B2E4A", background: "rgba(255,255,255,0.02)" }}>
                            <td colSpan={4} style={{ fontWeight: 700, fontSize: "0.72rem", color: "#4A6FA5" }}>{journals.length} journal{journals.length !== 1 ? "s" : ""} ready to push</td>
                            <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#10B981" }}>₹{journals.reduce((s, j) => s + Number(j.total_debit), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#60A5FA" }}>₹{journals.reduce((s, j) => s + Number(j.total_credit), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Push buttons */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={syncLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-blue" style={{ flex: 1, minWidth: 180, padding: "13px 0", fontSize: "0.86rem", border: "1px solid rgba(59,130,246,0.3)" }}>
                {syncing === "ledgers" ? "Syncing…" : "📒 Push Ledgers to Tally"}
              </button>
              <button onClick={pushVouchers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-indigo" style={{ flex: 1, minWidth: 180, padding: "13px 0", fontSize: "0.86rem", border: "1px solid rgba(99,102,241,0.3)" }}>
                {syncing === "vouchers" ? "Pushing…" : `🧾 Push Vouchers (${journalCount ?? "—"})${companyName ? ` → ${companyName}` : ""}`}
              </button>
            </div>

            {syncResult && (
              <div style={{ marginTop: "1rem", fontSize: "0.83rem", fontWeight: 600, color: syncResult.ok ? "#34D399" : "#FCD34D", background: syncResult.ok ? "rgba(16,185,129,0.07)" : "rgba(252,211,77,0.07)", border: `1px solid ${syncResult.ok ? "rgba(16,185,129,0.2)" : "rgba(252,211,77,0.2)"}`, borderRadius: 10, padding: "0.75rem 1rem" }}>
                {syncResult.ok ? "✓ " : "⚠ "}{syncResult.msg}
              </div>
            )}

            {/* Push results */}
            {pushResults.length > 0 && (
              <div style={{ marginTop: "1rem", background: "#080D1C", border: "1px solid #111E33", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "0.65rem 1rem", fontSize: "0.62rem", fontWeight: 700, color: "#2A4060", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #111E33", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span>Push Results</span>
                  <span style={{ color: "#10B981" }}>✓ {pushResults.filter(r => r.ok).length} passed</span>
                  {pushResults.filter(r => !r.ok).length > 0 && <span style={{ color: "#EF4444" }}>✗ {pushResults.filter(r => !r.ok).length} failed</span>}
                </div>

                {pushResults.some(r => !r.ok) && (
                  <div style={{ padding: "0.75rem 1rem", background: "rgba(252,211,77,0.05)", borderBottom: "1px solid rgba(252,211,77,0.12)", fontSize: "0.78rem", color: "#FCD34D", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ flex: 1 }}>💡 Failed vouchers may have ledger names missing in Tally — create them first, then push again.</span>
                    <button onClick={createMissingLedgers} disabled={creatingLedgers || connStatus !== "connected"} className="tb-btn tb-btn-gold" style={{ padding: "6px 16px", fontSize: "0.74rem", borderRadius: 7 }}>
                      {creatingLedgers ? "Creating…" : "⚡ Create Missing Ledgers"}
                    </button>
                  </div>
                )}

                {createLedgerResult && (
                  <div style={{ padding: "0.65rem 1rem", background: createLedgerResult.startsWith("✓") ? "rgba(16,185,129,0.07)" : "rgba(252,211,77,0.06)", borderBottom: "1px solid #111E33", fontSize: "0.78rem", color: createLedgerResult.startsWith("✓") ? "#34D399" : "#FCD34D" }}>
                    {createLedgerResult}
                  </div>
                )}

                <table className="tb-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <tbody>
                    {pushResults.map((r, i) => (
                      <React.Fragment key={r.id}>
                        <tr className={`tb-result-row ${r.ok ? "tb-result-ok" : "tb-result-fail"}`} style={{ borderTop: i === 0 ? "none" : "1px solid #0D1827" }}>
                          <td style={{ width: 36, textAlign: "center" }}>
                            <span style={{ width: 20, height: 20, borderRadius: "50%", background: r.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>
                              {r.ok ? "✓" : "✗"}
                            </span>
                          </td>
                          <td className="tb-mono" style={{ color: "#2A4060", fontSize: "0.67rem", whiteSpace: "nowrap" }}>{r.entry_no}</td>
                          <td style={{ color: "#4A6FA5", whiteSpace: "nowrap", fontSize: "0.72rem" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                          <td style={{ color: r.ok ? "#6E88A8" : "#FCD34D", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.74rem" }}>
                            {r.ok ? r.narration : (r.error || "Tally rejected — check ledger names")}
                          </td>
                          {!r.ok && (
                            <td style={{ whiteSpace: "nowrap" }}>
                              <a href={`/finance/journals/${r.id}/edit`} style={{ fontSize: "0.7rem", color: "#60A5FA", marginRight: 10, textDecoration: "none", fontWeight: 600 }}>✏ Edit</a>
                              <button className="tb-link-btn" onClick={async () => {
                                if (!confirm(`Delete journal ${r.entry_no}? This cannot be undone.`)) return;
                                await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", r.id);
                                await supabase.from("fw_fin_journals").delete().eq("id", r.id);
                                setPushResults(prev => prev.filter(x => x.id !== r.id));
                                setJournals(prev => prev.filter(x => x.id !== r.id));
                                setJournalCount(prev => (prev ?? 1) - 1);
                              }} style={{ fontSize: "0.7rem", color: "#EF4444", fontWeight: 600 }}>🗑 Delete</button>
                            </td>
                          )}
                          {r.ok && <td />}
                        </tr>
                        {!r.ok && (r.xml || r.tallyResponse) && (
                          <tr style={{ borderTop: "none" }}>
                            <td colSpan={5} style={{ padding: "0 1rem 0.6rem 2.5rem" }}>
                              <details style={{ fontSize: "0.64rem" }}>
                                <summary style={{ color: "#2A4060", cursor: "pointer", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                  <span style={{ fontSize: "0.55rem" }}>▶</span> Debug: XML sent / Tally response
                                </summary>
                                {r.xml && <><div style={{ color: "#2A4060", marginBottom: "0.2rem", marginTop: "0.4rem", fontWeight: 600 }}>XML sent:</div><pre className="tb-mono" style={{ background: "rgba(0,0,0,0.4)", padding: "0.6rem 0.75rem", borderRadius: 7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#93C5FD", maxHeight: 160, overflowY: "auto", border: "1px solid #111E33", fontSize: "0.62rem" }}>{r.xml}</pre></>}
                                {r.tallyResponse && <><div style={{ color: "#2A4060", marginBottom: "0.2rem", marginTop: "0.5rem", fontWeight: 600 }}>Tally response:</div><pre className="tb-mono" style={{ background: "rgba(0,0,0,0.4)", padding: "0.6rem 0.75rem", borderRadius: 7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#FCA5A5", maxHeight: 160, overflowY: "auto", border: "1px solid #111E33", fontSize: "0.62rem" }}>{r.tallyResponse}</pre></>}
                              </details>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── TIPS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { icon: "📒", color: "#3B82F6", title: "Sync Ledgers First", desc: "Always push Chart of Accounts before vouchers — Tally needs ledgers to exist first." },
              { icon: "🏢", color: "#10B981", title: "Active Company", desc: "Vouchers go into whichever company is open in Tally. Switch company in Tally if needed." },
              { icon: "🔁", color: "#F59E0B", title: "No Deduplication", desc: "Tally does not deduplicate on import. Push once per date range to avoid double entries." },
              { icon: "💻", color: "#A78BFA", title: "Same PC Only", desc: "This browser must be on the same PC as Tally. Won't work from mobile or another device." },
            ].map(t => (
              <div key={t.title} style={{ background: "#0B1428", border: "1px solid #111E33", borderRadius: 12, padding: "1rem 1.1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${t.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem", color: "#DEE8F5" }}>{t.title}</div>
                  <div style={{ fontSize: "0.72rem", color: "#3A5070", lineHeight: 1.6 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── XML EXPORT FALLBACK ── */}
          <div style={{ background: "#0B1428", border: "1px solid #111E33", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.88rem", color: "#DEE8F5" }}>⬇ Manual XML Export</div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.76rem", color: "#3A5070" }}>Fallback: download XML and import via Gateway of Tally → Import → Vouchers.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="tb-input-label">Financial Year</label>
                <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)} style={{ ...inp, width: "100%", cursor: "pointer" }}>
                  {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {bizId && (
                  <a href={buildExportUrl()} download style={{ display: "block", width: "100%", textAlign: "center", background: "rgba(255,255,255,0.05)", color: "#6E88A8", padding: "9px 0", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.85rem", border: "1px solid #1B2E4A" }}>
                    Download Tally XML
                  </a>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
