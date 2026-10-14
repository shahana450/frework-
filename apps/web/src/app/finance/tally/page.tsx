"use client";
import { cur, activeMoney } from "@/lib/money";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { findTallyPort } from "@/lib/tallyUtils";
import { tallyProblem } from "@/lib/integrations/tally";
import { connectTally, chooseTallyCompany, disconnectTally, useTally , tallyCompanyNow } from "@/lib/tallyConnection";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readTallyLedgerGroups, importTallyVouchers, summaryText } from "@/lib/integrations/tallyClient";
import { downloadApiFile } from "@/lib/apiAuthClient";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

// ── Chrome extension bridge ──────────────────────────────────────────────────
// Lets HTTPS pages reach Tally's HTTP server via the FreWork Tally Bridge extension.

let _bridgeReady = false;
if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.data?.type === "TALLY_BRIDGE_READY") _bridgeReady = true;
  });
}

function tryExtensionBridge(url: string, body: string, timeoutMs: number): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return; settled = true;
      window.removeEventListener("message", handler);
      const port = url.match(/:(\d+)/)?.[1] ?? "7001";
      reject(new Error(
        _bridgeReady
          ? `Tally did not answer through the Chrome extension. ${tallyProblem(port, "unreachable")}`
          : tallyProblem(port, "unreachable")
      ));
    }, Math.min(timeoutMs, 8000));
    function handler(e: MessageEvent) {
      if (e.data?.type !== "TALLY_BRIDGE_RESPONSE" || e.data.id !== id) return;
      if (settled) return; settled = true;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.ok) resolve(new Response(e.data.text, { status: e.data.status ?? 200 }));
      else reject(new Error(`${e.data.error ?? "Bridge error"} — ${tallyProblem(url.match(/:(\d+)/)?.[1], "unreachable")}`));
    }
    window.addEventListener("message", handler);
    window.postMessage({ type: "TALLY_BRIDGE_REQUEST", id, url, method: "POST", body, timeout: timeoutMs }, "*");
  });
}

function tallyFetch(url: string, body: string, timeoutMs = 15000): Promise<Response> {
  const opts = { method: "POST", headers: { "Content-Type": "text/xml" }, body, signal: AbortSignal.timeout(timeoutMs) };
  return fetch(url, opts)
    .catch(() => {
      const port = url.match(/:(\d+)/)?.[1] ?? "7001";
      return fetch("http://localhost:7002", { method: "POST", headers: { "Content-Type": "text/xml", "X-Tally-Port": port }, body, signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)) });
    })
    .catch(() => tryExtensionBridge(url, body, timeoutMs));
}

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

