"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type TallyStatus = { state: "idle" | "checking" | "connected" | "disconnected"; company: string };

function parseTallyCompanyName(xml: string): string {
  // All known patterns Tally Prime uses to return company name
  const patterns: RegExp[] = [
    /<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/i,
    /<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i,
    /<BASICCOMPANYNAME[^>]*>([^<]+)<\/BASICCOMPANYNAME>/i,
    // attribute anywhere in COMPANY tag: <COMPANY REMOTEID="x" NAME="Abc">
    /<COMPANY[^>]+NAME="([^"]+)"/i,
    // NAME child right inside COMPANY (may be wrapped in NAME.LIST)
    /<COMPANY[^>]*>(?:(?!<\/COMPANY>)[\s\S]){0,300}<NAME[^>]*>([^<]{2,})<\/NAME>/i,
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    const v = m?.[1]?.trim();
    if (v && v.length >= 2) return v;
  }
  return "";
}

// Safe lightweight ping — no TDL filters that freeze Tally
async function checkTally(): Promise<TallyStatus & { _raw: string }> {
  try {
    // Filter to ONLY the currently active company using $$IsCurrentCompany
    // This avoids picking a background company when multiple are open in Tally
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_CurComp</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_CurComp" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,CompanyName,StartingFrom</FETCH><FILTER>FP_IsCurrent</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="FP_IsCurrent">$$IsCurrentCompany:$Name</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await fetch("http://localhost:7001", {
      method: "POST", headers: { "Content-Type": "text/xml" }, body: xml,
      signal: AbortSignal.timeout(3000),
    });
    const text = await res.text();
    let parsed = parseTallyCompanyName(text);
    // Fallback: if filter returned nothing (older Tally versions), try without filter
    if (!parsed) {
      const xmlAll = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,CompanyName,StartingFrom</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res2 = await fetch("http://localhost:7001", {
        method: "POST", headers: { "Content-Type": "text/xml" }, body: xmlAll,
        signal: AbortSignal.timeout(3000),
      });
      parsed = parseTallyCompanyName(await res2.text());
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem("fw_tally_company") ?? "" : "";
    const company = parsed.length >= 2 ? parsed : (stored.length >= 2 ? stored : "Tally");
    if (parsed.length >= 2 && parsed !== stored) {
      try { localStorage.setItem("fw_tally_company", parsed); } catch { /* */ }
    }
    return { state: "connected", company, _raw: text.slice(0, 600) };
  } catch (e) {
    return { state: "disconnected", company: "", _raw: String(e) };
  }
}



type Business = { id: string; name: string; gstin: string | null; gst_registration_type: string; state: string | null };
type Stats = { sales: number; expenses: number; drafts: number; pendingTds: number; revenue: number; profit: number };

const QUICK = [
  { icon: "🧾", label: "New Invoice",    href: "/finance/sales/new",     color: "#F59E0B" },
  { icon: "📦", label: "Purchase Bill",  href: "/finance/purchases/new", color: "#60A5FA" },
  { icon: "💸", label: "Record Expense", href: "/finance/expenses",      color: "#A78BFA" },
  { icon: "📤", label: "Upload Doc",     href: "/finance/upload",        color: "#34D399" },
  { icon: "💳", label: "Payment Entry",  href: "/finance/payment",       color: "#FB923C" },
  { icon: "🛩️", label: "Ask FrePilot",  href: "/finance/virtual-ca",    color: "#F59E0B" },
];

const MODULES = [
  { group: "Reports", items: [
    { icon: "🔍", label: "Audit & Reports",     desc: "Trial balance, P&L, Balance Sheet, audit flags", href: "/finance/audit",          accent: "#34D399" },
    { icon: "📈", label: "P&L / Reports",      desc: "Income statement, balance sheet, cash flow", href: "/finance/reports",           accent: "#34D399" },
    { icon: "🏛️", label: "GST Returns",        desc: "GSTR-1, GSTR-3B — auto-prepared",           href: "/finance/gst",               accent: "#60A5FA" },
    { icon: "🔖", label: "TDS Tracker",         desc: "Section-wise TDS, due dates, calculator",   href: "/finance/tds",               accent: "#F59E0B" },
  ]},
  { group: "Books", items: [
    { icon: "📒", label: "Journal Entries",    desc: "Double-entry ledger — Dr = Cr enforced",     href: "/finance/journals",          accent: "#A78BFA" },
    { icon: "🔴", label: "Credit Notes",       desc: "Issue CN to customers — sales returns",      href: "/finance/credit-note",       accent: "#F87171" },
    { icon: "🟢", label: "Debit Notes",        desc: "Issue DN to vendors — purchase returns",     href: "/finance/debit-note",        accent: "#34D399" },
  ]},
  { group: "Receivables & Payables", items: [
    { icon: "📥", label: "Receivables (AR)",   desc: "Who owes you money, aging report",           href: "/finance/receivables",       accent: "#34D399" },
    { icon: "📤", label: "Payables (AP)",       desc: "Who you owe, vendor aging",                 href: "/finance/payables",          accent: "#F87171" },
    { icon: "🏦", label: "Bank Reconciliation", desc: "Import CSV, auto-match entries",            href: "/finance/banking",           accent: "#60A5FA" },
  ]},
  { group: "Setup", items: [
    { icon: "🔄", label: "Tally Export",        desc: "Export as Tally-compatible XML",            href: "/finance/tally",             accent: "#FB923C" },
    { icon: "👥", label: "Contacts",            desc: "Customers & vendors with opening balances", href: "/finance/contacts",          accent: "#A78BFA" },
    { icon: "📊", label: "Chart of Accounts",  desc: "Indian account heads structure",             href: "/finance/chart-of-accounts", accent: "#60A5FA" },
  ]},
];

