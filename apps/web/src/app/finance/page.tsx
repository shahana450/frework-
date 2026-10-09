"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTally, disconnectTally } from "@/lib/tallyConnection";
import TallyBar from "@/components/TallyBar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Dashboard } from "@/lib/dashboard";
import { readTallyLedgerGroups, importTallyVouchers, summaryText } from "@/lib/integrations/tallyClient";
import type { TallyVoucher } from "@/lib/tallyUtils";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import HomeDesk from "./HomeDesk";

// Dashboard period presets; "fy" uses the financial-year picker
const PERIODS = [
  { key: "fy", label: "Whole financial year" }, { key: "this_month", label: "This month" }, { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" }, { key: "last_quarter", label: "Last quarter" }, { key: "last_30", label: "Last 30 days" },
  { key: "last_90", label: "Last 90 days" }, { key: "custom", label: "Custom range…" },
];
function periodRange(key: string, custom: { from: string; to: string }): { from: string; to: string; label: string } | null {
  const iso = (d: Date) => d.toLocaleDateString("en-CA");
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const mon = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const qStart = m - (((m - 3) % 3) + 3) % 3; // Indian quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
  switch (key) {
    case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: mon(now) };
    case "last_month": { const s = new Date(y, m - 1, 1); return { from: iso(s), to: iso(new Date(y, m, 0)), label: mon(s) }; }
    case "this_quarter": { const s = new Date(y, qStart, 1), e = new Date(y, qStart + 3, 0); return { from: iso(s), to: iso(e), label: `${mon(s)} – ${mon(e)}` }; }
    case "last_quarter": { const s = new Date(y, qStart - 3, 1), e = new Date(y, qStart, 0); return { from: iso(s), to: iso(e), label: `${mon(s)} – ${mon(e)}` }; }
    case "last_30": case "last_90": { const n = key === "last_30" ? 30 : 90; const s = new Date(y, m, now.getDate() - (n - 1)); return { from: iso(s), to: iso(now), label: `Last ${n} days` }; }
    case "custom": return custom.from && custom.to && custom.from <= custom.to ? { from: custom.from, to: custom.to, label: `${new Date(custom.from + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })} – ${new Date(custom.to + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}` } : null;
    default: return null;
  }
}

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
// TDL Report using ##SVCurrentCompany system variable — always the active Tally company
const TALLY_CURRENT_COMPANY_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>FP_CurInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="FP_CurInfo"><FORMS>FP_CIF</FORMS></REPORT><FORM NAME="FP_CIF"><PARTS>FP_CIP</PARTS></FORM><PART NAME="FP_CIP"><LINES>FP_CIL</LINES></PART><LINE NAME="FP_CIL"><FIELDS>FP_CIComp,FP_CIStart</FIELDS></LINE><FIELD NAME="FP_CIComp"><SET>##SVCurrentCompany</SET><XMLTAG>CURRENTCOMPANY</XMLTAG></FIELD><FIELD NAME="FP_CIStart"><SET>##SVFromDate</SET><XMLTAG>CURRENTCOMPANYSTART</XMLTAG></FIELD></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

async function checkTally(): Promise<TallyStatus & { _raw: string }> {
  try {
    const port = typeof window !== "undefined" ? (localStorage.getItem("fw_tally_port") ?? "7001") : "7001";
    const url = `http://localhost:${port}`;
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "text/xml" }, body: TALLY_CURRENT_COMPANY_XML,
      signal: AbortSignal.timeout(3000),
    });
    const text = await res.text();
    // Primary: <CURRENTCOMPANY> tag from $$CurrentCompany system function
    const parsed = (text.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i) ?? [])[1]?.trim()
      ?? parseTallyCompanyName(text);
    // Always use live response; only fall back to cache if Tally returned nothing
    if (parsed?.length >= 2) {
      try { localStorage.setItem("fw_tally_company", parsed); } catch { /* */ }
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem("fw_tally_company") ?? "" : "";
    const company = parsed?.length >= 2 ? parsed : (stored.length >= 2 ? stored : "Tally");
    return { state: "connected", company, _raw: text.slice(0, 800) };
  } catch (e) {
    return { state: "disconnected", company: "", _raw: String(e) };
  }
}



