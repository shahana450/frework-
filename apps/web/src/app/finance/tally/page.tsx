"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
      reject(new Error(
        _bridgeReady
          ? "Tally did not respond via Chrome extension."
          : "Cannot reach Tally. Run the FreWork Tally Bridge app, or install the Chrome Extension from the download link below."
      ));
    }, Math.min(timeoutMs, 8000));
    function handler(e: MessageEvent) {
      if (e.data?.type !== "TALLY_BRIDGE_RESPONSE" || e.data.id !== id) return;
      if (settled) return; settled = true;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.ok) resolve(new Response(e.data.text, { status: e.data.status ?? 200 }));
      else reject(new Error(e.data.error ?? "Bridge error"));
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
    const stored = localStorage.getItem("fw_tally_company") ?? "";
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
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
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

      // Auto-reconnect if Tally was previously connected
      const storedCompany = localStorage.getItem("fw_tally_company") ?? "";
      const storedPort = localStorage.getItem("fw_tally_port") ?? "7001";
      if (storedCompany.length > 4) {
        setTallyPort(storedPort);
        // Silently test connection in background
        try {
          const res = await tallyFetch(`http://localhost:${storedPort}`, TALLY_CURCOMP_XML, 3000);
          if (res.ok) {
            const txt = await res.text();
            const found = extractCompanyName(txt);
            if (found) { localStorage.setItem("fw_tally_company", found); setCompanyName(found); }
            setConnStatus("connected");
            setConnMsg(`Connected — ${found || storedCompany}`);
            // Signal to the import effect — runs once bizId is ready
            setTriggerImport(t => t + 1);
          }
        } catch { /* bridge not running — stay idle, user will click Connect */ }
      }
    });
  }, []);

  // Keep-alive ping every 60s — pause during import to avoid freezing Tally
  useEffect(() => {
    if (connStatus !== "connected") return;
    keepAliveFailsRef.current = 0;
    const id = setInterval(async () => {
      if (syncing === "importVouchers") return; // don't ping while importing
      try {
        const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Ping</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Ping" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
        const res = await tallyFetch(tallyUrl, xml, 4000);
        if (res.ok) {
          keepAliveFailsRef.current = 0;
        } else {
          keepAliveFailsRef.current += 1;
        }
      } catch {
        keepAliveFailsRef.current += 1;
      }
      if (keepAliveFailsRef.current >= 3) {
        setConnStatus("error");
        setConnMsg("Tally stopped responding. Make sure Tally Prime is still open, then click Connect again.");
      }
    }, 60000);
    return () => clearInterval(id);
  }, [connStatus, tallyUrl, syncing]);

  // Auto-import effect — fires when triggerImport increments AND bizId is ready
  useEffect(() => {
    if (!triggerImport || !bizId || connStatus !== "connected" || syncing) return;
    importVouchers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerImport, bizId, connStatus]);

  function disconnect() {
    setConnStatus("idle");
    setConnMsg("");
    setCompanyName("");
    keepAliveFailsRef.current = 0;
    try { localStorage.removeItem("fw_tally_company"); localStorage.removeItem("fw_tally_fy_id"); } catch { /* */ }
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

  // ── Import vouchers FROM Tally → FrePilot ────────────────────────────────

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
        months.push({ from: mFrom, to: mTo < endIso ? mTo : endIso, label: cur.toLocaleString("en-IN", { month: "short", year: "2-digit" }) });
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
        if (i < months.length - 1) await new Promise(r => setTimeout(r, 1500));
      }

      if (!allVouchers.length) {
        setImportVoucherResult({ ok: false, msg: `No vouchers found in Tally for ${from} to ${to}. Try changing the date range — your Tally data may be for a different financial year (e.g. 01-04-2025 to 31-03-2026).` });
        setSyncing(null); return;
      }

      // Load existing accounts + create missing ones
      setSyncProgress("Preparing accounts…");
      const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", bizId);
      const accountMap = new Map((accounts ?? []).map(a => [a.name.toLowerCase(), a]));
      const missingNames = new Set<string>();
      for (const v of allVouchers) for (const l of v.lines) {
        if (!accountMap.has(l.ledgerName.toLowerCase())) missingNames.add(l.ledgerName);
      }
      if (missingNames.size > 0) {
        const newAccounts = Array.from(missingNames).map((name, idx) => ({
          business_id: bizId, code: `TI${String((accounts?.length ?? 0) + idx + 1).padStart(3,"0")}`,
          name, type: tallyParentToType(name), description: "Imported from Tally", is_system: false, is_group: false,
          sort_order: (accounts?.length ?? 0) + idx + 1,
        }));
        const { data: created } = await supabase.from("fw_fin_chart_of_accounts").insert(newAccounts).select("id,name,type");
        for (const a of (created ?? [])) accountMap.set(a.name.toLowerCase(), a);
      }

      // Get FY + existing entry_nos
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,start_date").eq("business_id", bizId).order("start_date", { ascending: false });
      // Find the FY that matches the import date range
      const importFrom = from || `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`;
      const importFromYear = parseInt(importFrom.slice(0, 4));
      const fyTag = `FY${String(importFromYear).slice(2)}`; // e.g. "FY25" for 2025-26
      const matchingFy = fys?.find(f => f.start_date?.startsWith(String(importFromYear)));
      const fyIdToUse = matchingFy?.id ?? fys?.[0]?.id ?? null;
      // Only check for duplicates within the same FY tag to avoid cross-year collisions
      const fyPrefix = `TLY-${fyTag}-`;
      const { data: existingTly } = await supabase.from("fw_fin_journals").select("entry_no").eq("business_id", bizId).like("entry_no", `${fyPrefix}%`);
      const existingEntryNos = new Set<string>((existingTly ?? []).map(j => j.entry_no));
      let entrySeq = existingTly?.length
        ? Math.max(0, ...existingTly.map(j => parseInt(j.entry_no.replace(/\D/g,"") || "0", 10))) + 1 : 1;

      // Build all new journal rows (deduped) in memory
      type JRow = { business_id: string; financial_year_id: string|null; entry_no: string; date: string; narration: string; type: string; status: string; total_debit: number; total_credit: number; reference_no: string|null };
      type LRow = { account_id: string; narration: string; dr_amount: number; cr_amount: number };
      const journalRows: JRow[] = [];
      const pendingLines: LRow[][] = []; // lines[i] corresponds to journalRows[i]
      let skipped = 0;

      for (const v of allVouchers) {
        const vNum = v.voucherNumber?.trim();
        const tallyLabel = vNum ? `${v.voucherType} ${vNum}` : `${v.voucherType}-${entrySeq}`;
        const entryNo = `${fyPrefix}${tallyLabel}`;
        if (existingEntryNos.has(entryNo)) { skipped++; continue; }

        const lines: LRow[] = v.lines.flatMap(l => {
          const acc = accountMap.get(l.ledgerName.toLowerCase());
          if (!acc) return [];
          return [{ account_id: acc.id, narration: l.ledgerName, dr_amount: l.isDeemed ? l.amount : 0, cr_amount: l.isDeemed ? 0 : l.amount }];
        });
        if (!lines.length) { skipped++; continue; }

        const totalDr = v.lines.filter(l => l.isDeemed).reduce((s, l) => s + l.amount, 0);
        const totalCr = v.lines.filter(l => !l.isDeemed).reduce((s, l) => s + l.amount, 0);
        journalRows.push({ business_id: bizId, financial_year_id: fyIdToUse, entry_no: entryNo, date: v.date, narration: v.narration || tallyLabel, type: tallyVoucherTypeToFP(v.voucherType), status: "posted", total_debit: totalDr || totalCr, total_credit: totalCr || totalDr, reference_no: vNum || null });
        pendingLines.push(lines);
        existingEntryNos.add(entryNo);
        if (!vNum) entrySeq++;
      }

      // Batch insert journals (50 at a time) → get IDs back
      setSyncProgress(`Saving ${journalRows.length} vouchers to database…`);
      let imported = 0;
      const BATCH = 50;
      for (let i = 0; i < journalRows.length; i += BATCH) {
        const slice = journalRows.slice(i, i + BATCH);
        const { data: inserted } = await supabase.from("fw_fin_journals").insert(slice).select("id");
        if (!inserted?.length) continue;
        // Build all lines for this batch
        const allLines: (LRow & { journal_id: string })[] = [];
        for (let j = 0; j < inserted.length; j++) {
          const jId = inserted[j].id;
          for (const l of pendingLines[i + j]) allLines.push({ ...l, journal_id: jId });
        }
        // Bulk insert lines (up to 200 at a time)
        for (let li = 0; li < allLines.length; li += 200) {
          await supabase.from("fw_fin_journal_lines").insert(allLines.slice(li, li + 200));
        }
        imported += inserted.length;
        setSyncProgress(`Saved ${imported}/${journalRows.length} vouchers…`);
      }

      setImportVoucherResult({ ok: imported > 0, msg: `Imported ${imported} voucher${imported !== 1 ? "s" : ""} from Tally${skipped > 0 ? ` (${skipped} skipped)` : ""}.` });
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
    const { data: oldJournals } = await supabase.from("fw_fin_journals").select("id").eq("business_id", bizId).like("entry_no", "TLY-%");
    if (oldJournals?.length) {
      const ids = oldJournals.map(j => j.id);
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from("fw_fin_journal_lines").delete().in("journal_id", ids.slice(i, i + 100));
        await supabase.from("fw_fin_journals").delete().in("id", ids.slice(i, i + 100));
      }
    }
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
      setSyncProgress(`Parsed ${vouchers.length} vouchers. Loading accounts…`);
      const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", bizId);
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,start_date,end_date").eq("business_id", bizId).order("start_date", { ascending: false });
      // Derive FY tag from the first voucher's date (for entry_no uniqueness across years)
      const firstDate = vouchers[0]?.date ?? new Date().toISOString().slice(0,10);
      const xmlFyYear = parseInt(firstDate.slice(0, 4));
      const xmlFyTag = `FY${String(new Date(firstDate).getMonth() >= 3 ? xmlFyYear : xmlFyYear - 1).slice(2)}`;
      const xmlFyPrefix = `TLY-${xmlFyTag}-`;
      const { data: existingJ } = await supabase.from("fw_fin_journals").select("entry_no").eq("business_id", bizId).like("entry_no", `${xmlFyPrefix}%`);
      const existingNos = new Set((existingJ ?? []).map(j => j.entry_no));
      const accountMap = new Map((accounts ?? []).map(a => [a.name.toLowerCase().trim(), { id: a.id, type: a.type as string }]));

      // Auto-create missing accounts
      const missing = new Set<string>();
      for (const v of vouchers) for (const l of v.lines) if (!accountMap.has(l.ledgerName.toLowerCase().trim())) missing.add(l.ledgerName);
      if (missing.size > 0) {
        const newAccs = Array.from(missing).map((name, i) => ({ business_id: bizId, code: `TU${String((accounts?.length??0)+i+1).padStart(3,"0")}`, name, type: tallyParentToType(name), description: "From Tally XML", is_system: false, is_group: false, sort_order: (accounts?.length??0)+i+1 }));
        const { data: created } = await supabase.from("fw_fin_chart_of_accounts").insert(newAccs).select("id,name,type");
        for (const a of created ?? []) accountMap.set(a.name.toLowerCase().trim(), { id: a.id, type: a.type as string });
      }

      let imported = 0, skipped = 0, seq = 1;
      for (const v of vouchers) {
        const vNum = v.voucherNumber?.trim();
        const entryNo = `${xmlFyPrefix}${v.voucherType} ${vNum || seq}`;
        if (existingNos.has(entryNo)) { skipped++; continue; }
        const fpType = tallyVoucherTypeToFP(v.voucherType);
        const activeFy = fys?.find(f => v.date >= f.start_date && v.date <= f.end_date) ?? fys?.[0];
        const totalDr = v.lines.filter(l => l.isDeemed).reduce((s,l) => s+l.amount, 0);
        const totalCr = v.lines.filter(l => !l.isDeemed).reduce((s,l) => s+l.amount, 0);
        const { data: jRow, error: jErr } = await supabase.from("fw_fin_journals").insert({
          business_id: bizId, financial_year_id: activeFy?.id ?? null,
          entry_no: entryNo, date: v.date, narration: v.narration || entryNo,
          type: fpType, status: "posted", total_debit: totalDr||totalCr, total_credit: totalCr||totalDr,
          reference_no: vNum || null,
        }).select("id").single();
        if (jErr || !jRow) { skipped++; continue; }
        const lines = v.lines.map(l => { const acc = accountMap.get(l.ledgerName.toLowerCase().trim()); if (!acc) return null; return { journal_id: jRow.id, account_id: acc.id, narration: l.ledgerName, dr_amount: l.isDeemed ? l.amount : 0, cr_amount: l.isDeemed ? 0 : l.amount }; }).filter(Boolean);
        if (lines.length > 0) { await supabase.from("fw_fin_journal_lines").insert(lines as never[]); imported++; existingNos.add(entryNo); if (!vNum) seq++; }
        else { await supabase.from("fw_fin_journals").delete().eq("id", jRow.id); skipped++; }
        if (imported % 20 === 0) setSyncProgress(`Imported ${imported}/${vouchers.length}…`);
      }
      setXmlUploadResult({ ok: true, msg: `✓ Imported ${imported} voucher${imported!==1?"s":""}${skipped>0?` · ${skipped} skipped (already existed)`:""}` });
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
      const res = await tallyFetch(tallyUrl, xml, 5000);
      if (res.ok) {
        const text = await res.text();
        const found = extractCompanyName(text);
        setRawDebug(text.slice(0, 800));
        setConnStatus("connected");
        setConnMsg(found ? `Connected — ${found}` : "Connected to Tally");
        localStorage.setItem("fw_tally_port", tallyPort);

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
          const pick = (found && found.length >= 2) ? found : (names.length === 1 ? names[0] : (localStorage.getItem("fw_tally_company") ?? ""));
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

            // Try to find matching FY in FrePilot; if missing, create it automatically
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
        setConnStatus("error"); setConnMsg(`Tally responded with HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setConnStatus("error");
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed") ||
          msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("signal")) {
        setConnMsg(`Tally is not responding on port ${tallyPort}. Fix: 1) Open Tally Prime  2) In Tally: F1 → Settings → Connectivity → Enable Tally HTTP Server → Port ${tallyPort} → Accept (Ctrl+A)  3) Click Connect again`);
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
      const res = await tallyFetch(tallyUrl, xml, 15000);
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
          const ledgerXml = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${companyName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName.replace(/&/g,"&amp;")}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${(apiData.all_ledger_names as { name: string; type: string }[]).map(a => { const safeName = a.name.replace(/&/g,"&amp;").replace(/</g,"&lt;"); return `<TALLYMESSAGE><LEDGER NAME="${safeName}" ACTION="Create"><NAME>${safeName}</NAME><PARENT>${ledgerGroupForType(a.type)}</PARENT></LEDGER></TALLYMESSAGE>`; }).join("")}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
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

  const statusColors: Record<ConnStatus, string> = { idle: "#4A6FA5", connecting: "#F59E0B", connected: "#10B981", error: "#EF4444" };
  const statusLabels: Record<ConnStatus, string> = { idle: "Not connected", connecting: "Connecting…", connected: "Connected", error: "Error" };
  const typeColor: Record<string, [string,string]> = {
    sales: ["#10B981","rgba(16,185,129,0.12)"], purchase: ["#3B82F6","rgba(59,130,246,0.12)"],
    expense: ["#F59E0B","rgba(245,158,11,0.12)"], payment: ["#A78BFA","rgba(167,139,250,0.12)"],
    receipt: ["#34D399","rgba(52,211,153,0.12)"], journal: ["#7A93B4","rgba(122,147,180,0.1)"],
    contra: ["#FB923C","rgba(251,146,60,0.12)"],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0D14", color: "#E2E8F0", fontFamily: "Inter,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        .tb-mono{font-family:'JetBrains Mono',monospace}
        .tb-btn{border:none;border-radius:8px;font-family:Inter,system-ui,sans-serif;font-weight:600;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.875rem}
        .tb-btn:hover:not(:disabled){filter:brightness(1.1)}
        .tb-btn:disabled{opacity:0.4;cursor:not-allowed}
        .tb-btn-primary{background:#3B82F6;color:#fff}
        .tb-btn-green{background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3)!important;color:#34D399}
        .tb-btn-purple{background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.3)!important;color:#A78BFA}
        .tb-btn-red{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2)!important;color:#F87171}
        .tb-btn-gold{background:#CA8A04;color:#fff}
        .tb-link-btn{background:none;border:none;cursor:pointer;font-family:Inter,system-ui;padding:0}
        .tb-card{background:#111827;border:1px solid #1F2937;border-radius:12px;padding:1.25rem}
        .tb-section-label{font-size:0.65rem;font-weight:700;color:#4B5563;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.75rem}
        .tb-input{background:#0F172A;border:1px solid #1F2937;color:#E2E8F0;padding:8px 12px;border-radius:8px;font-size:0.875rem;outline:none;font-family:Inter,system-ui;transition:border-color 0.15s}
        .tb-input:focus{border-color:#3B82F6}
        .tb-row{border-top:1px solid #1F2937}
        .tb-row:hover td{background:rgba(255,255,255,0.015)}
        .tb-ok{border-left:2px solid #10B981}
        .tb-fail{border-left:2px solid #EF4444}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .tb-live{animation:pulse 2s ease-in-out infinite}
        details summary{list-style:none;cursor:pointer}
        details summary::-webkit-details-marker{display:none}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
        select option{background:#111827}
      `}</style>

      {/* Nav */}
      <nav style={{ background: "#0A0D14", borderBottom: "1px solid #1F2937", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", gap: "0.5rem", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/finance" style={{ color: "#6B7280", fontSize: "0.875rem", textDecoration: "none", fontWeight: 500 }}>Finance</Link>
        <span style={{ color: "#374151" }}>/</span>
        <span style={{ color: "#E2E8F0", fontSize: "0.875rem", fontWeight: 600 }}>Tally Sync</span>
        {connStatus === "connected" && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 20, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 600, color: "#34D399" }}>
            <span className="tb-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", display: "block" }} />
            {companyName || "Connected"}
          </span>
        )}
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#F1F5F9" }}>Tally Sync</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.875rem" }}>Import data from Tally Prime. Upload XML (easiest) or connect live if Tally is open on this PC.</p>
        </div>

        {/* ── METHOD 1: XML Upload ── */}
        <div style={{ marginBottom: "1rem" }}>
          <div className="tb-section-label">Recommended — No setup required</div>
          <div className="tb-card" style={{ borderColor: "rgba(59,130,246,0.2)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#F1F5F9", marginBottom: "0.25rem" }}>Upload Tally XML</div>
                <div style={{ color: "#6B7280", fontSize: "0.8125rem", lineHeight: 1.6 }}>
                  Export from Tally → <span style={{ color: "#94A3B8" }}>Gateway → Display → Daybook → Alt+E → XML</span> → upload here.
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
                <input ref={xmlFileRef} type="file" accept=".xml" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importFromXmlFile(f); e.target.value = ""; }} />
                <button onClick={() => xmlFileRef.current?.click()} disabled={!!syncing} className="tb-btn tb-btn-primary" style={{ padding: "9px 20px" }}>
                  {syncing === "xmlUpload" ? (syncProgress ?? "Importing…") : "Upload XML"}
                </button>
              </div>
            </div>
            {xmlUploadResult && (
              <div style={{ marginTop: "0.875rem", padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 500, color: xmlUploadResult.ok ? "#34D399" : "#FBBF24", background: xmlUploadResult.ok ? "rgba(16,185,129,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${xmlUploadResult.ok ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}` }}>
                {xmlUploadResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* ── METHOD 2: Live Connect ── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="tb-section-label">Live Connect — Tally must be open on this computer</div>
          <div className="tb-card">

            {/* One-time setup hint */}
            <details style={{ marginBottom: "1rem" }}>
              <summary style={{ fontSize: "0.8rem", color: "#6B7280", cursor: "pointer", padding: "0.2rem 0", fontWeight: 500 }}>
                ▶ First time? Enable Tally HTTP Server (one step)
              </summary>
              <div style={{ marginTop: "0.875rem", background: "#0A0D14", borderRadius: 8, padding: "1rem", fontSize: "0.82rem", color: "#9CA3AF", lineHeight: 2 }}>
                <strong style={{ color: "#C9A84C" }}>In Tally Prime:</strong><br />
                F1 (Help) → Settings → Connectivity → Enable Tally HTTP Server → Port: <strong>7001</strong> → Accept (Ctrl+A)<br />
                <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>Only needs to be done once. Tally must remain open while syncing.</span>
              </div>
            </details>

            {/* Bridge download */}
            <div style={{ marginBottom: "1.25rem", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "0.875rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                <div style={{ fontSize: "1.4rem", flexShrink: 0 }}>🔗</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#86EFAC", marginBottom: 1 }}>Tally Bridge <span style={{ fontWeight: 400, color: "#6B7280", fontSize: "0.72rem" }}>Requires Node.js</span></div>
                  <div style={{ fontSize: "0.73rem", color: "#6B7280", lineHeight: 1.4 }}>Tiny 2KB script — no SmartScreen, no install. Just double-click and keep open.</div>
                </div>
                <a href="/tally-bridge-node.zip" download="FreWork-Tally-Bridge.zip" style={{ flexShrink: 0, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86EFAC", borderRadius: 7, padding: "6px 14px", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>⬇ Download</a>
              </div>
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 7, padding: "0.5rem 0.75rem", fontSize: "0.73rem", color: "#9CA3AF", lineHeight: 1.9 }}>
                1. <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer" style={{ color: "#86EFAC" }}>Install Node.js</a> (one-time, if not already installed)<br />
                2. Extract the zip → double-click <strong style={{ color: "#D1FAE5" }}>run-tally-bridge.bat</strong><br />
                3. Keep the window open → click Connect to Tally
              </div>
            </div>

            {/* Connection row */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280", marginBottom: "0.3rem" }}>Port</div>
                <input value={tallyPort} onChange={e => setTallyPort(e.target.value)} className="tb-input" style={{ width: 80 }} placeholder="7001" />
              </div>
              <button onClick={testConnection} disabled={connStatus === "connecting"} className="tb-btn tb-btn-primary" style={{ padding: "9px 24px", fontSize: "0.88rem" }}>
                {connStatus === "connecting" ? "Connecting…" : connStatus === "connected" ? "↺ Reconnect" : "Connect to Tally"}
              </button>
              {connStatus === "connected" && (
                <button onClick={disconnect} className="tb-btn tb-btn-red" style={{ padding: "9px 16px" }}>Disconnect</button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 600, color: statusColors[connStatus] }}>
                <span className={connStatus === "connected" ? "tb-live" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: statusColors[connStatus] }} />
                {statusLabels[connStatus]}
              </div>
            </div>

            {connStatus === "error" && connMsg && (
              <div style={{ marginTop: "0.875rem", padding: "0.75rem 1rem", borderRadius: 8, fontSize: "0.82rem", color: "#FCA5A5", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", lineHeight: 1.7 }}>
                ⚠ {connMsg}
              </div>
            )}

            {connStatus === "connected" && allCompanies.length > 1 && (
              <div style={{ marginTop: "0.875rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280", marginBottom: "0.3rem" }}>Select Company</div>
                <select value={companyName} onChange={e => { setCompanyName(e.target.value); localStorage.setItem("fw_tally_company", e.target.value); }}
                  className="tb-input" style={{ width: "100%" }}>
                  {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Date range — only relevant when connected */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280", marginBottom: "0.3rem" }}>From Date</div>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="tb-input" style={{ width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280", marginBottom: "0.3rem" }}>To Date</div>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="tb-input" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Tally → FrePilot buttons */}
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #1F2937" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280", marginBottom: "0.625rem" }}>Tally → FrePilot</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button onClick={importLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-green" style={{ flex: 1, padding: "9px 0" }}>
                  {syncing === "import" ? "Importing…" : "Import Ledgers"}
                </button>
                <button onClick={importVouchers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-purple" style={{ flex: 1, padding: "9px 0" }}>
                  {syncing === "importVouchers" ? (syncProgress ?? "Syncing…") : "Import Vouchers"}
                </button>
                <button onClick={clearAndReimport} disabled={connStatus !== "connected" || !!syncing} className="tb-btn tb-btn-red" style={{ padding: "9px 14px" }} title="Delete all TLY imports and re-import fresh">
                  Clear & Re-import
                </button>
              </div>
              {importVoucherResult && (
                <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 500, color: importVoucherResult.ok ? "#34D399" : "#FBBF24", background: importVoucherResult.ok ? "rgba(16,185,129,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${importVoucherResult.ok ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}` }}>
                  {importVoucherResult.msg}
                  {importVoucherResult.ok && (
                    <span style={{ marginLeft: "0.75rem" }}>
                      <a href="/finance/audit" style={{ color: "#818CF8", textDecoration: "underline" }}>View Audit & Reports →</a>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* FrePilot → Tally buttons */}
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #1F2937" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#6B7280" }}>FrePilot → Tally</div>
                <button onClick={loadJournalPreview} className="tb-btn" style={{ background: "transparent", border: "1px solid #1F2937", color: "#6B7280", padding: "4px 12px", fontSize: "0.75rem" }}>
                  {previewOpen ? "Refresh" : "Preview Journals"}
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button onClick={syncLedgers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn" style={{ flex: 1, padding: "9px 0", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#60A5FA" }}>
                  {syncing === "ledgers" ? "Pushing…" : "Push Ledgers to Tally"}
                </button>
                <button onClick={pushVouchers} disabled={connStatus !== "connected" || !!syncing} className="tb-btn" style={{ flex: 1, padding: "9px 0", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#A78BFA" }}>
                  {syncing === "vouchers" ? (syncProgress ?? "Pushing…") : `Push Vouchers (${journalCount ?? "—"})`}
                </button>
              </div>
            </div>

            {rawDebug && (
              <details style={{ marginTop: "0.875rem" }}>
                <summary style={{ fontSize: "0.75rem", color: "#4B5563", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.6rem" }}>▶</span> Raw response
                </summary>
                <pre className="tb-mono" style={{ marginTop: "0.5rem", fontSize: "0.65rem", color: "#4B5563", background: "#0F172A", padding: "0.75rem", borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 160, overflowY: "auto", border: "1px solid #1F2937" }}>
                  {rawDebug}
                </pre>
              </details>
            )}

            {syncResult && (
              <div style={{ marginTop: "1rem", padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 500, color: syncResult.ok ? "#34D399" : "#FBBF24", background: syncResult.ok ? "rgba(16,185,129,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${syncResult.ok ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}` }}>
                {syncResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* ── JOURNAL PREVIEW TABLE ── */}
        {previewOpen && (
          <div className="tb-card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
            {previewLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#4B5563", fontSize: "0.875rem" }}>Loading…</div>
            ) : journals.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#4B5563", fontSize: "0.875rem" }}>No posted journals in this date range.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "#0F172A" }}>
                      {["Entry", "Date", "Type", "Narration", "DR (₹)", "CR (₹)"].map(h => (
                        <th key={h} style={{ textAlign: "left", color: "#4B5563", fontWeight: 600, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", padding: "0.625rem 0.875rem", whiteSpace: "nowrap", borderBottom: "1px solid #1F2937" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((j, i) => {
                      const [tc, tbg] = typeColor[j.type] ?? ["#6B7280","rgba(107,114,128,0.1)"];
                      return (
                        <tr key={j.id} className="tb-row" style={{ borderTop: i === 0 ? "none" : undefined }}>
                          <td className="tb-mono" style={{ color: "#4B5563", whiteSpace: "nowrap", fontSize: "0.72rem", padding: "0.5rem 0.875rem" }}>{j.entry_no}</td>
                          <td style={{ whiteSpace: "nowrap", color: "#6B7280", padding: "0.5rem 0.875rem" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                          <td style={{ padding: "0.5rem 0.875rem" }}>
                            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: tc, background: tbg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{j.type}</span>
                          </td>
                          <td style={{ color: "#94A3B8", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>{j.narration}</td>
                          <td className="tb-mono" style={{ textAlign: "right", color: "#10B981", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>₹{Number(j.total_debit).toLocaleString("en-IN")}</td>
                          <td className="tb-mono" style={{ textAlign: "right", color: "#60A5FA", whiteSpace: "nowrap", padding: "0.5rem 0.875rem" }}>₹{Number(j.total_credit).toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid #1F2937", background: "rgba(255,255,255,0.02)" }}>
                      <td colSpan={4} style={{ fontWeight: 600, fontSize: "0.72rem", color: "#4B5563", padding: "0.5rem 0.875rem" }}>{journals.length} journal{journals.length !== 1 ? "s" : ""} ready to push</td>
                      <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#10B981", padding: "0.5rem 0.875rem" }}>₹{journals.reduce((s, j) => s + Number(j.total_debit), 0).toLocaleString("en-IN")}</td>
                      <td className="tb-mono" style={{ textAlign: "right", fontWeight: 700, color: "#60A5FA", padding: "0.5rem 0.875rem" }}>₹{journals.reduce((s, j) => s + Number(j.total_credit), 0).toLocaleString("en-IN")}</td>
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
            <div style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid #1F2937" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>Push Results</span>
              <span style={{ fontSize: "0.75rem", color: "#34D399", fontWeight: 600 }}>✓ {pushResults.filter(r => r.ok).length} ok</span>
              {pushResults.filter(r => !r.ok).length > 0 && <span style={{ fontSize: "0.75rem", color: "#F87171", fontWeight: 600 }}>✗ {pushResults.filter(r => !r.ok).length} failed</span>}
              {pushResults.some(r => !r.ok) && (
                <button onClick={createMissingLedgers} disabled={creatingLedgers || connStatus !== "connected"} className="tb-btn tb-btn-gold" style={{ marginLeft: "auto", padding: "5px 14px", fontSize: "0.75rem" }}>
                  {creatingLedgers ? "Creating…" : "Create Missing Ledgers"}
                </button>
              )}
            </div>
            {createLedgerResult && (
              <div style={{ padding: "0.5rem 1rem", fontSize: "0.78rem", color: createLedgerResult.startsWith("✓") ? "#34D399" : "#FBBF24", borderBottom: "1px solid #1F2937" }}>
                {createLedgerResult}
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <tbody>
                {pushResults.map((r, i) => (
                  <React.Fragment key={r.id}>
                    <tr className="tb-row" style={{ borderLeft: `2px solid ${r.ok ? "#10B981" : "#EF4444"}`, borderTop: i === 0 ? "none" : undefined }}>
                      <td style={{ width: 32, textAlign: "center", padding: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: r.ok ? "#34D399" : "#F87171" }}>{r.ok ? "✓" : "✗"}</span>
                      </td>
                      <td className="tb-mono" style={{ color: "#4B5563", fontSize: "0.72rem", whiteSpace: "nowrap", padding: "0.5rem 0" }}>{r.entry_no}</td>
                      <td style={{ color: "#6B7280", whiteSpace: "nowrap", padding: "0.5rem 0.75rem", fontSize: "0.78rem" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      <td style={{ color: r.ok ? "#94A3B8" : "#FBBF24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240, padding: "0.5rem 0", fontSize: "0.8rem" }}>
                        {r.ok ? r.narration : (r.error || "Tally rejected — check ledger names")}
                      </td>
                      {!r.ok && (
                        <td style={{ whiteSpace: "nowrap", padding: "0.5rem 1rem" }}>
                          <a href={`/finance/journals/${r.id}/edit`} style={{ fontSize: "0.72rem", color: "#60A5FA", marginRight: 10, textDecoration: "none", fontWeight: 600 }}>Edit</a>
                          <button className="tb-link-btn" onClick={async () => {
                            if (!confirm(`Delete journal ${r.entry_no}? This cannot be undone.`)) return;
                            await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", r.id);
                            await supabase.from("fw_fin_journals").delete().eq("id", r.id);
                            setPushResults(prev => prev.filter(x => x.id !== r.id));
                            setJournals(prev => prev.filter(x => x.id !== r.id));
                            setJournalCount(prev => (prev ?? 1) - 1);
                          }} style={{ fontSize: "0.72rem", color: "#F87171", fontWeight: 600 }}>Delete</button>
                        </td>
                      )}
                      {r.ok && <td />}
                    </tr>
                    {!r.ok && (r.xml || r.tallyResponse) && (
                      <tr style={{ borderTop: "none" }}>
                        <td colSpan={5} style={{ padding: "0 1rem 0.625rem 2.5rem" }}>
                          <details style={{ fontSize: "0.72rem" }}>
                            <summary style={{ color: "#4B5563", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span>▶</span> Debug details
                            </summary>
                            {r.xml && <pre className="tb-mono" style={{ marginTop: "0.4rem", fontSize: "0.65rem", background: "#0F172A", padding: "0.6rem 0.75rem", borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#93C5FD", maxHeight: 140, overflowY: "auto", border: "1px solid #1F2937" }}>{r.xml}</pre>}
                            {r.tallyResponse && <pre className="tb-mono" style={{ marginTop: "0.4rem", fontSize: "0.65rem", background: "#0F172A", padding: "0.6rem 0.75rem", borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#FCA5A5", maxHeight: 140, overflowY: "auto", border: "1px solid #1F2937" }}>{r.tallyResponse}</pre>}
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
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#F1F5F9", marginBottom: "0.2rem" }}>Export FrePilot → Tally XML</div>
                <div style={{ color: "#6B7280", fontSize: "0.8rem" }}>Download XML and import via Gateway of Tally → Import → Vouchers.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)} className="tb-input" style={{ fontSize: "0.8125rem" }}>
                  {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
                </select>
                <a href={buildExportUrl()} download className="tb-btn" style={{ background: "transparent", border: "1px solid #1F2937", color: "#94A3B8", padding: "8px 16px", textDecoration: "none", fontSize: "0.8125rem" }}>
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
