"use client";
import { setActiveCurrency } from "@/lib/money";
import { financeTitle } from "@/lib/dueText";
import { useState, useEffect, useRef } from "react";
import { useTally, setTallyBusiness } from "@/lib/tallyConnection";
import { useTallyAutoCatchUp, AUTO_PUSH_EVENT } from "@/lib/tallyAutoCatchUp";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { PAYMENTS_LIVE } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@/lib/currentUser";
import { FINANCE_NAV, isActive } from "@/lib/financeNav";
import { FreBookMark } from "@/components/FreBookLogo";
import UpdatePrompt from "@/components/UpdatePrompt";
import { navIconPath } from "@/lib/navIcons";
import { ActiveBusinessProvider, useActiveBusinessStore, setActiveBusiness, readActiveBusiness, getActiveBusiness, rememberedBusiness, tabBusiness } from "@/lib/activeBusiness";


// Navy Prestige type + phone layout for every finance page
const FINANCE_CSS = `
  .fw-topicons { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 2px; overflow-x: auto; margin: 10px 16px 0; padding: 6px; background: rgba(255,255,255,0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid #E6DFD0; border-radius: 18px; box-shadow: 0 10px 28px -20px rgba(15,43,37,0.55); scrollbar-width: none; }
  .fw-topicons::-webkit-scrollbar { display: none; }
  .fw-topicons a { position: relative; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 70px; padding: 7px 10px 8px; border-radius: 13px; text-decoration: none; color: #4A5752; font-size: 11.5px; font-weight: 700; white-space: nowrap; transition: background .18s, color .18s, transform .18s; }
  .fw-topicons a .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: #F4EEE2; color: #0F2B25; transition: background .18s, color .18s, transform .18s; }
  .fw-topicons a:hover, .fw-topicons a:focus-visible { background: #FBF7EE; color: #0F2B25; outline: none; }
  .fw-topicons a:hover .ic { background: #EBDDBF; transform: translateY(-1px); }
  .fw-topicons a:focus-visible { box-shadow: 0 0 0 2px #C99A4E; }
  .fw-topicons a.on { background: linear-gradient(160deg,#1B4237,#0F2B25); color: #FFFFFF; box-shadow: 0 8px 18px -10px rgba(15,43,37,0.7); }
  .fw-topicons a.on .ic { background: rgba(217,181,111,0.18); color: #E8C27A; }
  .fw-topicons a.on::after { content: ""; position: absolute; bottom: 3px; left: 50%; width: 16px; height: 3px; margin-left: -8px; border-radius: 3px; background: #D9B56F; }
  .fw-topicons a.grp { margin-left: 10px; }
  .fw-topicons a.grp::before { content: ""; position: absolute; left: -6px; top: 22%; height: 56%; width: 1px; background: #E6DFD0; }
  @media (max-width: 760px) { .fw-topicons { position: static; margin: 8px 10px 0; border-radius: 16px; padding: 4px; box-shadow: none; } .fw-topicons a { min-width: 58px; padding: 5px 4px 6px; font-size: 10.5px; gap: 3px; } .fw-topicons a .ic { width: 28px; height: 28px; border-radius: 9px; } .fw-topicons a.on::after { bottom: 2px; } }
  @media (prefers-reduced-motion: reduce) { .fw-topicons a, .fw-topicons a .ic { transition: none; } }

@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.fw-main { background: #F6F1E7; min-height: 100vh; }
.fw-main > div:first-child { background-color: #F6F1E7 !important; }
.fw-main h1 { font-family: 'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif; letter-spacing: -0.01em; }
.fw-main table, .fw-main [data-num] { font-variant-numeric: tabular-nums; }
.fw-main input, .fw-main select, .fw-main textarea, .fw-main button { font-family: inherit; }
.fw-main input:focus-visible, .fw-main select:focus-visible, .fw-main textarea:focus-visible, .fw-main button:focus-visible, .fw-main a:focus-visible { outline: 2px solid #0F2B25; outline-offset: 2px; }
.fw-tabs { display: none; }
.fw-nav { transition: background .15s; }
.fw-nav:hover { background: rgba(255,255,255,0.06); color: #FFFFFF !important; }
.fw-nav.on, .fw-nav.on:hover { background: #C99A4E !important; color: #0F2B25 !important; }
.fw-nav:focus-visible { outline: 2px solid #D9B56F; outline-offset: 2px; }
.fw-side::-webkit-scrollbar { width: 6px; } .fw-side::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
.fw-tip { position: fixed; transform: translateY(-50%); background: #0F2B25; border: 1px solid rgba(217,181,111,0.4); color: #FFFFFF; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px; white-space: nowrap; pointer-events: none; z-index: 90; box-shadow: 0 8px 20px -10px rgba(20,26,58,0.6); }
@media (max-width: 760px) {
  .fw-side { display: none !important; }
  .fb-root { height: calc(100dvh - 84px) !important; }
  .fw-main { margin-left: 0 !important; padding-bottom: 84px; }
  .fw-tabs { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); align-items: center; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 8px 8px calc(10px + env(safe-area-inset-bottom)); background: #FFFFFF; border-top: 1px solid #E1E4EE; }
  .fw-tabs a { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #5A6080; text-decoration: none; min-height: 44px; justify-content: center; }
  .fw-tabs a.on { color: #0F2B25; font-weight: 800; }
  .fw-tabs a.plus { justify-self: center; width: 54px; height: 54px; border-radius: 17px; background: #0F2B25; color: #FFFFFF; box-shadow: 0 8px 18px -8px rgba(20,26,58,0.7); }
}
`;

