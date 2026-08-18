"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type MonthData = { month: string; revenue: number; expenses: number; profit: number };
type TopAccount = { name: string; amount: number; type: string };

export default function InsightsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopAccount[]>([]);
  const [topRevenue, setTopRevenue] = useState<TopAccount[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [gstPayable, setGstPayable] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
      setBizName(biz?.name ?? "");
      await loadInsights(saved);
    });
  }, []);

  async function loadInsights(bid: string) {
    setLoading(true);

    // Load all posted journals
    const { data: journals } = await supabase
      .from("fw_fin_journals")
      .select("id,date,type,total_debit,total_credit,status")
      .eq("business_id", bid)
      .eq("status", "posted")
      .order("date");

    type J = { id: string; date: string; type: string; total_debit: number; total_credit: number };
    const jList = (journals ?? []) as J[];

    // Monthly P&L
    const monthMap = new Map<string, { revenue: number; expenses: number }>();
    for (const j of jList) {
      const month = j.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { revenue: 0, expenses: 0 });
      const m = monthMap.get(month)!;
      if (j.type === "sales") m.revenue += j.total_credit;
      else if (["purchase", "expense", "payment"].includes(j.type)) m.expenses += j.total_debit;
    }

    const months: MonthData[] = Array.from(monthMap.entries())
      .map(([month, d]) => ({ month, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    setMonthlyData(months);

    const rev = jList.filter(j => j.type === "sales").reduce((s, j) => s + j.total_credit, 0);
    const exp = jList.filter(j => ["purchase", "expense", "payment"].includes(j.type)).reduce((s, j) => s + j.total_debit, 0);
    setTotalRevenue(rev);
    setTotalExpenses(exp);
    setNetProfit(rev - exp);

    // Load journal lines for account breakdown
    const { data: lines } = await supabase
      .from("fw_fin_journal_lines")
      .select(`
        dr_amount, cr_amount,
        fw_fin_chart_of_accounts!inner(name, type),
        fw_fin_journals!inner(status, business_id, type)
      `)
      .eq("fw_fin_journals.business_id", bid)
      .eq("fw_fin_journals.status", "posted");

    type Line = {
      dr_amount: number; cr_amount: number;
      fw_fin_chart_of_accounts: { name: string; type: string } | null;
      fw_fin_journals: { status: string; business_id: string; type: string } | null;
    };

    const lList = (lines as unknown as Line[]) ?? [];
    const expByAcc = new Map<string, number>();
    const revByAcc = new Map<string, number>();

    for (const l of lList) {
      const accName = l.fw_fin_chart_of_accounts?.name ?? "Unknown";
      const accType = l.fw_fin_chart_of_accounts?.type ?? "";
      if (accType === "expense" && l.dr_amount > 0) expByAcc.set(accName, (expByAcc.get(accName) ?? 0) + l.dr_amount);
      if (accType === "income" && l.cr_amount > 0) revByAcc.set(accName, (revByAcc.get(accName) ?? 0) + l.cr_amount);
    }

    setTopExpenses(Array.from(expByAcc.entries()).map(([name, amount]) => ({ name, amount, type: "expense" })).sort((a, b) => b.amount - a.amount).slice(0, 5));
    setTopRevenue(Array.from(revByAcc.entries()).map(([name, amount]) => ({ name, amount, type: "income" })).sort((a, b) => b.amount - a.amount).slice(0, 5));

    // GST payable estimate \u2014 sum output vs input GST from account names
    const gstOut = lList.filter(l => l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("gst output") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("cgst output") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("sgst output") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("igst output")).reduce((s, l) => s + l.cr_amount, 0);
    const gstIn = lList.filter(l => l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("gst input") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("cgst input") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("sgst input") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("igst input")).reduce((s, l) => s + l.dr_amount, 0);
    setGstPayable(Math.max(0, gstOut - gstIn));

    // Cash balance
    const cash = lList.filter(l => l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("cash") || l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("bank")).reduce((s, l) => s + l.dr_amount - l.cr_amount, 0);
    setCashBalance(cash);

    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtShort = (n: number) => n >= 100000 ? `\u20B9${(n / 100000).toFixed(1)}L` : n >= 1000 ? `\u20B9${(n / 1000).toFixed(1)}K` : `\u20B9${Math.round(n)}`;

  const maxMonthValue = Math.max(...monthlyData.map(m => Math.max(m.revenue, m.expenses)), 1);
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>\u203A</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>AI Insights</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontSize: "0.82rem" }}>
          \u{1F6E9}\uFE0F Ask FrePilot
        </Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.2rem", fontSize: "1.3rem", fontWeight: 800 }}>AI Financial Insights</h1>
          <p style={{ margin: 0, color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>{bizName} \u2014 Current Financial Year</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(237,232,220,0.3)" }}>Analysing your financials\u2026</div>
        ) : (
          <>
            {/* KPI Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Revenue", value: totalRevenue, color: "#4ade80", icon: "\u{1F4C8}" },
                { label: "Expenses", value: totalExpenses, color: "#f87171", icon: "\u{1F4C9}" },
                { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#C9A84C" : "#f87171", icon: "\u{1F4B0}" },
                { label: "GST Payable", value: gstPayable, color: "#60a5fa", icon: "\u{1F3DB}\uFE0F" },
                { label: "Cash & Bank", value: cashBalance, color: "rgba(237,232,220,0.8)", icon: "\u{1F3E6}" },
              ].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <div style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>{k.icon}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{fmtShort(k.value)}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Profit Margin card */}
            <div style={{ background: parseFloat(profitMargin) >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${parseFloat(profitMargin) >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 12, padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "2rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>Net Profit Margin</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, color: parseFloat(profitMargin) >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>{profitMargin}%</div>
              </div>
              <div style={{ flex: 1, fontSize: "0.85rem", color: "rgba(237,232,220,0.5)", lineHeight: 1.6 }}>
                {parseFloat(profitMargin) >= 20
                  ? "Excellent margin. Your business is highly profitable. Consider investing surplus in growth."
                  : parseFloat(profitMargin) >= 10
                  ? "Healthy margin. Room to improve by controlling expenses or increasing pricing."
                  : parseFloat(profitMargin) >= 0
                  ? "Thin margin. Review your largest expense categories and consider pricing strategy."
                  : "Operating at a loss. Immediate action needed \u2014 cut costs or increase revenue."}
              </div>
              <Link href="/finance/virtual-ca" style={{ flexShrink: 0, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}>
                Ask FrePilot \u2192
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              {/* Bar Chart \u2014 Monthly P&L */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1.25rem" }}>Monthly Revenue vs Expenses</div>
                {monthlyData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "rgba(237,232,220,0.25)", fontSize: "0.82rem" }}>No posted journals yet</div>
                ) : (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", height: 160 }}>
                    {monthlyData.map(m => {
                      const revH = Math.round((m.revenue / maxMonthValue) * 140);
                      const expH = Math.round((m.expenses / maxMonthValue) * 140);
                      const label = monthLabels[parseInt(m.month.slice(5, 7)) - 1];
                      return (
                        <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <div style={{ fontSize: "0.62rem", color: "rgba(237,232,220,0.3)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{fmtShort(m.profit)}</div>
                          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 140 }}>
                            <div title={`Revenue: \u20B9${fmt(m.revenue)}`} style={{ width: 14, height: revH, background: "linear-gradient(180deg,#4ade80,#22c55e)", borderRadius: "3px 3px 0 0", transition: "height 0.4s" }} />
                            <div title={`Expenses: \u20B9${fmt(m.expenses)}`} style={{ width: 14, height: expH, background: "linear-gradient(180deg,#f87171,#ef4444)", borderRadius: "3px 3px 0 0", transition: "height 0.4s" }} />
                          </div>
                          <div style={{ fontSize: "0.62rem", color: "rgba(237,232,220,0.4)", marginTop: 4 }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                  {[{ color: "#4ade80", label: "Revenue" }, { color: "#f87171", label: "Expenses" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.4)" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue / Expense trend (profit line concept) */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>Profit Trend</div>
                {monthlyData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "rgba(237,232,220,0.25)", fontSize: "0.82rem" }}>No data yet</div>
                ) : (
                  <div>
                    {monthlyData.map(m => {
                      const maxAbs = Math.max(...monthlyData.map(x => Math.abs(x.profit)), 1);
                      const pct = (Math.abs(m.profit) / maxAbs) * 100;
                      const label = monthLabels[parseInt(m.month.slice(5, 7)) - 1];
                      const isProfit = m.profit >= 0;
                      return (
                        <div key={m.month} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                          <div style={{ width: 26, fontSize: "0.68rem", color: "rgba(237,232,220,0.35)", flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1, height: 20, background: "rgba(237,232,220,0.04)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: isProfit ? "linear-gradient(90deg,#22c55e,#4ade80)" : "linear-gradient(90deg,#ef4444,#f87171)", borderRadius: 4, transition: "width 0.5s" }} />
                          </div>
                          <div style={{ width: 70, textAlign: "right", fontSize: "0.72rem", color: isProfit ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                            {isProfit ? "+" : ""}{fmtShort(m.profit)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Expenses + Top Revenue */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              {[
                { title: "Top Expense Categories", data: topExpenses, color: "#f87171", emptyMsg: "No expense data yet" },
                { title: "Top Revenue Accounts", data: topRevenue, color: "#4ade80", emptyMsg: "No revenue data yet" },
              ].map(section => {
                const max = Math.max(...section.data.map(d => d.amount), 1);
                const total = section.data.reduce((s, d) => s + d.amount, 0);
                return (
                  <div key={section.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>{section.title}</div>
                    {section.data.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "rgba(237,232,220,0.25)", fontSize: "0.82rem" }}>{section.emptyMsg}</div>
                    ) : (
                      section.data.map((d, i) => (
                        <div key={i} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{d.name}</span>
                            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(d.amount)}</span>
                              <span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.3)" }}>{total > 0 ? `${((d.amount / total) * 100).toFixed(0)}%` : ""}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: "rgba(237,232,220,0.06)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(d.amount / max) * 100}%`, background: section.color, borderRadius: 3, opacity: 0.8 }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>

            {/* Smart Alerts */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>Smart Alerts & Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {[
                  gstPayable > 0 && { icon: "\u{1F3DB}\uFE0F", text: `GST payable estimated at \u20B9${fmt(gstPayable)}. File GSTR-3B before the 20th.`, color: "#60a5fa", href: "/finance/gst" },
                  netProfit < 0 && { icon: "\u26A0\uFE0F", text: "Business is operating at a loss this year. Review your top expenses and pricing.", color: "#f87171", href: "/finance/virtual-ca" },
                  totalRevenue === 0 && { icon: "\u{1F4C8}", text: "No sales recorded yet. Create your first sales invoice to start tracking revenue.", color: "#C9A84C", href: "/finance/sales/new" },
                  totalExpenses > totalRevenue * 0.8 && totalRevenue > 0 && { icon: "\u{1F4CA}", text: `Expenses are ${((totalExpenses / totalRevenue) * 100).toFixed(0)}% of revenue. Industry benchmark is typically 60\u201370%.`, color: "#fb923c", href: "/finance/reports" },
                  gstPayable > 0 && { icon: "\u2705", text: "Ensure GST ITC is claimed on all purchase bills with valid GSTIN.", color: "#4ade80", href: "/finance/virtual-ca" },
                  { icon: "\u{1F4CB}", text: "Keep all invoices uploaded and AI-reviewed for accurate books and easy ITR filing.", color: "rgba(237,232,220,0.5)", href: "/finance/upload" },
                ].filter(Boolean).map((alert, i) => alert && (
                  <Link key={i} href={alert.href} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.65rem 0.85rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, textDecoration: "none" }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{alert.icon}</span>
                    <span style={{ fontSize: "0.82rem", color: alert.color, flex: 1, lineHeight: 1.45 }}>{alert.text}</span>
                    <span style={{ fontSize: "0.75rem", color: "#C9A84C", flexShrink: 0 }}>\u2192</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