type Business = { id: string; name: string; gstin: string | null; gst_registration_type: string; state: string | null };
type Stats = { sales: number; expenses: number; drafts: number; pendingTds: number; revenue: number; profit: number; tallyLive?: boolean; totalPosted: number };

const QUICK = [
  { icon: "🧾", label: "New Invoice",    href: "/finance/sales/new",     color: "#8A5A00" },
  { icon: "📦", label: "Purchase Bill",  href: "/finance/purchases/new", color: "#1F5EFF" },
  { icon: "💸", label: "Record Expense", href: "/finance/expenses",      color: "#5B4BC4" },
  { icon: "📤", label: "Upload Doc",     href: "/finance/upload",        color: "#0B7A55" },
  { icon: "💳", label: "Payment Entry",  href: "/finance/payment",       color: "#B4561E" },
  { icon: "🛩️", label: "Ask FrePilot",  href: "/finance/virtual-ca",    color: "#8A5A00" },
];

const MODULES = [
  { group: "Reports", items: [
    { icon: "🔍", label: "Audit & Reports",     desc: "Trial balance, P&L, Balance Sheet, audit flags", href: "/finance/audit",          accent: "#0B7A55" },
    { icon: "📈", label: "P&L / Reports",      desc: "Income statement, balance sheet, cash flow", href: "/finance/reports",           accent: "#0B7A55" },
    { icon: "🏛️", label: "GST Returns",        desc: "GSTR-1, GSTR-3B — auto-prepared",           href: "/finance/gst",               accent: "#1F5EFF" },
    { icon: "🔖", label: "TDS Tracker",         desc: "Section-wise TDS, due dates, calculator",   href: "/finance/tds",               accent: "#8A5A00" },
  ]},
  { group: "Books", items: [
    { icon: "📒", label: "Journal Entries",    desc: "Double-entry ledger — Dr = Cr enforced",     href: "/finance/journals",          accent: "#5B4BC4" },
    { icon: "🔴", label: "Credit Notes",       desc: "Issue CN to customers — sales returns",      href: "/finance/credit-note",       accent: "#C2321F" },
    { icon: "🟢", label: "Debit Notes",        desc: "Issue DN to vendors — purchase returns",     href: "/finance/debit-note",        accent: "#0B7A55" },
  ]},
  { group: "Receivables & Payables", items: [
    { icon: "📥", label: "Receivables (AR)",   desc: "Who owes you money, aging report",           href: "/finance/receivables",       accent: "#0B7A55" },
    { icon: "📤", label: "Payables (AP)",       desc: "Who you owe, vendor aging",                 href: "/finance/payables",          accent: "#C2321F" },
    { icon: "🏦", label: "Bank Reconciliation", desc: "Import CSV, auto-match entries",            href: "/finance/banking",           accent: "#1F5EFF" },
  ]},
  { group: "AI & Automation", items: [
    { icon: "🤖", label: "Chat Bookkeeping",   desc: "Type or photo a bill — AI books instantly",  href: "/finance/chat-book",         accent: "#232A63" },
    { icon: "💬", label: "WhatsApp Bot",       desc: "Book transactions via WhatsApp message",     href: "/finance/whatsapp",          accent: "#25D366" },
    { icon: "🧾", label: "E-Invoice (IRN)",   desc: "Build IRP-compliant JSON, generate IRN",     href: "/finance/einvoice",          accent: "#1F5EFF" },
  ]},
  { group: "HR & Compliance", items: [
    { icon: "👔", label: "Payroll",            desc: "Salary slips, PF, ESI, PT, TDS auto-calc",  href: "/finance/payroll",           accent: "#5B4BC4" },
    { icon: "🏢", label: "CA Dashboard",      desc: "Manage multiple clients from one screen",    href: "/finance/ca-dashboard",      accent: "#0B7A55" },
  ]},
  { group: "Setup", items: [
    { icon: "🔄", label: "Tally Sync",         desc: "Export/Import as Tally-compatible XML",     href: "/finance/tally",             accent: "#B4561E" },
    { icon: "👥", label: "Contacts",            desc: "Customers & vendors with opening balances", href: "/finance/contacts",          accent: "#5B4BC4" },
    { icon: "📊", label: "Chart of Accounts",  desc: "Indian account heads structure",             href: "/finance/chart-of-accounts", accent: "#1F5EFF" },
  ]},
];

