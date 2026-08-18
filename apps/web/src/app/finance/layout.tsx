"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { icon: "🏠", label: "Dashboard", href: "/finance" },
      { icon: "🔍", label: "AI Insights", href: "/finance/insights" },
      { icon: "🛩️", label: "FrePilot", href: "/finance/virtual-ca" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { icon: "📤", label: "Upload Documents", href: "/finance/upload" },
      { icon: "🤖", label: "AI Review Queue", href: "/finance/ai-review" },
      { icon: "🧾", label: "Sales Invoice", href: "/finance/sales/new" },
      { icon: "📦", label: "Purchase Bill", href: "/finance/purchases/new" },
      { icon: "💸", label: "Record Expense", href: "/finance/expenses" },
      { icon: "💳", label: "Payment Entry", href: "/finance/payment" },
      { icon: "🔴", label: "Credit Note", href: "/finance/credit-note" },
      { icon: "🟢", label: "Debit Note", href: "/finance/debit-note" },
    ],
  },
  {
    label: "Books",
    items: [
      { icon: "🧾", label: "Sales List", href: "/finance/sales" },
      { icon: "📋", label: "Journal Entries", href: "/finance/journals" },
      { icon: "📒", label: "Account Ledger", href: "/finance/ledger" },
      { icon: "📥", label: "Receivables (AR)", href: "/finance/receivables" },
      { icon: "📤", label: "Payables (AP)", href: "/finance/payables" },
    ],
  },
  {
    label: "Reports",
    items: [
      { icon: "📈", label: "Financial Reports", href: "/finance/reports" },
      { icon: "🏛️", label: "GST Returns", href: "/finance/gst" },
      { icon: "🔖", label: "TDS Tracker", href: "/finance/tds" },
      { icon: "🏦", label: "Bank Reconciliation", href: "/finance/banking" },
      { icon: "🔄", label: "Tally Export", href: "/finance/tally" },
    ],
  },
  {
    label: "Setup",
    items: [
      { icon: "📊", label: "Chart of Accounts", href: "/finance/chart-of-accounts" },
      { icon: "👥", label: "Contacts", href: "/finance/contacts" },
      { icon: "📅", label: "Financial Years", href: "/finance/fy" },
      { icon: "🫂", label: "Team & Access", href: "/finance/team" },
      { icon: "⚙️", label: "Business Setup", href: "/finance/setup" },
    ],
  },
];

const UNGUARDED = ["/finance/pricing", "/finance/setup", "/finance/admin"];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [bizName, setBizName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [subChecked, setSubChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Subscription gate \u2014 skip for unguarded pages
      if (!UNGUARDED.some(p => pathname.startsWith(p))) {
        const { data: sub } = await supabase
          .from("fw_fin_subscriptions")
          .select("status,subscription_ends_at")
          .eq("user_id", user.id)
          .in("status", ["active", "trial"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const valid = sub && new Date(sub.subscription_ends_at) > new Date();
        if (!valid) { router.replace("/finance/pricing"); return; }
      }
      setSubChecked(true);

      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (saved) {
        const { data } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
        if (data) setBizName(data.name);
      }
    });
  }, [pathname]);

  // Don't show sidebar on setup/pricing/admin pages, and wait for sub check
  if (UNGUARDED.some(p => pathname.startsWith(p))) return <>{children}</>;
  if (!subChecked) return <div style={{ minHeight: "100vh", background: "#070C1A" }} />;

  const sidebarW = collapsed ? 56 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarW, flexShrink: 0, background: "rgba(255,255,255,0.015)",
        borderRight: "1px solid rgba(237,232,220,0.07)", display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40, transition: "width 0.2s",
        overflowY: "auto", overflowX: "hidden",
      }}>
        {/* Logo + collapse */}
        <div style={{ padding: "0 12px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(237,232,220,0.07)", flexShrink: 0 }}>
          {!collapsed && (
            <Link href="/finance" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.1rem" }}>🛩️</span>
              <span style={{ fontWeight: 900, fontSize: "0.88rem", color: "#C9A84C", letterSpacing: "-0.02em" }}>FrePilot</span>
            </Link>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", color: "rgba(237,232,220,0.3)", cursor: "pointer", padding: 4, borderRadius: 4, fontSize: "0.9rem", marginLeft: collapsed ? "auto" : 0, marginRight: collapsed ? "auto" : 0 }}>
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Business name */}
        {!collapsed && bizName && (
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(237,232,220,0.05)" }}>
            <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Active Business</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(237,232,220,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bizName}</div>
          </div>
        )}

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{ padding: "10px 14px 4px", fontSize: "0.6rem", color: "rgba(237,232,220,0.2)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== "/finance" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{
                    display: "flex", alignItems: "center", gap: collapsed ? 0 : 8,
                    padding: collapsed ? "8px 0" : "6px 14px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    fontSize: "0.8rem", textDecoration: "none",
                    color: active ? "#C9A84C" : "rgba(237,232,220,0.55)",
                    background: active ? "rgba(201,168,76,0.1)" : "transparent",
                    borderLeft: active ? "2px solid #C9A84C" : "2px solid transparent",
                    fontWeight: active ? 700 : 400,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom links */}
        <div style={{ borderTop: "1px solid rgba(237,232,220,0.07)", padding: "8px 0", flexShrink: 0 }}>
          <Link href="/dashboard" title={collapsed ? "Main Dashboard" : undefined} style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 8, padding: collapsed ? "8px 0" : "6px 14px", justifyContent: collapsed ? "center" : "flex-start", textDecoration: "none", color: "rgba(237,232,220,0.3)", fontSize: "0.75rem" }}>
            <span>🏠</span>{!collapsed && <span>Main Dashboard</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: sidebarW, minWidth: 0, transition: "margin-left 0.2s" }}>
        {children}
      </main>
    </div>
  );
}