// Labels short enough to sit under an icon on the narrow rail
const SHORT: Record<string, string> = {
  "Dashboard": "Home", "FreBook": "Ask AI", "New Invoice": "Invoice", "Collect Payments": "Collect", "Credit Note": "Credit note", "Debit Note": "Debit note",
  "Customers & Suppliers": "Parties", "Import Statement": "Import", "Bank History": "History", "Books & Tally Push": "Books", "Trial Balance": "TB",
  "Chart of Accounts": "Accounts", "Opening Balances": "Opening", "Audit Log": "Audit log", "Profit & Loss": "P&L", "Balance Sheet": "Bal. sheet",
  "Monthly Recap": "Recap", "Analysis & Audit": "Analysis", "GST Returns": "GST", "GST Reconciliation": "GST recon", "Review Queue": "Review",
  "Upload Documents": "Upload", "FreWork AI": "AI", "Business Details": "Business", "Region & Currency": "Region", "Portal Connect": "Portals",
  "Financial Years": "Years", "Team & Access": "Team", "Tally Sync": "Tally", "CA Dashboard": "CA desk", "New Bill": "New bill",
};
const shortLabel = (l: string) => SHORT[l] ?? l;

const UNGUARDED = ["/finance/pricing", "/finance/setup", "/finance/admin", "/finance/help"];

