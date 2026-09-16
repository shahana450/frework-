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
  { group: "AI & Automation", items: [
    { icon: "🤖", label: "Chat Bookkeeping",   desc: "Type or photo a bill — AI books instantly",  href: "/finance/chat-book",         accent: "#C9A84C" },
    { icon: "💬", label: "WhatsApp Bot",       desc: "Book transactions via WhatsApp message",     href: "/finance/whatsapp",          accent: "#25D366" },
    { icon: "🧾", label: "E-Invoice (IRN)",   desc: "Build IRP-compliant JSON, generate IRN",     href: "/finance/einvoice",          accent: "#60A5FA" },
  ]},
  { group: "HR & Compliance", items: [
    { icon: "👔", label: "Payroll",            desc: "Salary slips, PF, ESI, PT, TDS auto-calc",  href: "/finance/payroll",           accent: "#A78BFA" },
    { icon: "🏢", label: "CA Dashboard",      desc: "Manage multiple clients from one screen",    href: "/finance/ca-dashboard",      accent: "#34D399" },
  ]},
  { group: "Setup", items: [
    { icon: "🔄", label: "Tally Sync",         desc: "Export/Import as Tally-compatible XML",     href: "/finance/tally",             accent: "#FB923C" },
    { icon: "👥", label: "Contacts",            desc: "Customers & vendors with opening balances", href: "/finance/contacts",          accent: "#A78BFA" },
    { icon: "📊", label: "Chart of Accounts",  desc: "Indian account heads structure",             href: "/finance/chart-of-accounts", accent: "#60A5FA" },
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
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [tally, setTally] = useState<TallyStatus>({ state: "idle", company: "" });
  const [tallySyncing, setTallySyncing] = useState<"ledgers" | "vouchers" | null>(null);
  const [tallySyncMsg, setTallySyncMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tallySyncProgress, setTallySyncProgress] = useState<string | null>(null);
  const [hindi, setHindi] = useState(false);

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
    const activeFy = selectedFyId
      ? allFys.find(f => f.id === selectedFyId)
      : (tallyFyId ? allFys.find(f => f.id === tallyFyId) : undefined)
        ?? allFys.find(f => f.start_date === curFyStart)
        ?? allFys.find(f => f.is_current)
        ?? allFys[0];
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

  function switchFy(selectedId: string) {
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
    setTally({ state: "disconnected", company: "" });
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

    const { data: accounts } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", activeBiz.id);
    const accountMap = new Map((accounts ?? []).map(a => [a.name.toLowerCase(), a]));
    // Build a map of ledger name → voucher type context to infer account type correctly
    const ledgerVoucherContext = new Map<string, string>();
    for (const v of allVouchers) for (const l of v.lines) ledgerVoucherContext.set(l.ledgerName, v.voucherType);
    const missing = new Set<string>();
    for (const v of allVouchers) for (const l of v.lines) if (!accountMap.has(l.ledgerName.toLowerCase())) missing.add(l.ledgerName);
    if (missing.size) {
      const newAcc = Array.from(missing).map((name, i) => {
        const ctx = ledgerVoucherContext.get(name) ?? "";
        // Use voucher type context: Sales voucher credit side → income; Purchase debit side → expense
        let type: string = tallyParentToType(name);
        if (ctx === "Sales" || ctx === "Credit Note") type = "income";
        else if (ctx === "Purchase" || ctx === "Debit Note") type = "expense";
        return { business_id: activeBiz.id, code: `TI${String((accounts?.length ?? 0)+i+1).padStart(3,"0")}`, name, type, description: "From Tally", is_system: false, is_group: false, sort_order: (accounts?.length ?? 0)+i+1 };
      });
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
      // Skip already-imported vouchers (dedup by entry_no)
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
      const lines = v.lines.map(l => { const acc = accountMap.get(l.ledgerName.toLowerCase()); if (!acc) return null; return { journal_id: jRow.id, account_id: acc.id, narration: l.ledgerName, dr_amount: l.isDeemed ? l.amount : 0, cr_amount: l.isDeemed ? 0 : l.amount }; }).filter(Boolean);
      if (lines.length > 0) {
        await supabase.from("fw_fin_journal_lines").insert(lines as {journal_id:string;account_id:string;narration:string;dr_amount:number;cr_amount:number}[]);
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
    <div style={{ minHeight: "100vh", background: "#0A0D14", color: "#E2E8F0", fontFamily: "Inter,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .fp-kpi { background: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 1.25rem; transition: border-color 0.15s; }
        .fp-kpi:hover { border-color: #374151; }
        .fp-quick { background: #111827; border: 1px solid #1F2937; border-radius: 8px; padding: 0.625rem 1rem; display: flex; align-items: center; gap: 0.5rem; text-decoration: none; transition: all 0.15s; white-space: nowrap; }
        .fp-quick:hover { background: #1F2937; }
        .fp-mod { background: #111827; border: 1px solid #1F2937; border-radius: 10px; padding: 0.875rem 1rem; display: flex; gap: 0.75rem; align-items: flex-start; text-decoration: none; transition: border-color 0.15s; }
        .fp-mod:hover { border-color: #374151; }
        select option { background: #111827; }
        @keyframes tp-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 4px; }
      `}</style>

      <nav style={{ background: "#0A0D14", borderBottom: "1px solid #1F2937", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", height: 52, position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginRight: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#1E40AF,#CA8A04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>🛩️</div>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#F1F5F9" }}>FrePilot</span>
        </div>
        <div style={{ width: 1, height: 18, background: "#1F2937" }} />
        <select value={activeBiz?.id ?? ""} onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
          style={{ background: "transparent", border: "none", color: "#E2E8F0", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 180 }}>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={fyId ?? ""} onChange={e => switchFy(e.target.value)}
          style={{ background: "transparent", border: "none", color: "#6B7280", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          {financialYears.map(f => <option key={f.id} value={f.id}>FY {f.label}</option>)}
          {financialYears.length === 0 && <option value="">FY {fyLabel}</option>}
        </select>
        <div style={{ flex: 1 }} />
        {tally.state === "connected" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 20, overflow: "hidden", border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.07)" }}>
            <Link href="/finance/tally" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", textDecoration: "none" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399", animation: "tp-pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#34D399" }}>{tally.company}</span>
            </Link>
            <button onClick={doDisconnectTally} style={{ background: "transparent", border: "none", borderLeft: "1px solid rgba(52,211,153,0.2)", color: "#6B7280", fontSize: "0.7rem", padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
        ) : (
          <Link href="/finance/tally" style={{ fontSize: "0.75rem", color: "#6B7280", textDecoration: "none", border: "1px solid #1F2937", padding: "4px 10px", borderRadius: 20 }}>Tally Sync</Link>
        )}
        <button onClick={() => setHindi(h => !h)} style={{ background: hindi ? "rgba(201,168,76,0.12)" : "transparent", border: "1px solid #1F2937", color: hindi ? "#C9A84C" : "#6B7280", padding: "4px 10px", borderRadius: 20, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          {hindi ? "EN" : "हिं"}
        </button>
        <Link href="/finance/ca-dashboard" style={{ fontSize: "0.72rem", color: "#6B7280", textDecoration: "none", border: "1px solid #1F2937", padding: "4px 10px", borderRadius: 20 }}>CA View</Link>
        <Link href="/finance/virtual-ca" style={{ background: "#1E3A5F", color: "#93C5FD", padding: "5px 12px", borderRadius: 8, fontSize: "0.75rem", textDecoration: "none", fontWeight: 600 }}>{hindi ? "फ्रीपायलट पूछें" : "Ask FrePilot"}</Link>
        <Link href="/finance/setup" style={{ color: "#4B5563", fontSize: "1rem", textDecoration: "none" }}>⚙</Link>
      </nav>

      <div style={{ minHeight: "calc(100vh - 52px)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
          {activeBiz && (
            <>
              {/* Header */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#4B5563", marginBottom: "0.2rem" }}>{greeting}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#F1F5F9" }}>{activeBiz.name}</h1>
                  {activeBiz.gstin && <span style={{ fontSize: "0.7rem", color: "#4B5563", fontFamily: "'JetBrains Mono',monospace", background: "#111827", border: "1px solid #1F2937", padding: "2px 8px", borderRadius: 5 }}>GSTIN {activeBiz.gstin}</span>}
                  {loading && <span style={{ fontSize: "0.75rem", color: "#4B5563" }}>Loading…</span>}
                </div>
              </div>

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: hindi ? "राजस्व" : "Revenue", value: loading ? "—" : fmt(stats.revenue), color: "#34D399", sub: `FY ${fyLabel}`, mono: true, href: "/finance/journals?type=sales,receipt&status=posted" },
                  { label: hindi ? "शुद्ध लाभ" : "Net Profit", value: loading ? "—" : (stats.profit < 0 ? "−" : "") + fmt(stats.profit), color: stats.profit >= 0 ? "#34D399" : "#F87171", sub: stats.profit < 0 ? (hindi ? "शुद्ध हानि" : "Net loss") : (hindi ? "शुद्ध लाभ" : "Net profit"), mono: true, href: "/finance/audit" },
                  { label: hindi ? "कुल प्रविष्टियाँ" : "Total Entries", value: loading ? "—" : String(stats.totalPosted), color: "#60A5FA", sub: hindi ? "पोस्ट जर्नल" : "Posted journals", mono: false, href: "/finance/journals?status=posted" },
                  { label: hindi ? "मसौदे" : "Drafts", value: loading ? "—" : String(stats.drafts), color: stats.drafts > 0 ? "#F59E0B" : "#4B5563", sub: stats.drafts > 0 ? (hindi ? "समीक्षा आवश्यक" : "Needs review") : (hindi ? "सब ठीक" : "All clear"), mono: false, href: "/finance/journals?status=draft" },
                ].map(k => (
                  <Link key={k.label} href={k.href} className="fp-kpi" style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ fontSize: "0.65rem", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.625rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.375rem", fontWeight: 700, color: k.color, fontFamily: k.mono ? "'JetBrains Mono',monospace" : "inherit", letterSpacing: "-0.01em", lineHeight: 1, marginBottom: "0.375rem" }}>{k.value}</div>
                    <div style={{ fontSize: "0.72rem", color: "#374151" }}>{k.sub}</div>
                  </Link>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.65rem", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.625rem" }}>{hindi ? "त्वरित कार्य" : "Quick Actions"}</div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {QUICK.map(q => (
                    <Link key={q.href} href={q.href} className="fp-quick">
                      <span style={{ fontSize: "0.875rem" }}>{q.icon}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#E2E8F0" }}>{q.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Modules — flat 2-column grid */}
              <div style={{ fontSize: "0.65rem", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.625rem", marginTop: "0.25rem" }}>{hindi ? "सभी मॉड्यूल" : "All Modules"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.5rem" }}>
                {MODULES.flatMap(g => g.items).map(m => (
                  <Link key={m.href} href={m.href} className="fp-mod" style={{ textDecoration: "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1F2937", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}>{m.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#E2E8F0", marginBottom: "0.15rem" }}>{m.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "#4B5563", lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Tally Sync Card — shown when connected */}
              {tally.state === "connected" && (
                <div style={{ marginTop: "1.5rem", background: "#111827", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", animation: "tp-pulse 2s ease-in-out infinite" }} />
                      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#34D399" }}>Tally Connected · {tally.company}</span>
                    </div>
                    <Link href="/finance/tally" style={{ fontSize: "0.75rem", color: "#6B7280", textDecoration: "none" }}>Open Tally Sync →</Link>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {[
                      { label: "Import Ledgers", onClick: doImportLedgers, active: tallySyncing === "ledgers" },
                      { label: tallySyncing === "vouchers" ? (tallySyncProgress ?? "Syncing…") : "Import Vouchers", onClick: () => doImportVouchers(false), active: tallySyncing === "vouchers" },
                      { label: "Fix Duplicates", onClick: doFixDuplicates, active: false },
                    ].map(b => (
                      <button key={b.label} onClick={b.onClick} disabled={!!tallySyncing}
                        style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #1F2937", background: "transparent", color: "#94A3B8", fontSize: "0.8rem", fontWeight: 500, cursor: tallySyncing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: tallySyncing ? 0.5 : 1 }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  {tallySyncMsg && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", fontWeight: 500, color: tallySyncMsg.ok ? "#34D399" : "#FBBF24", padding: "0.5rem 0.75rem", borderRadius: 7, background: tallySyncMsg.ok ? "rgba(16,185,129,0.07)" : "rgba(251,191,36,0.07)", border: `1px solid ${tallySyncMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}` }}>
                      {tallySyncMsg.msg}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: "2rem", fontSize: "0.72rem", color: "#1F2937", textAlign: "center" }}>
                FrePilot · FY {fyLabel} · {activeBiz.name}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