export default function FrePilotDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [stats, setStats] = useState<Stats>({ sales: 0, expenses: 0, drafts: 0, pendingTds: 0, revenue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [fyLabel, setFyLabel] = useState("2025-26");
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [tally, setTally] = useState<TallyStatus>({ state: "idle", company: "" });
  const [tallySyncing, setTallySyncing] = useState<"ledgers" | "vouchers" | null>(null);
  const [tallySyncMsg, setTallySyncMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tallySyncProgress, setTallySyncProgress] = useState<string | null>(null);

  const pingTally = useCallback(async () => {
    setTally(t => ({ ...t, state: "checking" }));
    const result = await checkTally();
    setTally(result);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "" });
      loadBusinesses(u.id);
    });
    pingTally();
    const id = setInterval(pingTally, 30000);
    return () => clearInterval(id);
  }, []);

  // Auto-sync: at most once every 60 minutes per business, stored in localStorage
  const AUTO_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (tally.state === "connected" && activeBiz && !tallySyncing && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      const lsKey = `fw_tally_last_sync_${activeBiz.id}`;
      const lastSync = parseInt(localStorage.getItem(lsKey) ?? "0", 10);
      const elapsed = Date.now() - lastSync;
      if (elapsed > AUTO_SYNC_COOLDOWN_MS) {
        localStorage.setItem(lsKey, String(Date.now()));
        doImportVouchers(false);
      }
    }
    if (tally.state !== "connected") {
      autoSyncedRef.current = false;
    }
  }, [tally.state, activeBiz]);

  async function loadBusinesses(uid: string) {
    const { data } = await supabase.from("fw_fin_businesses")
      .select("id,name,gstin,gst_registration_type,state").eq("owner_id", uid).eq("is_active", true).order("created_at");
    if (!data || data.length === 0) { setLoading(false); return; }
    setBusinesses(data);
    const saved = (localStorage.getItem(`fw_fin_biz_${uid}`) ?? "").replace(/﻿/g, "").trim();
    const biz = data.find(b => b.id === saved) || data[0];
    setActiveBiz(biz);
    loadStats(biz.id, uid);
  }

  async function loadStats(bizId: string, uid: string, selectedFyId?: string | null) {
    setLoading(true);
    void uid;
    // 1. Load financial years
    const { data: fys } = await supabase.from("fw_fin_financial_years")
      .select("id,label,is_current,start_date,end_date").eq("business_id", bizId).order("start_date", { ascending: false });
    const allFys = fys ?? [];
    setFinancialYears(allFys.map(f => ({ id: f.id, label: f.label })));
    const tallyFyId = typeof window !== "undefined" ? localStorage.getItem("fw_tally_fy_id") ?? "" : "";
    const activeFy = selectedFyId
      ? allFys.find(f => f.id === selectedFyId)
      : (tallyFyId ? allFys.find(f => f.id === tallyFyId) : undefined) ?? allFys.find(f => f.is_current) ?? allFys[0];
    if (activeFy) { setFyLabel(activeFy.label); setFyId(activeFy.id); }

    // 2. Count journals by date range (for counts + drafts)
    let jq = supabase.from("fw_fin_journals")
      .select("type,status,date").eq("business_id", bizId).neq("status", "voided");
    if (activeFy?.start_date) jq = jq.gte("date", activeFy.start_date);
    if (activeFy?.end_date)   jq = jq.lte("date", activeFy.end_date);
    const { data: jData } = await jq;
    const journals = jData ?? [];
    const posted = journals.filter(j => j.status === "posted");

    // 3. Revenue & profit: query journal_lines joined with accounts by type
    //    This is always accurate regardless of how total_debit/credit was stored
    let lq = supabase.from("fw_fin_journal_lines")
      .select("dr_amount, cr_amount, fw_fin_chart_of_accounts!inner(type), fw_fin_journals!inner(business_id, status, date, type)")
      .eq("fw_fin_journals.business_id", bizId)
      .eq("fw_fin_journals.status", "posted")
      .neq("fw_fin_journals.type", "contra"); // exclude bank-to-bank transfers
    if (activeFy?.start_date) lq = lq.gte("fw_fin_journals.date", activeFy.start_date);
    if (activeFy?.end_date)   lq = lq.lte("fw_fin_journals.date", activeFy.end_date);
    const { data: lines } = await lq;
    type LineRow = { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { type: string }[] | { type: string } | null };
    const linesArr = (lines ?? []) as unknown as LineRow[];
    const accType = (l: LineRow) => {
      const a = l.fw_fin_chart_of_accounts;
      return Array.isArray(a) ? a[0]?.type : (a as { type: string } | null)?.type ?? "";
    };

    // Revenue = total Cr on income accounts
    const salesRev = linesArr
      .filter(l => accType(l) === "income")
      .reduce((s, l) => s + (l.cr_amount || 0), 0);
    // Expenses = total Dr on expense accounts
    const expTotal = linesArr
      .filter(l => accType(l) === "expense")
      .reduce((s, l) => s + (l.dr_amount || 0), 0);

    setStats({
      sales: posted.filter(j => j.type === "sales").length,
      expenses: posted.filter(j => j.type === "purchase" || j.type === "expense").length,
      drafts: journals.filter(j => j.status === "draft").length,
      pendingTds: 0,
      revenue: salesRev,
      profit: salesRev - expTotal,
    });
    setLoading(false);
  }

  function switchBiz(biz: Business) {
    setActiveBiz(biz);
    if (user) { localStorage.setItem(`fw_fin_biz_${user.id}`, biz.id); loadStats(biz.id, user.id, null); }
  }

  function switchFy(selectedId: string) {
    setFyId(selectedId);
    if (activeBiz && user) loadStats(activeBiz.id, user.id, selectedId);
  }

  const tallyUrl = `http://localhost:${typeof window !== "undefined" ? (localStorage.getItem("fw_tally_port") ?? "7001") : "7001"}`;

  function tallyParentToType(parent: string): "asset" | "liability" | "equity" | "income" | "expense" {
    const p = parent.toLowerCase();
    if (p.includes("bank") || p.includes("cash") || p.includes("fixed asset") || p.includes("plant") ||
        p.includes("machinery") || p.includes("furniture") || p.includes("sundry debt") ||
        p.includes("receivable") || p.includes("debtor") || p.includes("current asset") ||
        p.includes("loan") || p.includes("deposit") || p.includes("investment")) return "asset";
    if (p.includes("capital") || p.includes("reserve") || p.includes("equity") || p.includes("proprietor") ||
        p.includes("retained")) return "equity";
    if (p.includes("sales") || p.includes("income") || p.includes("revenue") || p.includes("interest income")) return "income";
    if (p.includes("current liab") || p.includes("sundry cred") || p.includes("payable") ||
        p.includes("creditor") || p.includes("borrowing") || p.includes("overdraft")) return "liability";
    if (p.includes("purchase") || p.includes("direct exp") || p.includes("cost of goods") ||
        p.includes("indirect exp") || p.includes("duties") || p.includes("tax") ||
        p.includes("gst") || p.includes("tds") || p.includes("expense")) return "expense";
    return "expense";
  }

  function parseTallyVouchersLocal(xml: string) {
    type TV = { date: string; voucherType: string; voucherNumber: string; narration: string; lines: { ledgerName: string; amount: number; isDeemed: boolean }[] };
    const results: TV[] = [];
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
      const lines: TV["lines"] = [];
      const eRe = /<ALLLEDGERENTRIES\.LIST[^>]*>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
      let em;
      while ((em = eRe.exec(block)) !== null) {
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

  const doImportLedgers = useCallback(async () => {
    if (!activeBiz || tally.state !== "connected") return;
    setTallySyncing("ledgers"); setTallySyncMsg(null);
    try {
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Ledgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Ledgers" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      const seen = new Set<string>(); const ledgers: { name: string; parent: string }[] = [];
      const re = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi; let m;
      while ((m = re.exec(text)) !== null) {
        const name = m[1].trim(); if (!name || seen.has(name)) continue;
        const pm = m[2].match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
        seen.add(name); ledgers.push({ name, parent: pm?.[1]?.trim() ?? "" });
      }
      if (!ledgers.length) { setTallySyncMsg({ ok: false, msg: "No ledgers returned from Tally." }); setTallySyncing(null); return; }
      const { data: existing } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", activeBiz.id);
      const existingMap = new Map((existing ?? []).map(a => [a.name, a]));
      const VALID = new Set(["asset","liability","equity","income","expense"]);

      // Fix accounts with non-standard types (from old imports)
      const badTypeAccounts = (existing ?? []).filter(a => !VALID.has(a.type));
      for (const acc of badTypeAccounts) {
        const ledger = ledgers.find(l => l.name === acc.name);
        if (ledger) {
          await supabase.from("fw_fin_chart_of_accounts").update({ type: tallyParentToType(ledger.parent) }).eq("id", acc.id);
        }
      }

      const rows = ledgers.filter(l => !existingMap.has(l.name)).map((l, idx) => ({
        business_id: activeBiz.id, code: `TL${String(idx + 1).padStart(3,"0")}`, name: l.name,
        type: tallyParentToType(l.parent), description: l.parent ? `From Tally — ${l.parent}` : "From Tally",
        is_system: false, is_group: false, sort_order: (existing?.length ?? 0) + idx + 1,
      }));
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from("fw_fin_chart_of_accounts").insert(rows.slice(i, i + 50));
        if (!error) inserted += Math.min(50, rows.length - i);
      }
      setTallySyncMsg({ ok: true, msg: `✓ Imported ${inserted} ledgers, fixed ${badTypeAccounts.length} account types (${existingMap.size} already existed)` });
    } catch (e) { setTallySyncMsg({ ok: false, msg: e instanceof Error ? e.message : "Network error" }); }
    setTallySyncing(null);
  }, [activeBiz, tally.state, tallyUrl]);

  const doImportVouchers = useCallback(async (clearFirst = false) => {
    if (!activeBiz || tally.state !== "connected") return;
    if (clearFirst && !confirm("Delete all existing TLY imports and re-import fresh from Tally?")) return;
    setTallySyncing("vouchers"); setTallySyncMsg(null); setTallySyncProgress(null);

    if (clearFirst) {
      setTallySyncProgress("Clearing old entries…");
      const { data: old } = await supabase.from("fw_fin_journals").select("id").eq("business_id", activeBiz.id).like("entry_no", "TLY-%");
      if (old?.length) {
        const ids = old.map(j => j.id);
        for (let i = 0; i < ids.length; i += 100) {
          await supabase.from("fw_fin_journal_lines").delete().in("journal_id", ids.slice(i, i + 100));
          await supabase.from("fw_fin_journals").delete().in("id", ids.slice(i, i + 100));
        }
      }
    }

    const stored = typeof window !== "undefined" ? localStorage.getItem("fw_tally_fy_id") : null;
    const fyFrom = stored ? null : null; // dates from stored FY
    const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,start_date,end_date").eq("business_id", activeBiz.id).order("start_date", { ascending: false });
    const activeFy = stored ? fys?.find(f => f.id === stored) : fys?.[0];
    const fromDate = activeFy?.start_date ?? `${new Date().getFullYear()}-04-01`;
    const toDate = activeFy?.end_date ?? `${new Date().getFullYear() + 1}-03-31`;
    void fyFrom;

    const months: { from: string; to: string; label: string }[] = [];
    let cur = new Date(new Date(fromDate).getFullYear(), new Date(fromDate).getMonth(), 1);
    const end = new Date(toDate);
    while (cur <= end) {
      const y = cur.getFullYear(), mo = cur.getMonth();
      const mFrom = `${y}-${String(mo+1).padStart(2,"0")}-01`;
      const mTo = new Date(y, mo+1, 0).toISOString().slice(0,10);
      months.push({ from: mFrom, to: mTo < toDate ? mTo : toDate, label: cur.toLocaleString("en-IN", { month: "short", year: "2-digit" }) });
      cur = new Date(y, mo+1, 1);
    }

    const allVouchers: ReturnType<typeof parseTallyVouchersLocal> = [];
    for (let i = 0; i < months.length; i++) {
      const { from: mf, to: mt, label } = months[i];
      setTallySyncProgress(`Fetching ${label} (${i+1}/${months.length})…`);
      const fd = mf.replace(/-/g,""), td = mt.replace(/-/g,"");
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      try {
        const r = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(20000) });
        allVouchers.push(...parseTallyVouchersLocal(await r.text()));
      } catch { /* continue */ }
      if (i < months.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    if (!allVouchers.length) { setTallySyncMsg({ ok: false, msg: "No vouchers found in Tally for this period." }); setTallySyncing(null); return; }

    const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", activeBiz.id);
    const accountMap = new Map((accounts ?? []).map(a => [a.name.toLowerCase(), a]));
    const missing = new Set<string>();
    for (const v of allVouchers) for (const l of v.lines) if (!accountMap.has(l.ledgerName.toLowerCase())) missing.add(l.ledgerName);
    if (missing.size) {
      const newAcc = Array.from(missing).map((name, i) => ({ business_id: activeBiz.id, code: `TI${String((accounts?.length ?? 0)+i+1).padStart(3,"0")}`, name, type: tallyParentToType(name), description: "From Tally", is_system: false, is_group: false, sort_order: (accounts?.length ?? 0)+i+1 }));
      const { data: created } = await supabase.from("fw_fin_chart_of_accounts").insert(newAcc).select("id,name,type");
      for (const a of created ?? []) accountMap.set(a.name.toLowerCase(), a);
    }

    // Dedup by Tally entry_no (TLY-Sales-105, TLY-Receipt-23, etc.)
    const { data: existingTly } = await supabase.from("fw_fin_journals").select("entry_no").eq("business_id", activeBiz.id).like("entry_no", "TLY-%");
    const existingEntryNos = new Set((existingTly ?? []).map(j => j.entry_no));
    // Fallback seq counter for unnumbered vouchers
    let seq = existingTly?.length
      ? Math.max(0, ...existingTly.map(j => parseInt(j.entry_no.replace(/\D/g,"") || "0", 10))) + 1
      : 1;

    const typeMap: Record<string,string> = { "Sales":"sales","Purchase":"purchase","Payment":"payment","Receipt":"receipt","Contra":"contra","Journal":"journal","Debit Note":"debit_note","Credit Note":"credit_note" };
    let imported = 0, skipped = 0;
    for (const v of allVouchers) {
      // Build entry_no mirroring Tally: "TLY-Sales 105", "TLY-Receipt 23"
      const vNum = v.voucherNumber?.trim();
      const tallyLabel = vNum ? `${v.voucherType} ${vNum}` : `${v.voucherType}-${seq}`;
      const entryNo = `TLY-${tallyLabel}`;
      if (existingEntryNos.has(entryNo)) { skipped++; continue; }

      const fpType = typeMap[v.voucherType] ?? "journal";
      const totalDr = v.lines.filter(l => l.isDeemed).reduce((s,l) => s+l.amount, 0);
      const totalCr = v.lines.filter(l => !l.isDeemed).reduce((s,l) => s+l.amount, 0);
      const narration = v.narration || tallyLabel;
      const { data: jRow, error: jErr } = await supabase.from("fw_fin_journals").insert({
        business_id: activeBiz.id, financial_year_id: activeFy?.id ?? null,
        entry_no: entryNo, date: v.date, narration, type: fpType,
        status: "posted", total_debit: totalDr||totalCr, total_credit: totalCr||totalDr,
        reference_no: vNum || null,
      }).select("id").single();
      if (jErr || !jRow) { skipped++; continue; }
      const lines = v.lines.map(l => { const acc = accountMap.get(l.ledgerName.toLowerCase()); if (!acc) return null; return { journal_id: jRow.id, account_id: acc.id, description: l.ledgerName, dr_amount: l.isDeemed ? l.amount : 0, cr_amount: l.isDeemed ? 0 : l.amount }; }).filter(Boolean);
      if (lines.length > 0) {
        await supabase.from("fw_fin_journal_lines").insert(lines as {journal_id:string;account_id:string;description:string;dr_amount:number;cr_amount:number}[]);
        imported++; if (!vNum) seq++; existingEntryNos.add(entryNo);
      } else { await supabase.from("fw_fin_journals").delete().eq("id", jRow.id); skipped++; }
    }
    // Update last-sync timestamp so auto-sync cooldown resets after a manual import
    if (activeBiz) localStorage.setItem(`fw_tally_last_sync_${activeBiz.id}`, String(Date.now()));
    setTallySyncMsg({ ok: imported > 0, msg: imported > 0 ? `✓ Imported ${imported} voucher${imported!==1?"s":""}${skipped>0?` (${skipped} skipped, already existed)`:""}.` : `No new vouchers to import${skipped>0?` (${skipped} already existed)`:""}.` });
    if (activeBiz && user) loadStats(activeBiz.id, user.id, fyId);
    setTallySyncing(null); setTallySyncProgress(null);
  }, [activeBiz, tally.state, tallyUrl, fyId, user]);

  // Remove exact duplicate TLY entries (same entry_no — keep the one with lines)
  const doFixDuplicates = useCallback(async () => {
    if (!activeBiz) return;
    setTallySyncing("vouchers"); setTallySyncMsg(null);
    setTallySyncProgress("Scanning for duplicates…");
    const { data: all } = await supabase.from("fw_fin_journals")
      .select("id,entry_no,created_at").eq("business_id", activeBiz.id).like("entry_no", "TLY-%").order("created_at", { ascending: true });
    if (!all?.length) { setTallySyncMsg({ ok: true, msg: "No Tally entries found." }); setTallySyncing(null); setTallySyncProgress(null); return; }
    // Group by entry_no; for each group keep the first (oldest), delete the rest
    const groups = new Map<string, string[]>();
    for (const j of all) { const g = groups.get(j.entry_no) ?? []; g.push(j.id); groups.set(j.entry_no, g); }
    const toDelete: string[] = [];
    for (const [, ids] of groups) { if (ids.length > 1) toDelete.push(...ids.slice(1)); }
    if (!toDelete.length) { setTallySyncMsg({ ok: true, msg: "✓ No duplicates found — your data is clean." }); setTallySyncing(null); setTallySyncProgress(null); return; }
    setTallySyncProgress(`Removing ${toDelete.length} duplicate entries…`);
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      await supabase.from("fw_fin_journal_lines").delete().in("journal_id", batch);
      await supabase.from("fw_fin_journals").delete().in("id", batch);
    }
    setTallySyncMsg({ ok: true, msg: `✓ Removed ${toDelete.length} duplicate entr${toDelete.length !== 1 ? "ies" : "y"}. Figures updated.` });
    if (activeBiz && user) loadStats(activeBiz.id, user.id, fyId);
    setTallySyncing(null); setTallySyncProgress(null);
  }, [activeBiz, fyId, user]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (!loading && businesses.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#1A2E5A,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: "1.5rem", boxShadow: "0 0 40px rgba(201,168,76,0.3)" }}>🛩️</div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 900, background: "linear-gradient(135deg,#E8EDF5,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>Welcome to FrePilot</h1>
        <p style={{ color: "rgba(232,237,245,0.45)", fontSize: "1rem", maxWidth: 380, lineHeight: 1.7, margin: "0 0 2.5rem" }}>Your AI accountant is ready. Set up your business in 2 minutes.</p>
        <Link href="/finance/setup" style={{ background: "linear-gradient(135deg,#B8922A,#C9A84C)", color: "#050914", padding: "14px 40px", borderRadius: 12, fontWeight: 800, textDecoration: "none", fontSize: "0.95rem", letterSpacing: "0.01em", boxShadow: "0 8px 32px rgba(201,168,76,0.35)" }}>
          Set Up My Business →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .fp-bg { background-image: radial-gradient(circle, rgba(201,168,76,0.04) 1px, transparent 1px); background-size: 32px 32px; }
        .fp-kpi { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 1.25rem 1.4rem; transition: border-color 0.2s; }
        .fp-kpi:hover { border-color: rgba(255,255,255,0.14); }
        .fp-quick { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 0.7rem 1.1rem; display: flex; align-items: center; gap: 0.55rem; text-decoration: none; transition: all 0.15s; white-space: nowrap; }
        .fp-quick:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); transform: translateY(-1px); }
        .fp-mod { background: rgba(255,255,255,0.018); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1rem 1.1rem; display: flex; gap: 0.85rem; align-items: flex-start; text-decoration: none; transition: all 0.15s; }
        .fp-mod:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .fp-ai-banner { background: linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.03) 100%); border: 1px solid rgba(201,168,76,0.22); border-radius: 16px; padding: 1.2rem 1.5rem; display: flex; align-items: center; gap: 1.25rem; text-decoration: none; transition: border-color 0.2s; }
        .fp-ai-banner:hover { border-color: rgba(201,168,76,0.45); }
        select option { background: #0B1221; }
        @keyframes tp-pulse { 0%,100%{opacity:1;box-shadow:0 0 6px rgba(52,211,153,0.6)} 50%{opacity:0.6;box-shadow:0 0 12px rgba(52,211,153,0.9)} }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Nav — ProVia-style: logo | business ▾ | FY ▾ | … | actions */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.6rem", height: 54, position: "sticky", top: 0, background: "rgba(5,9,20,0.95)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#1A2E5A,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🛩️</div>
          <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#C9A84C", letterSpacing: "-0.02em" }}>FrePilot</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />

        {/* Business selector — always visible */}
        <select
          value={activeBiz?.id ?? ""}
          onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 28px 5px 10px", borderRadius: 8, fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 200, appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7FA3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
          {businesses.map(b => <option key={b.id} value={b.id} style={{ background: "#0B1221" }}>{b.name}</option>)}
        </select>

        {/* FY selector — always visible */}
        <select
          value={fyId ?? ""}
          onChange={e => switchFy(e.target.value)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 28px 5px 10px", borderRadius: 8, fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7FA3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
          {financialYears.map(f => <option key={f.id} value={f.id} style={{ background: "#0B1221" }}>FY {f.label}</option>)}
          {financialYears.length === 0 && <option value="">FY {fyLabel}</option>}
        </select>

        <div style={{ flex: 1 }} />

        {/* Tally pill */}
        {tally.state === "connected" ? (
          <Link href="/finance/tally" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", textDecoration: "none" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", flexShrink: 0, animation: "tp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34D399" }}>Tally · {tally.company}</span>
          </Link>
        ) : (
          <Link href="/finance/tally" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,237,245,0.15)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(232,237,245,0.3)" }}>Connect Tally</span>
          </Link>
        )}

        <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "5px 14px", borderRadius: 8, fontSize: "0.78rem", textDecoration: "none", fontWeight: 700 }}>
          🛩️ Ask FrePilot
        </Link>
        <Link href="/finance/setup" style={{ color: "rgba(232,237,245,0.3)", fontSize: "1rem", textDecoration: "none", padding: "4px 6px", borderRadius: 6 }}>⚙</Link>
      </nav>