const TOP_ICONS = [
  { href: "/finance", label: "Home" },
  { href: "/finance/chat-book", label: "FreBook" },
  { href: "/finance/inbox", label: "Smart Inbox" },
  { href: "/finance/sales/new", label: "Invoice" },
  { href: "/finance/purchases/new", label: "Bill" },
  { href: "/finance/books", label: "Books" },
  { href: "/finance/journals", label: "Journal" },
  { href: "/finance/ledger", label: "Ledger" },
  { href: "/finance/banking", label: "Banking" },
  { href: "/finance/receivables", label: "Receivables" },
  { href: "/finance/payables", label: "Payables" },
  { href: "/finance/reports?tab=trial_balance", label: "TB" },
  { href: "/finance/reports?tab=profit_loss", label: "P&L" },
  { href: "/finance/reports?tab=balance_sheet", label: "Balance Sheet" },
  { href: "/finance/gst/returns", label: "GST" },
  { href: "/finance/shelf", label: "Shelf" },
  { href: "/finance/tally", label: "Tally" },
  { href: "/finance/help", label: "Help" },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [bizName, setBizName] = useState("");
  const [bizSwitched, setBizSwitched] = useState<{ from: string; to: string } | null>(null);
  const [india, setIndia] = useState(true);   // GST / TDS / Income-tax menus only for Indian businesses
  const [bizCount, setBizCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  // Collapsed menu opens while the pointer is over it (desktop), and closes when it leaves
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slim = collapsed && !peek;
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const [subChecked, setSubChecked] = useState(false);
  // The app-wide Tally connection (checked once a minute for the whole app)
  const tallyState = useTally();
  const tallyCompany = tallyState.company, tallyConnected = tallyState.status === "connected";
  const [accountant, setAccountant] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [search, setSearch] = useState("");
  // The one active business (Task 6): resolved here, shown in the header, provided to every page
  const active = useActiveBusinessStore();
  useTallyAutoCatchUp(active.businessId, tallyState);
  // A referral link used at sign-up is applied once, now that the account exists
  useEffect(() => {
    let code = ""; try { code = localStorage.getItem("fw_ref") ?? ""; } catch { /* */ }
    if (!code) return;
    fetch("/api/finance/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(r => { if (r.status !== 401) { try { localStorage.removeItem("fw_ref"); } catch { /* */ } } }).catch(() => null);
  }, []);
  const [autoToast, setAutoToast] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setAutoToast((e as CustomEvent).detail); clearTimeout(tm); tm = setTimeout(() => setAutoToast(null), 8000); };
    window.addEventListener(AUTO_PUSH_EVENT, on); return () => { window.removeEventListener(AUTO_PUSH_EVENT, on); clearTimeout(tm); };
  }, []);   // pushes WhatsApp/other-device entries when Auto-push is on

  useEffect(() => { try { setAccountant(localStorage.getItem("fw_nav_mode") === "accountant"); } catch { /* */ } }, []);
  useEffect(() => { setSearch(window.location.search); }, [pathname]);
  useEffect(() => {
    // Waiting-for-review count on the Review Queue item
    currentUser().then(async (user) => {
      if (!user) return;
      const biz = readActiveBusiness(user.id);
      if (!biz) return;
      const { count } = await supabase.from("fw_fin_ai_suggestions").select("id", { count: "exact", head: true }).eq("business_id", biz).eq("status", "pending");
      setReviewCount(count ?? 0);
    });
  }, [pathname, active.businessId]);
  function toggleMode() {
    setAccountant(a => { const next = !a; try { localStorage.setItem("fw_nav_mode", next ? "accountant" : "simple"); } catch { /* */ } return next; });
  }

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;

      // Subscription gate \u2014 skip for unguarded pages
      // Businesses the user owns or was invited to; invited team members work under the owner's plan
      const { data: { session } } = await supabase.auth.getSession();
      const listed = await fetch("/api/finance/businesses", { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } })
        .then(r => r.ok ? r.json() : null).catch(() => null) as { businesses: { id: string; name: string; role?: string }[]; test: { id: string; name: string; role?: string }[] } | null;
      const visible = listed ? [...listed.businesses, ...listed.test] : [];
      const isTeamMember = visible.some(b => b.role && b.role !== "owner");

      // Before payments go live there is no paywall: everyone uses FreBook on the free trial
      if (PAYMENTS_LIVE && !UNGUARDED.some(p => pathname.startsWith(p)) && !isTeamMember) {
        const { data: sub } = await supabase
          .from("fw_fin_subscriptions")
          .select("status,subscription_ends_at")
          .eq("user_id", user.id)
          .in("status", ["active", "trial"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let valid = sub && new Date(sub.subscription_ends_at) > new Date();
        // Access granted by an admin before this account existed is switched on at first sign-in
        if (!valid) {
          const r = await fetch("/api/finance/subscription/claim", { method: "POST" }).then(x => x.json()).catch(() => null);
          valid = !!r?.claimed;
        }
        if (!valid) { router.replace("/finance/pricing"); return; }
      }
      // Resolve the active business BEFORE any page mounts: this tab's current one, else the remembered one,
      // as long as the user can still see it (owner or team member); else their first own business.
      const now = getActiveBusiness();
      const want = (now.userId === user.id && now.businessId) || rememberedBusiness(user.id);
      let owned: { id: string; name: string }[] | null = visible;
      if (!listed) ({ data: owned } = await supabase.from("fw_fin_businesses").select("id,name").eq("owner_id", user.id).order("created_at"));
      setBizCount(owned?.length ?? 0);
      let pick: { id: string; name: string } | null | undefined = owned?.find(b => b.id === want);
      if (!pick && want) {
        // A business the user is a team member of (CA desk, invited accountant) — row level security decides
        const { data: member } = await supabase.from("fw_fin_businesses").select("id,name").eq("id", want).maybeSingle();
        pick = member;
      }
      pick = pick ?? owned?.[0];
      // Never switch silently: if this tab was working in another business, show which one is open now
      const had = tabBusiness(user.id);
      if (pick && had && had !== pick.id) {
        const { data: prev } = await supabase.from("fw_fin_businesses").select("name").eq("id", had).maybeSingle();
        setBizSwitched({ to: pick.name, from: (prev as { name?: string } | null)?.name ?? "the previous business" });
      }
      if (pick) { setActiveBusiness(user.id, pick.id, pick.name); setBizName(pick.name); setTallyBusiness(pick.id); }
      // Money on every page follows this business's currency (set before any page mounts)
      if (pick) { const { data: m } = await supabase.from("fw_fin_businesses").select("currency,country").eq("id", pick.id).maybeSingle(); setActiveCurrency(m?.currency, m?.country); setIndia(!m?.country || m.country === "IN"); }
      setSubChecked(true);
    });
  }, [pathname]);


  // FreBook (Command Desk) and phones get the narrow icon strip; the arrow still expands it
  useEffect(() => {
    setCollapsed(pathname === "/finance" || pathname.startsWith("/finance/chat-book") || window.innerWidth < 760);
  }, [pathname]);

  // Don't show sidebar on setup/pricing/admin pages, and wait for sub check
  if (UNGUARDED.some(p => pathname.startsWith(p))) return <ActiveBusinessProvider>{children}</ActiveBusinessProvider>;
  if (!subChecked) return <div style={{ minHeight: "100vh", background: "#F5F6FA" }} />;

  const sidebarW = collapsed ? 96 : 240;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F6F1E7", color: "#10241F", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <title>{financeTitle(pathname, search, bizName)}</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="description" content="FreBook: chat bookkeeping, GST, reports and Tally sync for your business." />
      <style>{FINANCE_CSS}</style>
      <UpdatePrompt />
      {slim && tip && <span className="fw-tip" role="tooltip" style={{ left: sidebarW + 8, top: tip.top }}>{tip.label}</span>}
      {/* Sidebar */}
      <aside className="fw-side"
        onMouseEnter={() => { if (collapsed && window.matchMedia("(hover: hover) and (min-width: 760px)").matches) { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(true), 180); } }}
        onMouseLeave={() => { clearTimeout(peekTimer.current); setPeek(false); }}
        style={{
        width: slim ? 96 : 240, boxShadow: peek ? "18px 0 40px -20px rgba(0,0,0,0.55)" : "none", flexShrink: 0, background: "#0F2B25",
        borderRight: "1px solid rgba(217,181,111,0.12)", display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40, transition: "width 0.2s",
        overflowY: "auto", overflowX: "hidden",
      }}>
        {/* Logo + collapse */}
        <div style={{ padding: "0 12px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {!slim && (
            <Link href="/finance" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <FreBookMark size={30} />
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}><span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontWeight: 700, fontSize: "1.1rem", color: "#FFFFFF" }}>FreBook</span><span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontStyle: "italic", fontSize: "0.7rem", color: "#D9B56F" }}>Chat in. Books out.</span></span>
            </Link>
          )}
          <button onClick={() => { setPeek(false); setCollapsed(c => !c); }} aria-label={collapsed ? "Pin the menu open" : "Collapse menu"} style={{ width: slim ? 48 : "auto", height: slim ? 48 : "auto", borderRadius: "50%", border: slim ? "1px solid rgba(217,181,111,0.55)" : "none", display: "flex", alignItems: "center", justifyContent: "center", background: "none", color: "#D9B56F", cursor: "pointer", padding: 4, fontSize: "0.9rem", marginLeft: slim ? "auto" : 0, marginRight: slim ? "auto" : 0 }}>
            {slim ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h5a2 2 0 012 2v14a2 2 0 00-2-2H5zM19 4h-5a2 2 0 00-2 2v14a2 2 0 012-2h5z" /></svg> : "←"}
          </button>
        </div>

        {/* Business switcher */}
        {!slim && (
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "0.6rem", color: "#8FA39B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Active Business</div>
            {bizName && (
              bizCount > 1 ? (
                <Link href="/finance/select-business" style={{
                  display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(217,181,111,0.3)",
                  borderRadius: 8, padding: "5px 8px", marginBottom: 6,
                }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{bizName}</span>
                  <span style={{ fontSize: "0.7rem", color: "#D9B56F", flexShrink: 0 }}>⇄</span>
                </Link>
              ) : (
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 0", marginBottom: 6 }}>{bizName}</div>
              )
            )}
            <Link href="/finance/setup" style={{
              display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
              color: "#C9D3CE", fontSize: "0.7rem", fontWeight: 600,
              padding: "4px 6px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.18)",
              transition: "color 0.15s, border-color 0.15s",
            }}>
              <span style={{ fontSize: "0.75rem" }}>＋</span> Add Business
            </Link>
          </div>
        )}

        {/* Tally connection badge */}
        {!slim && tallyCompany && (
          <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Link href="/finance/tally" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${tallyConnected ? "rgba(127,224,180,0.35)" : "rgba(255,255,255,0.14)"}`,
              borderRadius: 8, padding: "5px 8px",
            }}>
              <span style={{ fontSize: "0.55rem", color: tallyConnected ? "#7FE0B4" : "#8FA39B", flexShrink: 0 }}>●</span>
              <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.58rem", color: tallyConnected ? "#7FE0B4" : "#8FA39B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Tally {tallyConnected ? "Connected" : "Disconnected"}
                </div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tallyCompany}
                </div>
              </div>
            </Link>
          </div>
        )}
        {slim && (
          <div style={{ padding: "10px 6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {bizName && (
              <Link href="/finance/select-business" title={`Active business: ${bizName}${bizCount > 1 ? " — switch" : ""}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                <span style={{ position: "relative", width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(145deg,#E8C27A,#B07E33)", color: "#0F2B25", fontWeight: 900, fontSize: "0.85rem", letterSpacing: "0.02em", boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)" }}>
                  {bizName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  {bizCount > 1 && <span aria-hidden="true" style={{ position: "absolute", right: -5, bottom: -5, width: 18, height: 18, borderRadius: 999, background: "#0F2B25", border: "1px solid rgba(217,181,111,0.6)", color: "#D9B56F", fontSize: "0.6rem", display: "grid", placeItems: "center" }}>⇄</span>}
                </span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#FFFFFF", maxWidth: 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bizName}</span>
              </Link>
            )}
            <Link href="/finance/tally" title={tallyCompany ? `Tally: ${tallyCompany} — ${tallyConnected ? "connected" : "not connected"}` : "Connect Tally"} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: `1px solid ${tallyConnected ? "rgba(127,224,180,0.35)" : "rgba(255,255,255,0.14)"}`, fontSize: "0.6rem", fontWeight: 700, color: tallyConnected ? "#7FE0B4" : "#8FA39B" }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />Tally
            </Link>
          </div>
        )}

        {/* Simple / Accountant view */}
        {!slim && (
          <div style={{ padding: "8px 10px 0" }}>
            <button onClick={toggleMode} title="Accountant view shows journal, ledger, trial balance and other advanced pages" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "5px 8px", color: "#E7ECE9", fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>
              <span>{accountant ? "Accountant view" : "Simple view"}</span>
              <span style={{ width: 28, height: 15, borderRadius: 8, background: accountant ? "rgba(217,181,111,0.5)" : "rgba(255,255,255,0.15)", position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: accountant ? 15 : 2, width: 11, height: 11, borderRadius: "50%", background: accountant ? "#D9B56F" : "#C9D3CE", transition: "left 0.15s" }} />
              </span>
            </button>
          </div>
        )}

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {FINANCE_NAV.map(group => {
            const items = group.items.filter(i => (accountant || !i.accountant) && (india || !i.india));
            if (!items.length) return null;
            return (
              <div key={group.label || "top"} style={{ marginBottom: 4 }}>
                {!slim && group.label && (
                  <div style={{ padding: "12px 16px 4px", fontSize: "0.62rem", color: "#8FA39B", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800 }}>
                    {group.label}
                  </div>
                )}
                {slim && group.label && <div aria-hidden="true" style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "10px 18px" }} />}
                {items.map(item => {
                  const active = isActive(item, pathname, search);
                  const badge = item.badge === "review" && reviewCount > 0 ? reviewCount : 0;
                  const isBook = item.href === "/finance/chat-book";
                  return (
                    <Link key={item.href} href={item.href} aria-label={slim ? item.label : undefined} className={`fw-nav${active ? " on" : ""}`}
                      onMouseEnter={e => { if (slim && shortLabel(item.label) !== item.label) { const r = e.currentTarget.getBoundingClientRect(); setTip({ label: item.label, top: r.top + r.height / 2 }); } }}
                      onFocus={e => { if (slim) { const r = e.currentTarget.getBoundingClientRect(); setTip({ label: item.label, top: r.top + r.height / 2 }); } }}
                      onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} style={{
                      display: "flex", flexDirection: slim ? "column" : "row", alignItems: "center", gap: slim ? 4 : 10, position: "relative",
                      margin: slim ? "2px 10px" : "1px 8px", padding: slim ? "9px 2px 8px" : "7px 10px",
                      justifyContent: slim ? "center" : "flex-start", borderRadius: 12,
                      fontSize: slim ? "0.66rem" : "0.82rem", textDecoration: "none",
                      color: active ? "#0F2B25" : "#C9D3CE", fontWeight: active || isBook ? 700 : 500,
                      background: active ? "#C99A4E" : "transparent",
                    }}>
                      <span className="fw-ico" style={{
                        width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        color: active ? "#0F2B25" : isBook ? "#D9B56F" : "inherit",
                      }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={navIconPath(item.href)} /></svg>
                      </span>
                      {slim ? <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>{shortLabel(item.label)}</span> : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>}
                      {badge > 0 && <span style={{ background: "#D9B56F", color: "#0F2B25", fontSize: "0.6rem", fontWeight: 800, padding: "1px 6px", borderRadius: 8, position: slim ? "absolute" : "static", top: -2, right: -4 }}>{badge}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        {/* Bottom links */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0", flexShrink: 0 }}>
          <Link href="/dashboard" title={slim ? "Main Dashboard" : undefined} style={{
            display: "flex", alignItems: "center", gap: slim ? 0 : 8,
            padding: slim ? "8px 0" : "7px 14px",
            justifyContent: slim ? "center" : "flex-start",
            textDecoration: "none", fontSize: "0.78rem", fontWeight: 600,
            color: "#C9D3CE",
            background: "transparent",
            borderLeft: "2px solid rgba(217,181,111,0.5)",
            margin: "0 0 4px",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: "0.9rem" }}>🏠</span>
            {!slim && <span>← Main Dashboard</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      {/* Keyed by business: switching business remounts the page, so it can't keep reading or posting to the old one */}
      {autoToast && (
        <div role="status" aria-live="polite" onClick={() => setAutoToast(null)} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 200, maxWidth: 380, padding: "12px 16px", borderRadius: 12, background: autoToast.ok ? "#0F2B25" : "#FFF4E5", color: autoToast.ok ? "#E9F7F0" : "#8A5A00", border: autoToast.ok ? "1px solid rgba(61,220,151,0.4)" : "1px solid #F2D29B", boxShadow: "0 12px 30px rgba(15,43,37,0.25)", fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.45, cursor: "pointer" }}>
          {autoToast.ok ? "✓ " : "⚠ "}{autoToast.text}
        </div>
      )}
      <main key={active.businessId ?? "none"} className="fw-main" style={{ flex: 1, marginLeft: sidebarW, minWidth: 0, transition: "margin-left 0.2s" }}>
        {/* Main icons along the top (FreBook has its own top bar) */}
        {!pathname.startsWith("/finance/chat-book") && (
          <nav className="fw-topicons" aria-label="Main sections">
            {TOP_ICONS.filter(t => india || !t.href.startsWith("/finance/gst")).map(t => {
              const on = t.href.includes("?") ? pathname + search === t.href : t.href === "/finance" ? pathname === "/finance" : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={[on ? "on" : "", ["/finance/books", "/finance/reports?tab=trial_balance", "/finance/gst/returns"].includes(t.href) ? "grp" : ""].join(" ").trim() || undefined} title={t.label} aria-current={on ? "page" : undefined}>
                  <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={navIconPath(t.href)} /></svg></span>
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
        {bizSwitched && (
          <div role="alert" style={{ margin: "10px 16px 0", padding: "10px 14px", borderRadius: 12, background: "#FFF4DB", border: "1px solid #F2D29B", color: "#5A3A00", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Now working in {bizSwitched.to}</b><span>(was {bizSwitched.from}). Check the business before you post.</span>
            <Link href="/finance/select-business" style={{ color: "#232A63", fontWeight: 800 }}>Switch business</Link>
            <button onClick={() => setBizSwitched(null)} style={{ marginLeft: "auto", border: "none", background: "none", fontWeight: 800, cursor: "pointer", color: "#5A3A00" }}>OK</button>
          </div>
        )}
        <ActiveBusinessProvider>{children}</ActiveBusinessProvider>
      </main>

      {/* Phone tab bar */}
      <nav className="fw-tabs" aria-label="Tabs">
        {[
          { href: "/finance/chat-book", label: "FreBook", d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" },
          { href: "/finance/sales", label: "Sales", d: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM9 8h6M9 12h6" },
          { href: "/finance/chat-book?prefill=", label: "", d: "M12 5v14M5 12h14" },
          { href: "/finance/banking", label: "Bank", d: "M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18" },
          { href: "/finance/reports?tab=profit_loss", label: "Reports", d: "M4 20V10M10 20V4M16 20v-7" },
        ].map(t => t.label ? (
          <Link key={t.label} href={t.href} className={pathname === t.href.split("?")[0] ? "on" : ""}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>{t.label}
          </Link>
        ) : (
          <Link key="new" href={t.href} aria-label="New entry" className="plus">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d={t.d} /></svg>
          </Link>
        ))}
      </nav>
    </div>
  );
}

