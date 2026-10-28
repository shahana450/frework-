"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

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
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
      setBizName(biz?.name ?? "");
      await loadInsights(saved);
    });
  }, []);

  async function loadInsights(bid: string) {
    setLoading(true);

    // Every posted line this financial year, by account type (chat entries, invoices, bank imports — not just "sales" vouchers)
    const now = new Date();
    const fyStart = `${now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1}-04-01`;
    type Line = {
      dr_amount: number; cr_amount: number;
      fw_fin_chart_of_accounts: { name: string; type: string; sub_type: string | null } | null;
      fw_fin_journals: { date: string } | null;
    };
    const lList: Line[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("fw_fin_journal_lines")
        .select("dr_amount, cr_amount, fw_fin_chart_of_accounts!inner(name, type, sub_type), fw_fin_journals!inner(status, business_id, date)")
        .eq("fw_fin_journals.business_id", bid)
        .eq("fw_fin_journals.status", "posted")
        .order("id").range(from, from + 999);
      const got = (data as unknown as Line[]) ?? [];
      lList.push(...got);
      if (got.length < 1000) break;
    }
    const inYear = lList.filter(l => (l.fw_fin_journals?.date ?? "") >= fyStart);

    // Monthly P&L: income = credits less debits on income ledgers, expenses = debits less credits on expense ledgers
    const monthMap = new Map<string, { revenue: number; expenses: number }>();
    const expByAcc = new Map<string, number>();
    const revByAcc = new Map<string, number>();
    for (const l of inYear) {
      const t = l.fw_fin_chart_of_accounts?.type ?? "";
      if (t !== "income" && t !== "expense") continue;
      const month = (l.fw_fin_journals?.date ?? "").slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { revenue: 0, expenses: 0 });
      const m = monthMap.get(month)!;
      const name = l.fw_fin_chart_of_accounts?.name ?? "Unknown";
      if (t === "income") { const v = (l.cr_amount || 0) - (l.dr_amount || 0); m.revenue += v; revByAcc.set(name, (revByAcc.get(name) ?? 0) + v); }
      else { const v = (l.dr_amount || 0) - (l.cr_amount || 0); m.expenses += v; expByAcc.set(name, (expByAcc.get(name) ?? 0) + v); }
    }
    const months: MonthData[] = Array.from(monthMap.entries())
      .map(([month, d]) => ({ month, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses }))
      .sort((x, y) => x.month.localeCompare(y.month))
      .slice(-6);
    setMonthlyData(months);

    const rev = [...monthMap.values()].reduce((s, m) => s + m.revenue, 0);
    const exp = [...monthMap.values()].reduce((s, m) => s + m.expenses, 0);
    setTotalRevenue(rev);
    setTotalExpenses(exp);
    setNetProfit(rev - exp);
    setTopExpenses(Array.from(expByAcc.entries()).filter(([, v]) => v > 0).map(([name, amount]) => ({ name, amount, type: "expense" })).sort((x, y) => y.amount - x.amount).slice(0, 5));
    setTopRevenue(Array.from(revByAcc.entries()).filter(([, v]) => v > 0).map(([name, amount]) => ({ name, amount, type: "income" })).sort((x, y) => y.amount - x.amount).slice(0, 5));

    // GST payable: output GST ledgers (liabilities) less input GST ledgers (assets), all time
    const gstName = (l: Line) => (l.fw_fin_chart_of_accounts?.name ?? "").toLowerCase();
    const isGst = (l: Line) => /\b(c|s|i|ut)?gst\b/.test(gstName(l));
    const gstOut = lList.filter(l => isGst(l) && l.fw_fin_chart_of_accounts?.type === "liability").reduce((s, l) => s + (l.cr_amount || 0) - (l.dr_amount || 0), 0);
    const gstIn = lList.filter(l => isGst(l) && l.fw_fin_chart_of_accounts?.type === "asset").reduce((s, l) => s + (l.dr_amount || 0) - (l.cr_amount || 0), 0);
    setGstPayable(Math.max(0, gstOut - gstIn));

    // Cash & bank: asset ledgers that are cash or bank
    const isCash = (l: Line) => l.fw_fin_chart_of_accounts?.type === "asset" && (["cash", "bank"].includes(l.fw_fin_chart_of_accounts?.sub_type ?? "") || /\b(cash|bank)\b/i.test(l.fw_fin_chart_of_accounts?.name ?? ""));
    setCashBalance(lList.filter(isCash).reduce((s, l) => s + (l.dr_amount || 0) - (l.cr_amount || 0), 0));

    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });
  const fmtShort = (n: number) => n >= 100000 ? `${cur()}${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${cur()}${(n / 1000).toFixed(1)}K` : `${cur()}${Math.round(n)}`;

  const maxMonthValue = Math.max(...monthlyData.map(m => Math.max(m.revenue, m.expenses)), 1);
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(18,53,45,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#12352D", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(16,36,31,0.55)" }}>›</span>
        <span style={{ color: "rgba(16,36,31,0.85)", fontSize: "0.85rem" }}>AI Insights</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/chat-book" style={{ background: "rgba(18,53,45,0.1)", border: "1px solid rgba(18,53,45,0.3)", color: "#12352D", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontSize: "0.82rem" }}>
          🛩️ Ask your books
        </Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.2rem", fontSize: "1.3rem", fontWeight: 800 }}>AI Financial Insights</h1>
          <p style={{ margin: 0, color: "rgba(16,36,31,0.65)", fontSize: "0.82rem" }}>{bizName} — Current Financial Year</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(16,36,31,0.55)" }}>Analysing your financials…</div>
        ) : (
          <>
            {/* KPI Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Revenue", value: totalRevenue, color: "#0B7A55", icon: "📈" },
                { label: "Expenses", value: totalExpenses, color: "#B4321F", icon: "📉" },
                { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#12352D" : "#B4321F", icon: "💰" },
                { label: "GST Payable", value: gstPayable, color: "#12352D", icon: "🏛️" },
                { label: "Cash & Bank", value: cashBalance, color: "rgba(16,36,31,1.00)", icon: "🏦" },
              ].map(k => (
                <div key={k.label} style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <div style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>{k.icon}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{fmtShort(k.value)}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.60)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Profit Margin card */}
            <div style={{ background: parseFloat(profitMargin) >= 0 ? "rgba(11,122,85,0.06)" : "rgba(194,50,31,0.06)", border: `1px solid ${parseFloat(profitMargin) >= 0 ? "rgba(11,122,85,0.2)" : "rgba(194,50,31,0.2)"}`, borderRadius: 12, padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "2rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>Net Profit Margin</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, color: parseFloat(profitMargin) >= 0 ? "#0B7A55" : "#B4321F", fontVariantNumeric: "tabular-nums" }}>{profitMargin}%</div>
              </div>
              <div style={{ flex: 1, fontSize: "0.85rem", color: "rgba(16,36,31,0.75)", lineHeight: 1.6 }}>
                {parseFloat(profitMargin) >= 20
                  ? "Excellent margin. Your business is highly profitable. Consider investing surplus in growth."
                  : parseFloat(profitMargin) >= 10
                  ? "Healthy margin. Room to improve by controlling expenses or increasing pricing."
                  : parseFloat(profitMargin) >= 0
                  ? "Thin margin. Review your largest expense categories and consider pricing strategy."
                  : "Operating at a loss. Immediate action needed — cut costs or increase revenue."}
              </div>
              <Link href="/finance/chat-book" style={{ flexShrink: 0, background: "rgba(18,53,45,0.1)", border: "1px solid rgba(18,53,45,0.25)", color: "#12352D", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}>
                Ask your books →
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              {/* Bar Chart — Monthly P&L */}
              <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1.25rem" }}>Monthly Revenue vs Expenses</div>
                {monthlyData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "rgba(16,36,31,0.35)", fontSize: "0.82rem" }}>No posted journals yet</div>
                ) : (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", height: 160 }}>
                    {monthlyData.map(m => {
                      const revH = Math.round((m.revenue / maxMonthValue) * 140);
                      const expH = Math.round((m.expenses / maxMonthValue) * 140);
                      const label = monthLabels[parseInt(m.month.slice(5, 7)) - 1];
                      return (
                        <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <div style={{ fontSize: "0.62rem", color: "rgba(16,36,31,0.55)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{fmtShort(m.profit)}</div>
                          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 140 }}>
                            <div title={`Revenue: ${cur()}${fmt(m.revenue)}`} style={{ width: 14, height: revH, background: "linear-gradient(180deg,#0B7A55,#0B7A55)", borderRadius: "3px 3px 0 0", transition: "height 0.4s" }} />
                            <div title={`Expenses: ${cur()}${fmt(m.expenses)}`} style={{ width: 14, height: expH, background: "linear-gradient(180deg,#B4321F,#B4321F)", borderRadius: "3px 3px 0 0", transition: "height 0.4s" }} />
                          </div>
                          <div style={{ fontSize: "0.62rem", color: "rgba(16,36,31,0.65)", marginTop: 4 }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                  {[{ color: "#0B7A55", label: "Revenue" }, { color: "#B4321F", label: "Expenses" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(16,36,31,0.65)" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue / Expense trend (profit line concept) */}
              <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>Profit Trend</div>
                {monthlyData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "rgba(16,36,31,0.35)", fontSize: "0.82rem" }}>No data yet</div>
                ) : (
                  <div>
                    {monthlyData.map(m => {
                      const maxAbs = Math.max(...monthlyData.map(x => Math.abs(x.profit)), 1);
                      const pct = (Math.abs(m.profit) / maxAbs) * 100;
                      const label = monthLabels[parseInt(m.month.slice(5, 7)) - 1];
                      const isProfit = m.profit >= 0;
                      return (
                        <div key={m.month} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                          <div style={{ width: 26, fontSize: "0.68rem", color: "rgba(16,36,31,0.60)", flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1, height: 20, background: "rgba(16,36,31,0.08)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: isProfit ? "linear-gradient(90deg,#0B7A55,#0B7A55)" : "linear-gradient(90deg,#B4321F,#B4321F)", borderRadius: 4, transition: "width 0.5s" }} />
                          </div>
                          <div style={{ width: 70, textAlign: "right", fontSize: "0.72rem", color: isProfit ? "#0B7A55" : "#B4321F", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
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
                { title: "Top Expense Categories", data: topExpenses, color: "#B4321F", emptyMsg: "No expense data yet" },
                { title: "Top Revenue Accounts", data: topRevenue, color: "#0B7A55", emptyMsg: "No revenue data yet" },
              ].map(section => {
                const max = Math.max(...section.data.map(d => d.amount), 1);
                const total = section.data.reduce((s, d) => s + d.amount, 0);
                return (
                  <div key={section.title} style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>{section.title}</div>
                    {section.data.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "rgba(16,36,31,0.35)", fontSize: "0.82rem" }}>{section.emptyMsg}</div>
                    ) : (
                      section.data.map((d, i) => (
                        <div key={i} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{d.name}</span>
                            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(d.amount)}</span>
                              <span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.55)" }}>{total > 0 ? `${((d.amount / total) * 100).toFixed(0)}%` : ""}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: "rgba(16,36,31,0.08)", borderRadius: 3, overflow: "hidden" }}>
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
            <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1rem" }}>Smart Alerts & Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {[
                  gstPayable > 0 && { icon: "🏛️", text: `GST payable estimated at ${cur()}${fmt(gstPayable)}. File GSTR-3B before the 20th.`, color: "#12352D", href: "/finance/gst" },
                  netProfit < 0 && { icon: "⚠️", text: "Business is operating at a loss this year. Review your top expenses and pricing.", color: "#B4321F", href: "/finance/chat-book" },
                  totalRevenue === 0 && { icon: "📈", text: "No sales recorded yet. Create your first sales invoice to start tracking revenue.", color: "#12352D", href: "/finance/sales/new" },
                  totalExpenses > totalRevenue * 0.8 && totalRevenue > 0 && { icon: "📊", text: `Expenses are ${((totalExpenses / totalRevenue) * 100).toFixed(0)}% of revenue. Industry benchmark is typically 60–70%.`, color: "#B4561E", href: "/finance/reports" },
                  gstPayable > 0 && { icon: "✅", text: "Ensure GST ITC is claimed on all purchase bills with valid GSTIN.", color: "#0B7A55", href: "/finance/chat-book" },
                  { icon: "📋", text: "Keep all invoices uploaded and AI-reviewed for accurate books and easy ITR filing.", color: "rgba(16,36,31,0.75)", href: "/finance/upload" },
                ].filter(Boolean).map((alert, i) => alert && (
                  <Link key={i} href={alert.href} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.65rem 0.85rem", background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.08)", borderRadius: 8, textDecoration: "none" }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{alert.icon}</span>
                    <span style={{ fontSize: "0.82rem", color: alert.color, flex: 1, lineHeight: 1.45 }}>{alert.text}</span>
                    <span style={{ fontSize: "0.75rem", color: "#12352D", flexShrink: 0 }}>→</span>
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