export default function FrePilotDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [stats, setStats] = useState<Stats>({ sales: 0, expenses: 0, drafts: 0, pendingTds: 0, revenue: 0, profit: 0, totalPosted: 0 });
  const [loading, setLoading] = useState(true);
  const [fyLabel, setFyLabel] = useState("2025-26");
  const [fyId, setFyId] = useState<string | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashErr, setDashErr] = useState("");
  const [command, setCommand] = useState("");
  const [dashTick, setDashTick] = useState(0);
  const [periodKey, setPeriodKey] = useState("fy");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [missingFy, setMissingFy] = useState<{ label: string; start: string; end: string } | null>(null);
  // The app-wide Tally connection (set up on the Tally page)
  const shared = useTally();
  const tally: TallyStatus = { state: shared.status === "connected" ? "connected" : shared.status === "connecting" ? "checking" : shared.status === "error" ? "disconnected" : "idle", company: shared.company };
  const [tallySyncing, setTallySyncing] = useState<"ledgers" | "vouchers" | null>(null);
  const [tallySyncMsg, setTallySyncMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tallySyncProgress, setTallySyncProgress] = useState<string | null>(null);
  const [hindi, setHindi] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "" });
      loadBusinesses(u.id);
    });
  }, []);

  // Auto-sync: at most once every 60 minutes per business, stored in localStorage
  const AUTO_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (tally.state === "connected" && activeBiz && !tallySyncing && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      if (user) loadStats(activeBiz.id, user.id);
      // Auto-sync: always run if there are unsynced months; otherwise respect 1-hr cooldown
      const syncedMonthsKey = `fw_tally_synced_months_${activeBiz.id}`;
      const synced: string[] = JSON.parse(localStorage.getItem(syncedMonthsKey) ?? "[]");
      const today = new Date();
      const fyStart = today.getMonth() >= 3 ? `${today.getFullYear()}-04` : `${today.getFullYear()-1}-04`;
      // Count expected months (Apr to current month)
      const startYear = parseInt(fyStart.slice(0,4)), startMonth = parseInt(fyStart.slice(5))-1;
      const expectedMonths = (today.getFullYear()-startYear)*12 + today.getMonth() - startMonth + 1;
      const hasMissingMonths = synced.length < expectedMonths - 1; // -1 because current month is always re-fetched
      const lsKey = `fw_tally_last_sync_${activeBiz.id}`;
      const lastSync = parseInt(localStorage.getItem(lsKey) ?? "0", 10);
      if (hasMissingMonths || Date.now() - lastSync > AUTO_SYNC_COOLDOWN_MS) {
        localStorage.setItem(lsKey, String(Date.now()));
        // Check if journals exist but lines are missing (orphaned headers from interrupted import)
        // If so, clear synced-months so all months get re-fetched
        supabase.from("fw_fin_journals").select("id", { count: "exact", head: true })
          .eq("business_id", activeBiz.id).eq("status", "posted").like("entry_no", "TLY-%")
          .then(({ count: jCount }) => {
            supabase.from("fw_fin_journal_lines").select("id", { count: "exact", head: true })
              .in("journal_id",
                // Use a subquery approach: if jCount > 0 but lines ~= 0, clear and re-sync
                [] // placeholder — check via separate query below
              ).then(() => {});
            if ((jCount ?? 0) > 10) {
              supabase.from("fw_fin_journals").select("id").eq("business_id", activeBiz.id)
                .eq("status", "posted").like("entry_no", "TLY-%").limit(5)
                .then(({ data: sample }) => {
                  if (!sample?.length) return;
                  supabase.from("fw_fin_journal_lines").select("id", { count: "exact", head: true })
                    .in("journal_id", sample.map(j => j.id))
                    .then(({ count: lCount }) => {
                      (async () => {
                        if ((lCount ?? 0) === 0) {
                          // Journals exist but no lines → orphaned headers from broken import
                          // Silently delete them all so doImportVouchers can re-import fresh
                          setTallySyncProgress("Auto-healing: clearing orphaned entries…");
                          const { data: allOrphans } = await supabase.from("fw_fin_journals")
                            .select("id").eq("business_id", activeBiz.id).like("entry_no", "TLY-%");
                          if (allOrphans?.length) {
                            for (let oi = 0; oi < allOrphans.length; oi += 100) {
                              const ids = allOrphans.slice(oi, oi + 100).map((j: {id: string}) => j.id);
                              await supabase.from("fw_fin_journal_lines").delete().in("journal_id", ids);
                              await supabase.from("fw_fin_journals").delete().in("id", ids);
                            }
                          }
                          localStorage.removeItem(syncedMonthsKey);
                        }
                        doImportVouchers(false);
                      })();
                    });
                });
            } else {
              doImportVouchers(false);
            }
          });
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

  // Fetch revenue & net profit DIRECTLY from Tally closing balances — exact P&L mirror
  async function fetchTallyPL(fromDate: string, toDate: string): Promise<{ revenue: number; profit: number } | null> {
    try {
      const fd = fromDate.replace(/-/g, ""), td = toDate.replace(/-/g, "");
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_PLBals</ID></HEADER><BODY><DESC><STATICVARIABLES><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_PLBals" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent,ClosingBalance</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const res = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      // Parse: <LEDGER NAME="Sales Accounts"><PARENT>...</PARENT><CLOSINGBALANCE>1234.56 Cr</CLOSINGBALANCE></LEDGER>
      let revenue = 0, totalExp = 0;
      const ledgerRe = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
      let m: RegExpExecArray | null;
      while ((m = ledgerRe.exec(text)) !== null) {
        const block = m[2];
        const parent = (block.match(/<PARENT[^>]*>([^<]*)<\/PARENT>/i) ?? [])[1]?.trim() ?? "";
        const balRaw = (block.match(/<CLOSINGBALANCE[^>]*>([^<]*)<\/CLOSINGBALANCE>/i) ?? [])[1]?.trim() ?? "";
        if (!balRaw) continue;
        // Tally format: "31143466400.00 Cr" or "-100.00 Dr"
        const parts = balRaw.split(/\s+/);
        const amt = Math.abs(parseFloat(parts[0].replace(/,/g, "")) || 0);
        const side = (parts[1] ?? "").toUpperCase(); // "CR" or "DR"
        const acType = tallyParentToType(parent);
        if (acType === "income") {
          // Income ledger: credit balance = revenue; debit = negative (returns)
          revenue += side === "CR" ? amt : -amt;
        } else if (acType === "expense") {
          // Expense ledger: debit balance = cost; credit = negative (expense returns)
          totalExp += side === "DR" ? amt : -amt;
        }
      }
      if (revenue === 0) return null; // Tally returned nothing useful
      return { revenue, profit: revenue - totalExp };
    } catch { return null; }
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
    // Derive current Indian FY start from today: Apr-Mar year
    const today = new Date();
    const curFyStart = today.getMonth() >= 3
      ? `${today.getFullYear()}-04-01`
      : `${today.getFullYear() - 1}-04-01`;
    // Today's year wins; the Tally sync year is only a fallback
    const todayIso = today.toLocaleDateString("en-CA");
    const activeFy = selectedFyId
      ? allFys.find(f => f.id === selectedFyId)
      : allFys.find(f => f.start_date <= todayIso && f.end_date >= todayIso)
        ?? allFys.find(f => f.start_date === curFyStart)
        ?? (tallyFyId ? allFys.find(f => f.id === tallyFyId) : undefined)
        ?? allFys.find(f => f.is_current)
        ?? allFys[0];
    const curStartYear = +curFyStart.slice(0, 4);
    setMissingFy(allFys.some(f => f.start_date <= todayIso && f.end_date >= todayIso) ? null : { label: `${curStartYear}-${String(curStartYear + 1).slice(2)}`, start: curFyStart, end: `${curStartYear + 1}-03-31` });
    if (activeFy) { setFyLabel(activeFy.label); setFyId(activeFy.id); }

    // 2. Count journals by date range (for counts + drafts)
    let jq = supabase.from("fw_fin_journals")
      .select("id,type,status,date,total_debit,total_credit").eq("business_id", bizId).neq("status", "voided");
    if (activeFy?.start_date) jq = jq.gte("date", activeFy.start_date);
    if (activeFy?.end_date)   jq = jq.lte("date", activeFy.end_date);
    const { data: jData } = await jq;
    const journals = jData ?? [];
    const posted = journals.filter(j => j.status === "posted");
    const postedIds = posted.map(j => j.id);

    // 3. Revenue & Net Profit via journal_lines across ALL voucher types
    //    (covers standard "Sales" AND custom Tally types like "Export Sales", "Local Sales" etc.)
    let salesRev = 0, expTotal = 0;
    if (postedIds.length > 0) {
      const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts")
        .select("id,name,type").eq("business_id", bizId);
      const accMap = new Map((accounts ?? []).map(a => [a.id, { type: a.type as string, name: (a.name as string).toLowerCase() }]));

      // Income: type="income"/"sales" OR name matches sales/export patterns
      const isIncome = (id: string) => {
        const a = accMap.get(id);
        if (!a) return false;
        if (a.type === "income" || a.type === "sales") return true;
        const n = a.name;
        // Explicit BS account exclusions (even if wrongly typed as income)
        if (n.includes("payable") || n.includes("receivable") || n.includes("debtor") ||
            n.includes("creditor") || n.includes("bank") || n.includes("cash") ||
            n.includes("stock") || n.includes("capital") || n.includes("loan")) return false;
        return n.includes("sales") || n.includes("export") || n.includes("revenue") ||
               n.includes("income") || n.includes("service") || n.includes("drawback") ||
               n.includes("discount received") || n.includes("commission received") ||
               (n.includes("interest") && n.includes("received"));
      };

      // Expense: type="expense" OR name matches expense patterns — exclude BS accounts
      const isExpense = (id: string) => {
        const a = accMap.get(id);
        if (!a) return false;
        const n = a.name;
        if (n.includes("stock") || n.includes("asset") || n.includes("bank") ||
            n.includes("cash") || n.includes("deposit") || n.includes("loan") ||
            n.includes("payable") || n.includes("gst") || n.includes("tds payable") ||
            n.includes("creditor") || n.includes("debtor") || n.includes("capital") ||
            n.includes("export") || n.includes("sales") || n.includes("income") ||
            n.includes("revenue")) return false;
        if (a.type === "expense") return true;
        return n.includes("purchase") || n.includes("direct exp") || n.includes("indirect exp") ||
               n.includes("expense") || n.includes("salary") || n.includes("wages") ||
               n.includes("rent") || n.includes("freight") || n.includes("transport") ||
               n.includes("duties") || n.includes("depreciation") || n.includes("cost of") ||
               n.includes("power") || n.includes("telephone") || n.includes("printing") ||
               n.includes("advertisement") || n.includes("bank charges") || n.includes("audit fee");
      };

      for (let i = 0; i < postedIds.length; i += 200) {
        const { data: lines } = await supabase.from("fw_fin_journal_lines")
          .select("account_id,dr_amount,cr_amount").in("journal_id", postedIds.slice(i, i + 200));
        for (const l of lines ?? []) {
          if (isIncome(l.account_id))  salesRev  += (l.cr_amount || 0) - (l.dr_amount || 0);
          if (isExpense(l.account_id)) expTotal  += (l.dr_amount || 0) - (l.cr_amount || 0);
        }
      }
    }

    setStats(prev => ({
      ...prev,
      sales: posted.filter(j => j.type === "sales").length,
      expenses: posted.filter(j => j.type === "purchase" || j.type === "expense").length,
      drafts: journals.filter(j => j.status === "draft").length,
      pendingTds: 0,
      revenue: salesRev,
      profit: salesRev - expTotal,
      tallyLive: false,
      totalPosted: posted.length,
    }));
    setLoading(false);
  }

  function switchBiz(biz: Business) {
    setActiveBiz(biz);
    if (user) { localStorage.setItem(`fw_fin_biz_${user.id}`, biz.id); loadStats(biz.id, user.id, null); }
  }

  async function createCurrentFy() {
    if (!activeBiz || !user || !missingFy) return;
    if (!window.confirm(`Create financial year ${missingFy.label} (1 Apr ${missingFy.start.slice(0, 4)} – 31 Mar ${missingFy.end.slice(0, 4)})?`)) return;
    const { data, error } = await supabase.from("fw_fin_financial_years").insert({
      business_id: activeBiz.id, label: missingFy.label, start_date: missingFy.start, end_date: missingFy.end, is_current: true, is_locked: false,
    }).select("id").single();
    if (error || !data) { window.alert(`Couldn't create the year: ${error?.message ?? "unknown error"}`); return; }
    await supabase.from("fw_fin_financial_years").update({ is_current: false }).eq("business_id", activeBiz.id).neq("id", data.id);
    setMissingFy(null);
    loadStats(activeBiz.id, user.id, data.id);
  }

  function switchFy(selectedId: string) {
    if (selectedId === "__create") { createCurrentFy(); return; }
    setFyId(selectedId);
    if (activeBiz && user) loadStats(activeBiz.id, user.id, selectedId);
  }

  const tallyUrl = `http://localhost:${typeof window !== "undefined" ? (localStorage.getItem("fw_tally_port") ?? "7001") : "7001"}`;

  function doDisconnectTally() {
    ["fw_tally_company","fw_tally_port","fw_tally_fy_id"].forEach(k => localStorage.removeItem(k));
    if (activeBiz) {
      localStorage.removeItem(`fw_tally_last_sync_${activeBiz.id}`);
      sessionStorage.removeItem(`fw_tally_synced_${activeBiz.id}`);
    }
    disconnectTally();
  }

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

    // Key for tracking which months have been fully synced
    const syncedMonthsKey = `fw_tally_synced_months_${activeBiz.id}`;

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
      localStorage.removeItem(syncedMonthsKey);
    }

    const stored = typeof window !== "undefined" ? localStorage.getItem("fw_tally_fy_id") : null;
    const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,start_date,end_date").eq("business_id", activeBiz.id).order("start_date", { ascending: false });
    const activeFy = stored ? fys?.find(f => f.id === stored) : fys?.[0];
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = activeFy?.start_date ?? `${new Date().getFullYear()}-04-01`;
    // Only sync up to today — no point fetching future months
    const toDate = (activeFy?.end_date && activeFy.end_date < today) ? activeFy.end_date : today;

    // Build month list
    const months: { from: string; to: string; label: string; key: string }[] = [];
    let cur = new Date(new Date(fromDate).getFullYear(), new Date(fromDate).getMonth(), 1);
    const end = new Date(toDate);
    while (cur <= end) {
      const y = cur.getFullYear(), mo = cur.getMonth();
      const mFrom = `${y}-${String(mo+1).padStart(2,"0")}-01`;
      const mTo = new Date(y, mo+1, 0).toISOString().slice(0,10);
      const mKey = `${y}-${String(mo+1).padStart(2,"0")}`;
      months.push({ from: mFrom, to: mTo < toDate ? mTo : toDate, label: cur.toLocaleString("en-IN", { month: "short", year: "2-digit" }), key: mKey });
      cur = new Date(y, mo+1, 1);
    }

    // Load already-synced months (skip past months that are fully done; always re-fetch current month)
    const syncedMonths: Set<string> = new Set(JSON.parse(localStorage.getItem(syncedMonthsKey) ?? "[]"));
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
    const monthsToFetch = months.filter(m => !syncedMonths.has(m.key) || m.key === currentMonthKey);

    if (!monthsToFetch.length) {
      setTallySyncMsg({ ok: true, msg: "✓ All months already synced. Nothing new to import." });
      setTallySyncing(null); setTallySyncProgress(null); return;
    }

    const allVouchers: ReturnType<typeof parseTallyVouchersLocal> = [];
    for (let i = 0; i < monthsToFetch.length; i++) {
      const { from: mf, to: mt, label, key: mKey } = monthsToFetch[i];
      setTallySyncProgress(`Fetching ${label} (${i+1}/${monthsToFetch.length})…`);
      const fd = mf.replace(/-/g,""), td = mt.replace(/-/g,"");
      const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      try {
        const r = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml, signal: AbortSignal.timeout(30000) });
        const fetched = parseTallyVouchersLocal(await r.text());
        allVouchers.push(...fetched);
        // Mark past months as synced once fetched successfully
        if (mKey !== currentMonthKey) { syncedMonths.add(mKey); localStorage.setItem(syncedMonthsKey, JSON.stringify([...syncedMonths])); }
      } catch { /* skip failed month — will retry next auto-sync */ }
      if (i < monthsToFetch.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    if (!allVouchers.length) { setTallySyncMsg({ ok: true, msg: "✓ No new vouchers found — data is up to date." }); setTallySyncing(null); setTallySyncProgress(null); return; }

    // Import through FreWork's posting engine (validation, year locks, audit log, duplicate-safe numbering)
    try {
      const groups = await readTallyLedgerGroups(tallyUrl, tally.company || null);
      const sum = await importTallyVouchers(activeBiz.id, allVouchers as TallyVoucher[], { ledgerGroups: groups, company: tally.company || null, onProgress: setTallySyncProgress });
      setTallySyncMsg({ ok: sum.failedCount === 0, msg: summaryText(sum) });
    } catch (e) {
      setTallySyncMsg({ ok: false, msg: e instanceof Error ? e.message : "Import failed." });
    }
    // Update last-sync timestamp so auto-sync cooldown resets after a manual import
    if (activeBiz) localStorage.setItem(`fw_tally_last_sync_${activeBiz.id}`, String(Date.now()));
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

  // Live figures from posted entries (same engine as the reports)
  useEffect(() => {
    if (!activeBiz) return;
    let cancelled = false;
    setDash(null); setDashErr("");
    const pr = periodRange(periodKey, custom);
    if (periodKey === "custom" && !pr) return;
    fetch(`/api/finance/dashboard?business_id=${activeBiz.id}${fyId ? `&fy_id=${fyId}` : ""}${pr ? `&from=${pr.from}&to=${pr.to}&label=${encodeURIComponent(pr.label)}` : ""}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "We couldn't load your dashboard right now."); return d; })
      .then(d => { if (!cancelled) setDash(d); })
      .catch(e => { if (!cancelled) setDashErr(e instanceof Error ? e.message : "We couldn't load your dashboard right now."); });
    return () => { cancelled = true; };
  }, [activeBiz, fyId, dashTick, periodKey, custom]);
  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (!loading && businesses.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#F6F1E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem", fontFamily: "'Manrope',system-ui,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: "3rem", color: "#B4501E", marginBottom: "1rem", fontStyle: "italic", fontWeight: 500 }}>FrePilot</div>
        <h1 style={{ fontFamily: "'Lora',Georgia,serif", fontSize: "1.75rem", fontWeight: 600, color: "#2B2214", margin: "0 0 0.75rem" }}>Welcome to your accounting desk</h1>
        <p style={{ color: "#847457", fontSize: "1rem", maxWidth: 380, lineHeight: 1.7, margin: "0 0 2.5rem" }}>Your AI accountant is ready. Set up your business in 2 minutes.</p>
        <Link href="/finance/setup" style={{ background: "#B4501E", color: "#FFFDF8", padding: "12px 36px", borderRadius: 2, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Set Up My Business →
        </Link>
      </div>
    );
  }

  const WE = {
    bg: "#F6F1E7", surface: "#FFFFFF", surfaceAlt: "#EFE8D9", border: "#E6DFD0",
    ink: "#10241F", inkSoft: "#5E6B66", accent: "#0F2B25", rule: "#E6DFD0",
    green: "#0B7A55", blue: "#0F2B25",
  };

  return (
    <div style={{ minHeight: "100vh", background: WE.bg, color: WE.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .we-serif { font-family: 'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif; font-style: normal !important; font-weight: 700; }
        .we-nav-link { display:flex;align-items:center;gap:10px;padding:8px 10px 8px 13px;color:${WE.ink};font-size:13.5px;text-decoration:none;transition:color 0.15s; }
        .we-nav-link:hover { color:${WE.accent}; }
        .we-nav-active { display:flex;align-items:center;gap:10px;padding:8px 10px;border-left:3px solid ${WE.accent};background:${WE.surface};color:${WE.accent};font-size:13.5px;font-weight:600;text-decoration:none; }
        .we-kpi { padding:22px;cursor:pointer;text-decoration:none;display:block;transition:background 0.15s; }
        .we-kpi:hover { background:${WE.surface}; }
        .we-quick { background:${WE.surface};border-right:1px solid ${WE.rule};border-bottom:1px solid ${WE.rule};padding:16px 8px;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:11.5px;font-weight:600;color:${WE.ink};text-decoration:none;transition:background 0.15s; }
        .we-quick:hover { background:${WE.surfaceAlt}; }
        .we-mod { background:${WE.surface};border-right:1px solid ${WE.rule};border-bottom:1px solid ${WE.rule};padding:16px 18px;display:flex;align-items:flex-start;gap:12px;text-decoration:none;transition:background 0.15s; }
        .we-mod:hover { background:${WE.surfaceAlt}; }
        select option { background:${WE.surface}; color:${WE.ink}; }
        @media (max-width: 760px) { .we-desk { grid-template-columns: 1fr !important; } main { padding: 20px 16px !important; } }
        @keyframes tp-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background:${WE.rule}; border-radius: 4px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, padding: "36px 48px", display: "flex", flexDirection: "column", gap: 26, overflowY: "auto" }}>
          {activeBiz && (
            <>
              <HomeDesk dash={dash} bizName={activeBiz.name} greeting={greeting} dashErr={dashErr} onRetry={() => setDashTick(t => t + 1)}
                controls={<>
                  <select value={activeBiz?.id ?? ""} onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }} title="Business"
                    style={{ height: 40, background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 11, padding: "0 10px", fontSize: 13, color: "#141A3A", maxWidth: 200 }}>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select value={fyId ?? ""} onChange={e => switchFy(e.target.value)} title="Financial year"
                    style={{ height: 40, background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 11, padding: "0 10px", fontSize: 13, color: "#141A3A" }}>
                    {financialYears.map(f => <option key={f.id} value={f.id}>FY {f.label}</option>)}
                    {financialYears.length === 0 && <option value="">FY {fyLabel}</option>}
                    {missingFy && <option value="__create">＋ FY {missingFy.label} — create</option>}
                  </select>
                  <select value={periodKey} onChange={e => setPeriodKey(e.target.value)} title="Period"
                    style={{ height: 40, background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 11, padding: "0 10px", fontSize: 13, color: "#141A3A" }}>
                    {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  {periodKey === "custom" && <>
                    <input type="date" aria-label="From" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} style={{ height: 40, border: "1px solid #E1E4EE", borderRadius: 11, padding: "0 8px", fontSize: 13, color: "#141A3A", background: "#FFFFFF" }} />
                    <input type="date" aria-label="To" value={custom.to} min={custom.from || undefined} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} style={{ height: 40, border: "1px solid #E1E4EE", borderRadius: 11, padding: "0 8px", fontSize: 13, color: "#141A3A", background: "#FFFFFF" }} />
                  </>}
                  <Link href="/finance/tally" style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1px solid #C9CEDF", color: "#141A3A", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", textDecoration: "none" }}>Tally</Link>
                </>} />

              {/* All Modules */}
              <div style={{ position: "relative", zIndex: 1 }}>
                <details><summary className="we-serif" style={{ fontSize: 15, fontStyle: "italic", color: WE.inkSoft, marginBottom: 10, cursor: "pointer" }}>{hindi ? "सभी मॉड्यूल" : "All modules"}</summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", borderTop: `1px solid ${WE.rule}`, borderLeft: `1px solid ${WE.rule}` }}>
                  {MODULES.flatMap(g => g.items).map(m => (
                    <Link key={m.href} href={m.href} className="we-mod">
                      <div style={{ width: 34, height: 34, color: WE.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${WE.accent}`, borderRadius: 2, fontSize: "1rem" }}>{m.icon}</div>
                      <div>
                        <div className="we-serif" style={{ fontSize: 14.5, fontWeight: 600, color: WE.ink }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: WE.inkSoft, marginTop: 3, lineHeight: 1.4 }}>{m.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                </details>
              </div>

              {/* Tally Sync Card */}
              {/* Tally: the same status as every other page; import and push happen on the Tally page */}
              {shared.company && <TallyBar preferName={activeBiz.name} returnTo="/finance" />}
              {tallySyncMsg && <div style={{ fontSize: 12, color: tallySyncMsg.ok ? WE.green : "#8A6D3B" }}>{tallySyncMsg.msg}</div>}

              <div style={{ fontSize: 11, color: WE.rule, textAlign: "center", paddingTop: 8 }}>
                FrePilot · FY {fyLabel} · {activeBiz.name}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}