<div className="fp-bg" style={{ minHeight: "calc(100vh - 58px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.75rem" }}>
          {activeBiz && (
            <>
              {/* Header */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.3)", marginBottom: "0.25rem" }}>{greeting}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", background: "linear-gradient(135deg,#E8EDF5 60%,rgba(232,237,245,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{activeBiz.name}</h1>
                  {activeBiz.gstin && (
                    <span style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.28)", fontFamily: "'IBM Plex Mono',monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 9px", borderRadius: 6 }}>
                      GSTIN {activeBiz.gstin}
                    </span>
                  )}
                </div>
              </div>

              {/* AI Banner */}
              <Link href="/finance/virtual-ca" className="fp-ai-banner" style={{ display: "flex", marginBottom: "1.75rem", textDecoration: "none" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🛩️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#C9A84C", fontSize: "0.9rem", marginBottom: "0.2rem" }}>FrePilot AI — Your Virtual Accountant</div>
                  <div style={{ fontSize: "0.76rem", color: "rgba(232,237,245,0.45)", lineHeight: 1.6 }}>Ask anything — GST rates, TDS sections, journal entries, compliance deadlines. Powered by Claude AI.</div>
                </div>
                <div style={{ color: "rgba(201,168,76,0.4)", fontSize: "1.1rem", flexShrink: 0, alignSelf: "center" }}>→</div>
              </Link>

              {/* KPI Cards — FrePilot app data */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA" }}>📂 FrePilot · FY {fyLabel}</span>
                {loading && <span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.2)" }}>Loading…</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.85rem", marginBottom: "1.75rem" }}>
                {[
                  { label: "Revenue", value: loading ? "—" : fmt(stats.revenue), color: "#34D399", sub: `FY ${fyLabel}`, mono: true, href: "/finance/journals?type=sales,receipt&status=posted", cta: "View Transactions →" },
                  { label: "Net Profit", value: loading ? "—" : (stats.profit < 0 ? "−" : "") + fmt(stats.profit), color: stats.profit >= 0 ? "#34D399" : "#F87171", sub: stats.profit < 0 ? "Net loss" : "Net profit", mono: true, href: "/finance/audit", cta: "View P&L →" },
                  { label: "Sales Invoices", value: loading ? "—" : String(stats.sales), color: "#F59E0B", sub: "Posted entries", mono: false, href: "/finance/journals?type=sales&status=posted", cta: "View Invoices →" },
                  { label: "Draft Entries", value: loading ? "—" : String(stats.drafts), color: stats.drafts > 0 ? "#FB923C" : "rgba(232,237,245,0.3)", sub: stats.drafts > 0 ? "Needs review" : "All clear", mono: false, alert: stats.drafts > 0, href: "/finance/journals?status=draft", cta: stats.drafts > 0 ? "Review Now →" : "View Journals →" },
                ].map(k => (
                  <Link key={k.label} href={k.href} className="fp-kpi" style={{ textDecoration: "none", display: "block", cursor: "pointer", ...(((k as {alert?:boolean}).alert) ? { background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.2)" } : {}) }}>
                    <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: k.color, fontFamily: k.mono ? "'IBM Plex Mono',monospace" : "inherit", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: "0.4rem" }}>{k.value}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
                      <div style={{ fontSize: "0.65rem", color: "rgba(232,237,245,0.25)", fontWeight: 500 }}>{k.sub}</div>
                      <div style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.2)", fontWeight: 600 }}>{k.cta}</div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.75rem" }}>Quick Actions</div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  {QUICK.map(q => (
                    <Link key={q.href} href={q.href} className="fp-quick">
                      <span style={{ fontSize: "1rem" }}>{q.icon}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: q.color }}>{q.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Modules by group */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {MODULES.map(group => (
                  <div key={group.group}>
                    <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.65rem" }}>{group.group}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.65rem" }}>
                      {group.items.map(m => (
                        <Link key={m.href} href={m.href} className="fp-mod">
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(255,255,255,0.04)`, border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{m.icon}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#E8EDF5", marginBottom: "0.2rem" }}>{m.label}</div>
                            <div style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.32)", lineHeight: 1.5 }}>{m.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tally Sync Card — shown when connected */}
              {tally.state === "connected" && (
                <div style={{ marginTop: "2rem", background: "linear-gradient(135deg,rgba(52,211,153,0.04),rgba(52,211,153,0.01))", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", display: "inline-block", boxShadow: "0 0 6px #34D399" }} />
                      <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#34D399" }}>Tally · {tally.company}</span>
                      <span style={{ fontSize: "0.65rem", color: "rgba(52,211,153,0.5)", fontWeight: 600 }}>LIVE</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <Link href="/finance/chat-book" style={{ fontSize: "0.72rem", color: "rgba(201,168,76,0.7)", textDecoration: "none", fontWeight: 600, padding: "3px 10px", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, background: "rgba(201,168,76,0.05)" }}>🤖 AI Bookkeeper</Link>
                      <Link href="/finance/tally" style={{ fontSize: "0.72rem", color: "rgba(52,211,153,0.5)", textDecoration: "none", fontWeight: 600 }}>Advanced settings →</Link>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: tallySyncMsg || tallySyncProgress ? "0.85rem" : 0 }}>
                    <button
                      onClick={doImportLedgers}
                      disabled={!!tallySyncing}
                      style={{ flex: 1, minWidth: 160, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: "#34D399", fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit", opacity: tallySyncing ? 0.5 : 1 }}>
                      {tallySyncing === "ledgers" ? "Importing…" : "⬇ Import Ledgers"}
                    </button>
                    <button
                      onClick={() => doImportVouchers(false)}
                      disabled={!!tallySyncing}
                      style={{ flex: 1, minWidth: 160, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)", color: "#C4B5FD", fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit", opacity: tallySyncing ? 0.5 : 1 }}>
                      {tallySyncing === "vouchers" ? (tallySyncProgress ?? "Syncing…") : "⬇ Import Vouchers"}
                    </button>
                    <button
                      onClick={() => doImportVouchers(true)}
                      disabled={!!tallySyncing}
                      style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#F87171", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", opacity: tallySyncing ? 0.5 : 1, whiteSpace: "nowrap" }}
                      title="Delete all TLY imports and re-import fresh">
                      🗑 Clear & Re-import
                    </button>
                    <button
                      onClick={doFixDuplicates}
                      disabled={!!tallySyncing}
                      style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.06)", color: "#FCD34D", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", opacity: tallySyncing ? 0.5 : 1, whiteSpace: "nowrap" }}
                      title="Remove duplicate Tally imports (same voucher number) — keeps latest">
                      🔧 Fix Duplicates
                    </button>
                  </div>

                  {/* Progress */}
                  {tallySyncing === "vouchers" && tallySyncProgress && (
                    <div style={{ fontSize: "0.76rem", color: "rgba(196,181,253,0.6)", marginBottom: "0.5rem" }}>{tallySyncProgress}</div>
                  )}

                  {/* Result */}
                  {tallySyncMsg && (
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: tallySyncMsg.ok ? "#34D399" : "#FCD34D", background: tallySyncMsg.ok ? "rgba(52,211,153,0.06)" : "rgba(252,211,77,0.06)", border: `1px solid ${tallySyncMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(252,211,77,0.2)"}`, borderRadius: 9, padding: "0.6rem 0.9rem" }}>
                      {tallySyncMsg.msg}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div style={{ marginTop: "3rem", textAlign: "center", fontSize: "0.68rem", color: "rgba(232,237,245,0.15)", letterSpacing: "0.02em" }}>
                FrePilot · Powered by Claude AI · FY {fyLabel} · {activeBiz.name}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