function buildLedgerXML(accounts: { name: string; type: string; group?: string }[]) {
  const entries = accounts.map(a => `
  <TALLYMESSAGE xmlns:UDF="TallyUDF">
   <LEDGER NAME="${a.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}" ACTION="Create">
    <NAME>${a.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</NAME>
    <PARENT>${(a.group ?? ledgerGroupForType(a.type)).replace(/&/g,"&amp;")}</PARENT>
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

const TALLY_CURCOMP_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>FP_CurInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="FP_CurInfo"><FORMS>FP_CIF</FORMS></REPORT><FORM NAME="FP_CIF"><PARTS>FP_CIP</PARTS></FORM><PART NAME="FP_CIP"><LINES>FP_CIL</LINES></PART><LINE NAME="FP_CIL"><FIELDS>FP_CIComp,FP_CIStart</FIELDS></LINE><FIELD NAME="FP_CIComp"><SET>##SVCurrentCompany</SET><XMLTAG>CURRENTCOMPANY</XMLTAG></FIELD><FIELD NAME="FP_CIStart"><SET>##SVFromDate</SET><XMLTAG>CURRENTCOMPANYSTART</XMLTAG></FIELD></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

function extractCompanyName(xml: string): string {
  // Primary: $$CurrentCompany system function output
  const patterns = [
    /<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i,
    /<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i,
    /<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/i,
    /<BASICCOMPANYNAME[^>]*>([^<]+)<\/BASICCOMPANYNAME>/i,
    /<COMPANY[^>]+NAME="([^"]+)"/i,
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

function tallyParentToType(parent: string): "asset" | "liability" | "equity" | "income" | "expense" {
  const p = parent.toLowerCase();
  if (p.includes("bank") || p.includes("cash") || p.includes("fixed asset") || p.includes("plant") ||
      p.includes("machinery") || p.includes("computer") || p.includes("laptop") || p.includes("furniture") ||
      p.includes("sundry debt") || p.includes("receivable") || p.includes("debtor") ||
      p.includes("current asset") || p.includes("loan") || p.includes("deposit") || p.includes("investment")) return "asset";
  if (p.includes("capital") || p.includes("reserve") || p.includes("equity") || p.includes("proprietor") ||
      p.includes("retained")) return "equity";
  if (p.includes("sales") || p.includes("income") || p.includes("revenue") || p.includes("interest income")) return "income";
  if (p.includes("current liab") || p.includes("sundry cred") || p.includes("payable") ||
      p.includes("creditor") || p.includes("borrowing") || p.includes("overdraft")) return "liability";
  return "expense";
}

// ── Derive Indian FY end date from any start date ────────────────────────────
function fyEnd(startIso: string): string {
  const [y, m] = startIso.split("-").map(Number);
  const endYear = m >= 4 ? y + 1 : y;
  return `${endYear}-03-31`;
}

// ── Parse vouchers FROM Tally XML ─────────────────────────────────────────────
type TallyVoucher = {
  date: string; // YYYY-MM-DD
  voucherType: string;
  voucherNumber: string;
  narration: string;
  lines: { ledgerName: string; amount: number; isDeemed: boolean }[];
};

function parseTallyVouchers(xml: string): TallyVoucher[] {
  const results: TallyVoucher[] = [];
  const vRe = /<VOUCHER[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let vm;
  while ((vm = vRe.exec(xml)) !== null) {
    const block = vm[1];

    const rawDate = (block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i) ?? [])[1]?.trim() ?? "";
    let date = "";
    if (/^\d{8}$/.test(rawDate)) date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;

    const voucherType = (block.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i) ?? [])[1]?.trim() ?? "Journal";
    const voucherNumber = (block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i) ?? [])[1]?.trim() ?? "";
    const narration = (block.match(/<NARRATION[^>]*>([^<]*)<\/NARRATION>/i) ?? [])[1]?.trim() ?? "";

    const lines: TallyVoucher["lines"] = [];
    const entryRe = /<ALLLEDGERENTRIES\.LIST[^>]*>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
    let em;
    while ((em = entryRe.exec(block)) !== null) {
      const eb = em[1];
      const ledgerName = (eb.match(/<LEDGERNAME[^>]*>([^<]+)<\/LEDGERNAME>/i) ?? [])[1]?.trim() ?? "";
      const amtStr = (eb.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i) ?? [])[1]?.trim() ?? "0";
      const isDeemed = /Yes/i.test((eb.match(/<ISDEEMEDPOSITIVE[^>]*>([^<]+)<\/ISDEEMEDPOSITIVE>/i) ?? [])[1] ?? "");
      const amount = Math.abs(parseFloat(amtStr) || 0);
      if (ledgerName && amount > 0) lines.push({ ledgerName, amount, isDeemed });
    }

    if (date && lines.length >= 1) results.push({ date, voucherType, voucherNumber, narration, lines });
  }
  return results;
}

function tallyVoucherTypeToFP(t: string): string {
  const exact: Record<string,string> = {
    "Sales": "sales", "Purchase": "purchase", "Payment": "payment",
    "Receipt": "receipt", "Contra": "contra", "Journal": "journal",
    "Debit Note": "debit_note", "Credit Note": "credit_note",
  };
  if (exact[t]) return exact[t];
  const lower = t.toLowerCase();
  // Custom Tally voucher types — fuzzy match by keyword
  if (lower.includes("sales") || lower.includes("export") || lower.includes("tax invoice")) return "sales";
  if (lower.includes("purchase") || lower.includes("import")) return "purchase";
  if (lower.includes("payment")) return "payment";
  if (lower.includes("receipt")) return "receipt";
  if (lower.includes("debit note") || lower.includes("debit memo")) return "debit_note";
  if (lower.includes("credit note") || lower.includes("credit memo")) return "credit_note";
  return "journal";
}

// ── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = "idle" | "connecting" | "connected" | "error";

// ── Component ────────────────────────────────────────────────────────────────

export default function TallyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string; start_date: string; end_date: string; is_current: boolean }[]>([]);
  const [from, setFrom] = useState(() => {
    const now = new Date();
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}-04-01`;
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    const y = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
    return `${y}-03-31`;
  });
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
    const stored = tallyCompanyNow() ?? "";
    return stored.length >= 2 ? stored : "";
  });
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [rawDebug, setRawDebug] = useState<string>("");
  const [syncing, setSyncing] = useState<"ledgers" | "vouchers" | "import" | "importVouchers" | "xmlUpload" | null>(null);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [importVoucherResult, setImportVoucherResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [xmlUploadResult, setXmlUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const xmlFileRef = useRef<HTMLInputElement>(null);
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  const keepAliveFailsRef = useRef(0);
  // Signals that connect succeeded — importVouchers effect watches this
  const [triggerImport, setTriggerImport] = useState(0);

  const tallyUrl = `http://localhost:${tallyPort}`;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date,is_current").eq("business_id", saved).order("start_date", { ascending: false });
      if (fys?.length) {
        setFinancialYears(fys);
        const tallyFyId = localStorage.getItem("fw_tally_fy_id") ?? "";
        const now = new Date();
        const curFyStart = now.getMonth() >= 3
          ? `${now.getFullYear()}-04-01`
          : `${now.getFullYear() - 1}-04-01`;
        const cur = (tallyFyId ? fys.find(f => f.id === tallyFyId) : undefined)
          ?? fys.find(f => f.start_date === curFyStart)
          ?? fys.find(f => f.is_current)
          ?? fys[0];
        setFyId(cur.id);
        // Always use current Indian FY dates for the date pickers, not the DB FY
        // (DB may have old FYs; user wants to import from today's FY)
        setFrom(curFyStart);
        setTo(fyEnd(curFyStart));
        // Update fw_tally_fy_id so dashboard/audit also pick up the correct FY
        localStorage.setItem("fw_tally_fy_id", cur.id);
      }
      const { count, data: jData } = await supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type,total_debit,total_credit", { count: "exact" }).eq("business_id", saved).eq("status", "posted").order("date");
      setJournalCount(count ?? 0);
      if (jData?.length) { setJournals(jData); setPreviewOpen(true); }

      // Port comes from the shared connection; nothing is imported automatically just by opening this page
      setTallyPort(localStorage.getItem("fw_tally_port") ?? "7001");
    });
  }, []);

  const shared = useTally();
  useEffect(() => {
    if (shared.status === "connected") {
      setConnStatus("connected");
      if (shared.company) setCompanyName(shared.company);
      if (shared.companies.length) setAllCompanies(shared.companies);
    } else if (shared.status === "error") { setConnStatus("error"); setConnMsg(shared.message); }
    else if (shared.status === "idle") setConnStatus(s => (s === "connecting" ? s : "idle"));
  }, [shared.status, shared.company, shared.companies, shared.message]);

  // Auto-import effect — fires when triggerImport increments AND bizId is ready
  useEffect(() => {
    if (!triggerImport || !bizId || connStatus !== "connected" || syncing) return;
    importVouchers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerImport, bizId, connStatus]);

  function disconnect() {
    disconnectTally();
    setConnStatus("idle");
    setConnMsg("Disconnected — FreWork won't talk to Tally until you press Connect.");
    keepAliveFailsRef.current = 0;
  }

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
      const res = await tallyFetch(tallyUrl, ledgerXml, 15000);
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

  // ── Import vouchers FROM Tally → FreWork ────────────────────────────────

  const importVouchers = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    setSyncing("importVouchers"); setImportVoucherResult(null); setSyncProgress(null);

    function monthsInRange(startIso: string, endIso: string): { from: string; to: string; label: string }[] {
      const months: { from: string; to: string; label: string }[] = [];
      let cur = new Date(new Date(startIso).getFullYear(), new Date(startIso).getMonth(), 1);
      const end = new Date(endIso);
      while (cur <= end) {
        const y = cur.getFullYear(), m = cur.getMonth();
        const mFrom = `${y}-${String(m + 1).padStart(2,"0")}-01`;
        const mTo = new Date(y, m + 1, 0).toISOString().slice(0,10);
        months.push({ from: mFrom, to: mTo < endIso ? mTo : endIso, label: cur.toLocaleString(activeMoney().locale, { month: "short", year: "2-digit" }) });
        cur = new Date(y, m + 1, 1);
      }
      return months;
    }

    try {
      // Default to current Indian FY if no dates set
      const now = new Date();
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const defaultFrom = `${fyStartYear}-04-01`;
      const defaultTo = `${fyStartYear + 1}-03-31`;
      const months = monthsInRange(from || defaultFrom, to || defaultTo);

      // Fetch ONE month at a time with a pause — prevents Tally from freezing
      const allVouchers: ReturnType<typeof parseTallyVouchers> = [];
      for (let i = 0; i < months.length; i++) {
        const { from: mFrom, to: mTo, label } = months[i];
        setSyncProgress(`Fetching ${label} (${i + 1}/${months.length})…`);
        const results = await (async () => {
          const { from: mFrom2, to: mTo2 } = { from: mFrom, to: mTo };
          const fd = mFrom2.replace(/-/g,""), td = mTo2.replace(/-/g,"");
          const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
          try {
            const res = await tallyFetch(tallyUrl, xml, 30000);
            return parseTallyVouchers(await res.text());
          } catch { return []; }
        })();
        allVouchers.push(...results);
        // Pause between months — lets Tally breathe, prevents UI freeze
        if (i < months.length - 1) await new Promise(r => setTimeout(r, 200));
      }

      if (!allVouchers.length) {
        setImportVoucherResult({ ok: false, msg: `No vouchers found in Tally for ${from} to ${to}. Try changing the date range — your Tally data may be for a different financial year (e.g. 01-04-2025 to 31-03-2026).` });
        setSyncing(null); return;
      }

      setSyncProgress("Reading ledger groups from Tally…");
      const groups = await readTallyLedgerGroups(tallyUrl, companyName || null);
      // Through FreWork's posting engine: validated, year-lock aware, audit-logged, never imported twice
      const sum = await importTallyVouchers(bizId, allVouchers as never, { ledgerGroups: groups, company: companyName || null, onProgress: setSyncProgress });
      const imported = sum.imported;
      setImportVoucherResult({ ok: sum.failedCount === 0, msg: summaryText(sum) });
      setAutoSyncDone(true);
      try { localStorage.setItem("fw_tally_last_import", Date.now().toString()); } catch { /* */ }
      // Auto-redirect back if came from another page
      const redirectTo = searchParams.get("redirect");
      if (imported > 0 && redirectTo) {
        setSyncProgress("Synced! Redirecting…");
        setTimeout(() => { window.location.href = redirectTo; }, 1500);
      }
    } catch (e: unknown) {
      setImportVoucherResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(null);
  }, [bizId, connStatus, tallyUrl, from, to]);

  // ── Clear all TLY imports and re-import fresh ───────────────────────────
  const clearAndReimport = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    if (!confirm("This will delete ALL existing Tally-imported entries (TLY-xxxx) and re-import fresh from Tally. Continue?")) return;
    setSyncing("importVouchers"); setImportVoucherResult(null); setSyncProgress("Clearing old Tally entries…");
    await fetch("/api/finance/tally-imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, action: "clear" }) });
    setSyncing(null); setSyncProgress(null);
    await importVouchers();
  }, [bizId, connStatus, importVouchers]);

  // ── Upload Tally XML file (no bridge needed) ─────────────────────────────
  const importFromXmlFile = useCallback(async (file: File) => {
    if (!bizId) return;
    setSyncing("xmlUpload"); setXmlUploadResult(null); setSyncProgress("Reading file…");
    try {
      const text = await file.text();
      const vouchers = parseTallyVouchers(text);
      if (!vouchers.length) {
        setXmlUploadResult({ ok: false, msg: "No vouchers found in the file. Export from Tally: Gateway → Daybook → Alt+E → XML format." });
        setSyncing(null); setSyncProgress(null); return;
      }
      setSyncProgress(`Parsed ${vouchers.length} vouchers. Importing…`);
      // Through FreWork's posting engine: validated, year-lock aware, audit-logged, never imported twice
      const sum = await importTallyVouchers(bizId, vouchers as never, { company: companyName || null, onProgress: setSyncProgress });
      setXmlUploadResult({ ok: sum.failedCount === 0, msg: summaryText(sum) });
      try { localStorage.setItem("fw_tally_last_import", Date.now().toString()); } catch { /* */ }
    } catch (e) { setXmlUploadResult({ ok: false, msg: e instanceof Error ? e.message : "Error reading file" }); }
    setSyncing(null); setSyncProgress(null);
  }, [bizId]);

  // ── Test connection ──────────────────────────────────────────────────────

  async function testConnection() {
    setConnStatus("connecting"); setConnMsg(""); setSyncResult(null); setRawDebug("");
    try {
      // Use $$CurrentCompany TDL Report — always returns the active company
      const xml = TALLY_CURCOMP_XML;
      let res = await tallyFetch(tallyUrl, xml, 5000);
      let port = tallyPort;
      if (res.status === 502) {
        // The bridge is running but Tally isn't on this port — look for it on the usual ones
        const alt = await findTallyPort(xml, tallyPort);
        if (alt) { res = alt.res; port = alt.port; setTallyPort(alt.port); }
      }
      if (res.ok) {
        const text = await res.text();
        const found = extractCompanyName(text);
        setRawDebug(text.slice(0, 800));
        setConnStatus("connected");
        setConnMsg(found ? `Connected — ${found}` : "Connected to Tally");
        localStorage.setItem("fw_tally_port", port); connectTally({ port });

        // Also fetch full company list so user can manually select the right one
        try {
          const listXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_AllCo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_AllCo" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
          const listRes = await tallyFetch(tallyUrl, listXml, 4000);
          const listText = await listRes.text();
          const names: string[] = [];
          const re = /NAME="([^"]+)"/gi; let m;
          while ((m = re.exec(listText)) !== null) { const n = m[1].trim(); if (n && n !== "FP_AllCo" && !names.includes(n)) names.push(n); }
          // Also try <NAME> child tags
          const re2 = /<NAME[^>]*>([^<]{2,})<\/NAME>/gi;
          while ((m = re2.exec(listText)) !== null) { const n = m[1].trim(); if (n && !names.includes(n)) names.push(n); }
          setAllCompanies(names);
          // Auto-select the detected one; if not detected, keep whatever is stored
          const pick = (found && found.length >= 2) ? found : (names.length === 1 ? names[0] : (tallyCompanyNow() ?? ""));
          setCompanyName(pick);
          if (pick) localStorage.setItem("fw_tally_company", pick);
        } catch {
          if (found) { setCompanyName(found); localStorage.setItem("fw_tally_company", found); }
        }

        // Parse Tally's current period dates (format: YYYYMMDD or DD-Mon-YYYY)
        const startMatch = text.match(/<CURRENTCOMPANYSTART[^>]*>([^<]+)<\/CURRENTCOMPANYSTART>/i)
          ?? text.match(/<STARTINGFROM[^>]*>([^<]+)<\/STARTINGFROM>/i)
          ?? text.match(/<STARTDATE[^>]*>([^<]+)<\/STARTDATE>/i);
        // endMatch reserved for future use
        void (text.match(/<ENDINGAT[^>]*>([^<]+)<\/ENDINGAT>/i)
          ?? text.match(/<ENDDATE[^>]*>([^<]+)<\/ENDDATE>/i));

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
        if (startMatch) {
          const iso = tallyDateToISO(startMatch[1]);
          if (iso) {
            setFrom(iso);
            const endIso = fyEnd(iso);
            setTo(endIso);

            // Try to find matching FY in FreWork; if missing, create it automatically
            let matchedFy = financialYears.find(f => f.start_date === iso);
            if (!matchedFy && bizId) {
              // Derive FY label e.g. "2026-27" from start date
              const startYear = parseInt(iso.slice(0, 4), 10);
              const fyLabel = `${startYear}-${String(startYear + 1).slice(2)}`;
              const { data: newFy } = await supabase
                .from("fw_fin_financial_years")
                .insert({ business_id: bizId, label: fyLabel, start_date: iso, end_date: endIso, is_current: false })
                .select("id,label,start_date,end_date,is_current")
                .single();
              if (newFy) {
                matchedFy = newFy;
                setFinancialYears(prev => [newFy, ...prev]);
              }
            }
            if (matchedFy) {
              try { localStorage.setItem("fw_tally_fy_id", matchedFy.id); } catch { /* */ }
              setFyId(matchedFy.id);
            }
          }
        }
        // Signal to the import effect — bizId is guaranteed set by this point
        setTriggerImport(t => t + 1);
      } else {
        setConnStatus("error"); setConnMsg(res.status === 502
          ? `${tallyProblem(tallyPort, "bridge502")} (Also tried ports 9000, 7001, 9999 and 9001.)`
          : tallyProblem(tallyPort, "http", res.status));
      }
    } catch (e: unknown) {
      setConnStatus("error");
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed") ||
          msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("signal")) {
        setConnMsg(`Tally is not responding on port ${tallyPort}. Fix: 1) Open Tally Prime  2) In Tally: F1 → Settings → Connectivity → Enable Tally HTTP Server → Port ${tallyPort} → Accept (Ctrl+A)  3) Click Connect again`);
      } else {
        setConnMsg(/port \d+/.test(msg) ? msg : `${msg} — ${tallyProblem(tallyPort, "unreachable")}`);
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
      const res = await tallyFetch(tallyUrl, xml, 15000);
      const text = await res.text();
      const errors = (text.match(/LINEERROR/gi) ?? []).length;
      setSyncResult({ ok: errors === 0, msg: errors === 0 ? `${accounts.length} ledgers pushed to Tally successfully.` : `Pushed ${accounts.length} ledgers — ${errors} already exist or had name mismatch (normal if already created).` });
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(null);
  }, [bizId, connStatus, tallyUrl, from, to]);

  // ── Import ledgers FROM Tally → FreWork Chart of Accounts ──────────────────

  const importLedgers = useCallback(async () => {
    if (!bizId || connStatus !== "connected") return;
    setSyncing("import"); setSyncResult(null);
    try {
      // Tally Prime format: Collection export using VERSION + TYPE=Collection + DESC
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Ledgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Ledgers" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res = await tallyFetch(tallyUrl, xml, 20000);
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
    const allResults: typeof pushResults = [];
    const BATCH = 50; // send 50 journals per API call — stays within Supabase + Vercel limits
    try {
      for (let bStart = 0; bStart < previewIds.length; bStart += BATCH) {
        const batchIds = previewIds.slice(bStart, bStart + BATCH);
        setSyncProgress(`Building XML ${bStart + 1}–${Math.min(bStart + BATCH, previewIds.length)} of ${previewIds.length}…`);

        const apiRes = await fetch("/api/finance/tally-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journal_ids: batchIds, business_id: bizId, company_name: companyName }),
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || !apiData.vouchers) { setSyncResult({ ok: false, msg: apiData.error ?? "Failed to build voucher XML" }); setSyncing(null); return; }
        if (apiData.all_ledger_names?.length && bStart === 0) {
          setAllLedgerNames(apiData.all_ledger_names);
          // Create all ledgers in Tally once (first batch only)
          const ledgerXml = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${companyName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName.replace(/&/g,"&amp;")}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${(apiData.all_ledger_names as { name: string; type: string; group?: string }[]).map(a => { const safeName = a.name.replace(/&/g,"&amp;").replace(/</g,"&lt;"); return `<TALLYMESSAGE><LEDGER NAME="${safeName}" ACTION="Create"><NAME>${safeName}</NAME><PARENT>${(a.group ?? ledgerGroupForType(a.type)).replace(/&/g,"&amp;")}</PARENT></LEDGER></TALLYMESSAGE>`; }).join("")}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
          try { await tallyFetch(tallyUrl, ledgerXml, 15000); } catch { /* ignore */ }
        }

        // Push each voucher one at a time to Tally
        for (const v of apiData.vouchers as { id: string; entry_no: string; date: string; narration: string; xml: string }[]) {
          setSyncProgress(`Pushing ${v.entry_no} (${allResults.length + 1}/${previewIds.length})…`);
          try {
            const tallyRes = await tallyFetch(tallyUrl, v.xml, 15000);
            const text = await tallyRes.text();
            const hasError = /LINEERROR/i.test(text);
            const errMatch = text.match(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i);
            const rawErr = errMatch?.[1]?.trim() ?? "";
            let decodedErr = rawErr.replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
            if (hasError && decodedErr.toLowerCase().includes("voucher date is missing")) {
              const ledgerNames = [...v.xml.matchAll(/<LEDGERNAME>([^<]+)<\/LEDGERNAME>/g)].map(m => m[1]);
              if (ledgerNames.length) decodedErr = `Missing ledgers: ${ledgerNames.join(", ")} — click ⚡ Create Missing Ledgers`;
            }
            allResults.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: !hasError, error: decodedErr, xml: v.xml, tallyResponse: text.slice(0, 2000) });
          } catch (e) {
            allResults.push({ id: v.id, entry_no: v.entry_no, date: v.date, narration: v.narration, ok: false, error: e instanceof Error ? e.message : "Network error", xml: v.xml });
          }
          // Small pause between vouchers — lets Tally process before next request
          await new Promise(r => setTimeout(r, 50));
        }
        setPushResults([...allResults]);
      }
      const succeeded = allResults.filter(r => r.ok).length;
      const failed = allResults.filter(r => !r.ok).length;
      setSyncResult({ ok: failed === 0, msg: failed === 0 ? `✓ All ${succeeded} vouchers pushed to Tally successfully.` : `${succeeded} pushed ✓ · ${failed} failed ✗ — see details below.` });
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error reaching Tally" });
    }
    setSyncing(null); setSyncProgress(null);
  }, [bizId, connStatus, tallyUrl, companyName, journals]);

  function buildExportUrl() {
    const params = new URLSearchParams({ business_id: bizId! });
    if (fyId) params.set("fy_id", fyId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/finance/tally-export?${params}`;
  }

  const statusColors: Record<ConnStatus, string> = { idle: "#5A6080", connecting: "#8A5A00", connected: "#0B7A55", error: "#C2321F" };
  const statusLabels: Record<ConnStatus, string> = { idle: "Not connected", connecting: "Connecting…", connected: "Connected", error: "Error" };
  const typeColor: Record<string, [string,string]> = {
    sales: ["#0B7A55","rgba(11,122,85,0.12)"], purchase: ["#0F2B25","rgba(31,94,255,0.12)"],
    expense: ["#8A5A00","rgba(184,120,0,0.12)"], payment: ["#5B4BC4","rgba(91,75,196,0.12)"],
    receipt: ["#0B7A55","rgba(11,122,85,0.12)"], journal: ["#5E6B66","rgba(122,147,180,0.1)"],
    contra: ["#B4561E","rgba(180,86,30,0.12)"],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E7", color: "#10241F", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        .tb-mono{font-family:'JetBrains Mono',monospace}
        .tb-serif{font-family:'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif}
        .tb-btn{border:none;border-radius:11px;font-family:inherit;font-weight:700;cursor:pointer;transition:transform .15s, box-shadow .15s, background .15s;display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.875rem;min-height:42px}
        .tb-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 20px -14px rgba(15,43,37,0.6)}
        .tb-btn:disabled{opacity:0.45;cursor:not-allowed}
        .tb-btn:focus-visible{outline:2px solid #C99A4E;outline-offset:2px}
        .tb-btn-primary{background:#0F2B25;color:#fff}
        .tb-btn-gold{background:#C99A4E;color:#0F2B25}
        .tb-btn-soft{background:#FFFFFF;border:1px solid #D8CDB4!important;color:#10241F}
        .tb-btn-green{background:#E3F6EE;border:1px solid rgba(11,122,85,0.3)!important;color:#0B7A55}
        .tb-btn-purple{background:#F3E8D2;border:1px solid #E0CFA8!important;color:#6E4F17}
        .tb-btn-red{background:#FDECEA;border:1px solid rgba(194,50,31,0.25)!important;color:#C2321F}
        .tb-link-btn{background:none;border:none;cursor:pointer;font-family:inherit;padding:0}
        .tb-card{background:#FFFFFF;border:1px solid #E6DFD0;border-radius:20px;padding:1.5rem}
        .tb-section-label{font-size:0.72rem;font-weight:800;color:#8A6420;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:0.75rem}
        .tb-label{font-size:0.72rem;font-weight:700;color:#5E6B66;margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.06em}
        .tb-input{background:#FFFFFF;border:1px solid #D8CDB4;color:#10241F;padding:10px 12px;border-radius:10px;font-size:0.92rem;outline:none;font-family:inherit;transition:border-color 0.15s, box-shadow .15s;min-height:42px}
        .tb-input:focus{border-color:#C99A4E;box-shadow:0 0 0 3px rgba(201,154,78,0.2)}
        .tb-row{border-top:1px solid #EFE8D9}
        .tb-row:hover td{background:#FBF8F1}
        .tb-ok{border-left:2px solid #0B7A55}
        .tb-fail{border-left:2px solid #C2321F}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .tb-live{animation:pulse 2s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.tb-live{animation:none}.tb-btn:hover:not(:disabled){transform:none}}
        details summary{list-style:none;cursor:pointer}
        details summary::-webkit-details-marker{display:none}
        select option{background:#FFFFFF;color:#10241F}
        .tb-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .tb-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        @media (max-width:760px){.tb-steps,.tb-two{grid-template-columns:minmax(0,1fr)}}
      `}</style>

      {/* Forest header with the live connection */}
      <header style={{ background: "#0F2B25", color: "#F6F1E7", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,40px)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C9D3CE" }}>
              <Link href="/finance" style={{ color: "#C9D3CE", textDecoration: "none" }}>Finance</Link><span aria-hidden="true">/</span><span style={{ color: "#D9B56F", fontWeight: 700 }}>Tally</span>
            </div>
            <h1 className="tb-serif" style={{ margin: 0, fontSize: "clamp(2rem,4.5vw,3rem)", fontWeight: 700, lineHeight: 1.05, color: "#FFFFFF" }}>Tally, <span style={{ fontStyle: "italic", fontWeight: 400, color: "#D9B56F" }}>in sync</span></h1>
            <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.6, color: "#C9D3CE" }}>One place for everything Tally — connect once, then import Tally&apos;s books for analysis or push FreWork entries into Tally. Every page in FreWork uses this connection.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(217,181,111,0.35)", borderRadius: 18, padding: "16px 18px", minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#D9B56F" }}>
              <span className={connStatus === "connected" ? "tb-live" : ""} aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: connStatus === "connected" ? "#7FE0B4" : connStatus === "error" ? "#F2867A" : connStatus === "connecting" ? "#D9B56F" : "#8FA39B" }} />
              {statusLabels[connStatus]}
            </div>
            <div className="tb-serif" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{connStatus === "connected" ? (companyName || "Tally") : "No company connected"}</div>
            <div style={{ fontSize: 13, color: "#C9D3CE" }}>Port <span className="tb-mono" style={{ color: "#FFFFFF" }}>{tallyPort}</span>{journalCount != null ? <> · {journalCount} FreWork entries</> : null}</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem clamp(16px,4vw,40px) 4rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

        {/* Two ways in */}
        <div className="tb-two">
          <div className="tb-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="tb-section-label" style={{ margin: 0 }}>Easiest · no setup</div>
            <div className="tb-serif" style={{ fontSize: "1.35rem", fontWeight: 700 }}>Upload a Tally XML file</div>
            <div style={{ color: "#5E6B66", fontSize: "0.9rem", lineHeight: 1.6 }}>In Tally: <b style={{ color: "#10241F" }}>Gateway → Display → Day Book → Alt+E → XML</b>, then upload it here. Works from any computer.</div>
            <input ref={xmlFileRef} type="file" accept=".xml" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importFromXmlFile(f); e.target.value = ""; }} />
            <button onClick={() => xmlFileRef.current?.click()} disabled={!!syncing} className="tb-btn tb-btn-gold" style={{ alignSelf: "flex-start", padding: "0 22px", marginTop: "auto" }}>
              {syncing === "xmlUpload" ? (syncProgress ?? "Importing…") : "⬆ Upload XML"}
            </button>
            {xmlUploadResult && (
              <div role="status" style={{ padding: "0.7rem 0.9rem", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600, color: xmlUploadResult.ok ? "#0B7A55" : "#8A5A00", background: xmlUploadResult.ok ? "#E3F6EE" : "#FFF4DB" }}>
                {xmlUploadResult.msg}
              </div>
            )}
          </div>
          <div className="tb-card" style={{ display: "flex", flexDirection: "column", gap: 12, background: "#FBF8F1" }}>
            <div className="tb-section-label" style={{ margin: 0 }}>Live · Tally open on this PC</div>
            <div className="tb-serif" style={{ fontSize: "1.35rem", fontWeight: 700 }}>Connect to Tally directly</div>
            <div style={{ color: "#5E6B66", fontSize: "0.9rem", lineHeight: 1.6 }}>Two-way: import ledgers and vouchers, push FreWork entries, and check what&apos;s already in Tally. Needs the small FreWork Tally Bridge.</div>
            <a href="#connect" className="tb-btn tb-btn-primary" style={{ alignSelf: "flex-start", padding: "0 22px", textDecoration: "none", marginTop: "auto" }}>Set up live connection ↓</a>
          </div>
        </div>

        {/* Live connect */}
        <div id="connect">
          <div className="tb-section-label">Live connection</div>
          <div className="tb-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* One-time setup */}
            <div className="tb-steps">
              {[
                { n: "1", t: "Turn on Tally's server", d: <>In Tally Prime: <b>F1 → Settings → Connectivity</b> → enable the HTTP server on port <b className="tb-mono">7001</b>. Once only.</> },
                { n: "2", t: "Run the Tally Bridge", d: <><a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer" style={{ color: "#8A6420", fontWeight: 700 }}>Install Node.js</a> once, extract the zip, double-click <b>run-tally-bridge.bat</b> and keep it open.</>, a: <a href="/tally-bridge-node.zip" download="FreWork-Tally-Bridge.zip" className="tb-btn tb-btn-soft" style={{ padding: "0 14px", textDecoration: "none", alignSelf: "flex-start", minHeight: 36, fontSize: "0.8rem" }}>⬇ Download bridge</a> },
                { n: "3", t: "Connect", d: <>With your company open in Tally, press <b>Connect to Tally</b> below. FreWork remembers it on every page.</> },
              ].map(s => (
                <div key={s.n} style={{ background: "#FBF8F1", border: "1px solid #EFE8D9", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span aria-hidden="true" className="tb-serif" style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F2B25", color: "#D9B56F", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{s.n}</span>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{s.t}</div>
                  <div style={{ fontSize: "0.84rem", color: "#5E6B66", lineHeight: 1.55 }}>{s.d}</div>
                  {s.a}
                </div>
              ))}
            </div>

            {/* Connection row */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", paddingTop: "0.25rem" }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                <span className="tb-label">Port</span>
                <input value={tallyPort} onChange={e => setTallyPort(e.target.value)} className="tb-input tb-mono" style={{ width: 96 }} placeholder="7001" inputMode="numeric" />
              </label>
              <button onClick={testConnection} disabled={connStatus === "connecting"} className="tb-btn tb-btn-primary" style={{ padding: "0 26px" }}>
                {connStatus === "connecting" ? "Connecting…" : connStatus === "connected" ? "↺ Reconnect" : "Connect to Tally"}
              </button>
              {connStatus === "connected" && (
                <button onClick={disconnect} className="tb-btn tb-btn-red" style={{ padding: "0 16px" }}>Disconnect</button>
              )}
              {connStatus === "connected" && allCompanies.length > 1 && (
                <label style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 220 }}>
                  <span className="tb-label">Company</span>
                  <select value={companyName} onChange={e => { setCompanyName(e.target.value); chooseTallyCompany(e.target.value); }} className="tb-input">
                    {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
              <span role="status" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: "0.86rem", fontWeight: 700, color: statusColors[connStatus], padding: "8px 12px", borderRadius: 999, background: connStatus === "connected" ? "#E3F6EE" : connStatus === "error" ? "#FDECEA" : "#EFE8D9" }}>
                <span className={connStatus === "connected" ? "tb-live" : ""} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[connStatus] }} />
                {connStatus === "connected" && companyName ? companyName : statusLabels[connStatus]}
              </span>
            </div>

            {connStatus === "error" && connMsg && (
              <div style={{ padding: "0.8rem 1rem", borderRadius: 12, fontSize: "0.86rem", color: "#C2321F", background: "#FDECEA", lineHeight: 1.6 }}>
                ⚠ {connMsg}
              </div>
            )}

            {/* Period */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                <span className="tb-label">From date</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="tb-input" />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                <span className="tb-label">To date</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="tb-input" />
              </label>
            </div>

            {/* Both directions */}
            <div className="tb-two">
              <div style={{ border: "1px solid #EFE8D9", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tb-serif" style={{ fontSize: "1.1rem", fontWeight: 700 }}>Tally → FreWork</span>
                  <span style={{ fontSize: "0.78rem", color: "#5E6B66" }}>for analysis &amp; reports</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={importLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-green" style={{ flex: 1, minWidth: 140 }}>
                    {syncing === "import" ? "Importing…" : "Import ledgers"}
                  </button>
                  <button onClick={importVouchers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-purple" style={{ flex: 1, minWidth: 140 }}>
                    {syncing === "importVouchers" ? (syncProgress ?? "Syncing…") : "Import vouchers"}
                  </button>
                </div>
                <button onClick={clearAndReimport} disabled={connStatus !== "connected" || !!syncing} className="tb-link-btn" style={{ alignSelf: "flex-start", color: "#C2321F", fontSize: "0.8rem", fontWeight: 700 }} title="Delete all TLY imports and re-import fresh">
                  Clear Tally imports &amp; re-import
                </button>
                <div style={{ fontSize: "0.76rem", color: "#5E6B66" }}>Entries FreWork pushed to Tally are skipped — they&apos;re already in your books.</div>
                {importVoucherResult && (
                  <div role="status" style={{ padding: "0.7rem 0.9rem", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600, color: importVoucherResult.ok ? "#0B7A55" : "#8A5A00", background: importVoucherResult.ok ? "#E3F6EE" : "#FFF4DB" }}>
                    {importVoucherResult.msg}
                    {importVoucherResult.ok && <a href="/finance/audit" style={{ marginLeft: 10, color: "#0F2B25", fontWeight: 800 }}>View analysis →</a>}
                  </div>
                )}
              </div>
              <div style={{ border: "1px solid #EFE8D9", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tb-serif" style={{ fontSize: "1.1rem", fontWeight: 700 }}>FreWork → Tally</span>
                  <button onClick={loadJournalPreview} className="tb-link-btn" style={{ marginLeft: "auto", color: "#8A6420", fontSize: "0.8rem", fontWeight: 700 }}>
                    {previewOpen ? "Refresh preview" : "Preview entries"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={syncLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-soft" style={{ flex: 1, minWidth: 140 }}>
                    {syncing === "ledgers" ? "Pushing…" : "Push ledgers"}
                  </button>
                  <button onClick={pushVouchers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-primary" style={{ flex: 1, minWidth: 140 }}>
                    {syncing === "vouchers" ? (syncProgress ?? "Pushing…") : `Push entries (${journalCount ?? "—"})`}
                  </button>
                </div>
                <Link href="/finance/books" style={{ fontSize: "0.8rem", color: "#0F2B25", fontWeight: 700 }}>Choose entries one by one in Books →</Link>
              </div>
            </div>

            {rawDebug && (
              <details style={{ marginTop: "0.875rem" }}>
                <summary style={{ fontSize: "0.75rem", color: "#5E6B66", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.6rem" }}>▶</span> Raw response
                </summary>
                <pre className="tb-mono" style={{ marginTop: "0.5rem", fontSize: "0.65rem", color: "#5E6B66", background: "#FFFFFF", padding: "0.75rem", borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 160, overflowY: "auto", border: "1px solid #E6DFD0" }}>
                  {rawDebug}
                </pre>
              </details>
            )}

            {syncResult && (
              <div style={{ marginTop: "1rem", padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 500, color: syncResult.ok ? "#0B7A55" : "#8A5A00", background: syncResult.ok ? "rgba(11,122,85,0.08)" : "rgba(184,120,0,0.08)", border: `1px solid ${syncResult.ok ? "rgba(11,122,85,0.2)" : "rgba(184,120,0,0.2)"}` }}>
                {syncResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* ── JOURNAL PREVIEW TABLE ── */}
        {previewOpen && (
          <div className="tb-card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
            {previewLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#5E6B66", fontSize: "0.875rem" }}>Loading…</div>
            ) : journals.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#5E6B66", fontSize: "0.875rem" }}>No posted journals in this date range.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "#FFFFFF" }}>
                      {["Entry", "Date", "Type", "Narration", "DR (" + cur() + ")", "CR (" + cur() + ")"].map(h => (
                        <th key={h} style={{ textAlign: "left", color: "#5E6B66", fontWeight: 600, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", padding: "0.625rem 0.875rem", whiteSpace: "nowrap", borderBottom: "1px solid #E6DFD0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((j, i) => {
                      const [tc, tbg] = typeColor[j.type] ?? ["#5E6B66","rgba(107,114,128,0.1)"];
                      return (
                        <tr key={j.id} className="tb-row" style={{ borderTop: i === 0 ? "none" : undefined }}>
                          <td className="tb-mono" style={{ color: "#5E6B66", whiteSpace: "nowrap", fontSize: "0.72rem", padding: "0.5rem 0.875rem" }}>{j.entry_no}</td>
                          <td style={{ whiteSpace: "nowrap", color: "#5E6B66", padding: "0.5rem 0.875rem" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                          <td style={{ padding: "0.5rem 0.875rem" }}>
                            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: tc, background: tbg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{j.type}</span>
                          </td>
                          <td style={{ color: "#5E6B66", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>{j.narration}</td>
                          <td className="tb-mono" style={{ textAlign: "right", color: "#0B7A55", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>{cur()}{Number(j.total_debit).toLocaleString(activeMoney().locale)}</td>
                          <td className="tb-mono" style={{ textAlign: "right", color: "#0F2B25", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>{cur()}{Number(j.total_credit).toLocaleString(activeMoney().locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid #E6DFD0", background: "#FFFFFF" }}>
                      <td colSpan={4} style={{ fontWeight: 600, fontSize: "0.72rem", color: "#5E6B66", padding: "0.5rem 0.875rem" }}>{journals.length} journal{journals.length !== 1 ? "s" : ""} ready to push</td>
                      <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#0B7A55", padding: "0.5rem 0.875rem" }}>{cur()}{journals.reduce((s, j) => s + Number(j.total_debit), 0).toLocaleString(activeMoney().locale)}</td>
                      <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#0F2B25", padding: "0.5rem 0.875rem" }}>{cur()}{journals.reduce((s, j) => s + Number(j.total_credit), 0).toLocaleString(activeMoney().locale)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Push results */}
        {pushResults.length > 0 && (
          <div className="tb-card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid #E6DFD0" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#5E6B66", textTransform: "uppercase", letterSpacing: "0.08em" }}>Push Results</span>
              <span style={{ fontSize: "0.75rem", color: "#0B7A55", fontWeight: 600 }}>✓ {pushResults.filter(r => r.ok).length} ok</span>
              {pushResults.filter(r => !r.ok).length > 0 && <span style={{ fontSize: "0.75rem", color: "#C2321F", fontWeight: 600 }}>✗ {pushResults.filter(r => !r.ok).length} failed</span>}
              {pushResults.some(r => !r.ok) && (
                <button onClick={createMissingLedgers} disabled={creatingLedgers || connStatus !== "connected"} className="tb-btn tb-btn-gold" style={{ marginLeft: "auto", padding: "5px 14px", fontSize: "0.75rem" }}>
                  {creatingLedgers ? "Creating…" : "Create Missing Ledgers"}
                </button>
              )}
            </div>
            {createLedgerResult && (
              <div style={{ padding: "0.5rem 1rem", fontSize: "0.78rem", color: createLedgerResult.startsWith("✓") ? "#0B7A55" : "#8A5A00", borderBottom: "1px solid #E6DFD0" }}>
                {createLedgerResult}
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <tbody>
                {pushResults.map((r, i) => (
                  <React.Fragment key={r.id}>
                    <tr className="tb-row" style={{ borderLeft: `2px solid ${r.ok ? "#0B7A55" : "#C2321F"}`, borderTop: i === 0 ? "none" : undefined }}>
                      <td style={{ width: 32, textAlign: "center", padding: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: r.ok ? "#0B7A55" : "#C2321F" }}>{r.ok ? "✓" : "✗"}</span>
                      </td>
                      <td className="tb-mono" style={{ color: "#5E6B66", fontSize: "0.72rem", whiteSpace: "nowrap", padding: "0.5rem 0" }}>{r.entry_no}</td>
                      <td style={{ color: "#5E6B66", whiteSpace: "nowrap", padding: "0.5rem 0.75rem", fontSize: "0.78rem" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      <td style={{ color: r.ok ? "#5E6B66" : "#8A5A00", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240, padding: "0.5rem 0", fontSize: "0.8rem" }}>
                        {r.ok ? r.narration : (r.error || "Tally rejected — check ledger names")}
                      </td>
                      {!r.ok && (
                        <td style={{ whiteSpace: "nowrap", padding: "0.5rem 1rem" }}>
                          <a href={`/finance/journals/${r.id}/edit`} style={{ fontSize: "0.72rem", color: "#0F2B25", marginRight: 10, textDecoration: "none", fontWeight: 600 }}>Edit</a>
                          {/* Posted entries are never deleted — they are corrected (reversal + new entry) from the edit page */}
                          <a href={`/finance/journals/${r.id}/edit`} style={{ fontSize: "0.72rem", color: "#C2321F", fontWeight: 600, textDecoration: "none" }}>Correct / reverse</a>
                        </td>
                      )}
                      {r.ok && <td />}
                    </tr>
                    {!r.ok && (r.xml || r.tallyResponse) && (
                      <tr style={{ borderTop: "none" }}>
                        <td colSpan={5} style={{ padding: "0 1rem 0.625rem 2.5rem" }}>
                          <details style={{ fontSize: "0.72rem" }}>
                            <summary style={{ color: "#5E6B66", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span>▶</span> Debug details
                            </summary>
                            {r.xml && <pre className="tb-mono" style={{ marginTop: "0.4rem", fontSize: "0.65rem", background: "#FFFFFF", padding: "0.6rem 0.75rem", borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#0F2B25", maxHeight: 140, overflowY: "auto", border: "1px solid #E6DFD0" }}>{r.xml}</pre>}
                            {r.tallyResponse && <pre className="tb-mono" style={{ marginTop: "0.4rem", fontSize: "0.65rem", background: "#FFFFFF", padding: "0.6rem 0.75rem", borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#C2321F", maxHeight: 140, overflowY: "auto", border: "1px solid #E6DFD0" }}>{r.tallyResponse}</pre>}
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

        {/* Export XML (fallback) */}
        {bizId && (
          <div className="tb-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#10241F", marginBottom: "0.2rem" }}>Export FreWork → Tally XML</div>
                <div style={{ color: "#5E6B66", fontSize: "0.8rem" }}>Download XML and import via Gateway of Tally → Import → Vouchers.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)} className="tb-input" style={{ fontSize: "0.8125rem" }}>
                  {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
                </select>
                <a href="#" onClick={e => { e.preventDefault(); downloadApiFile(buildExportUrl(), "FreWork-Tally-Export.xml").catch(err => alert(err.message)); }} className="tb-btn" style={{ background: "transparent", border: "1px solid #E6DFD0", color: "#5E6B66", padding: "8px 16px", textDecoration: "none", fontSize: "0.8125rem" }}>
                  Download XML
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
