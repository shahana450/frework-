"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";

type MonthData = { month: string; revenue: number; expenses: number; profit: number };
type TopAccount = { name: string; amount: number; type: string };

export default function InsightsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [gstin, setGstin] = useState("");
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
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("id", saved).single();
      setBizName(biz?.name ?? ""); setGstin((biz as { gstin?: string | null } | null)?.gstin ?? "");
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
      ;
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

  const inr = (n: number) => `${n < 0 ? "−" : ""}${cur()}${Math.abs(Math.round(n)).toLocaleString(activeMoney().locale)}`;
  const [ask, setAsk] = useState("");

  // Every month of the financial year up to now, so gaps show
  const now = new Date();
  const fyY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyLabel = `${fyY}-${String(fyY + 1).slice(2)}`;
  const byMonth = new Map(monthlyData.map(m => [m.month, m]));
  const months: MonthData[] = [];
  for (let d = new Date(fyY, 3, 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(byMonth.get(k) ?? { month: k, revenue: 0, expenses: 0, profit: 0 });
  }
  const mName = (k: string, long = false) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: long ? "long" : "short" });
  const max = Math.max(1, ...months.flatMap(m => [m.revenue, m.expenses]));
  const cur0 = months[months.length - 1];
  const active = months.filter(m => m.revenue || m.expenses);
  const empty = months.filter(m => !m.revenue && !m.expenses && m !== cur0);
  const margin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0;
  const monthlySpend = active.length ? totalExpenses / active.length : 0;

  const headline = loading ? "Reading your books…"
    : !totalRevenue && !totalExpenses ? "No entries yet this year"
    : `${netProfit >= 0 ? "A healthy year" : "A loss-making year"}, ${cur0 && cur0.profit < 0 ? `a soft ${mName(cur0.month, true)}` : cur0 && cur0.profit > 0 ? `a good ${mName(cur0.month, true)}` : "so far"}`;

  type Note = { tag: "Watch" | "Check" | "Good"; text: React.ReactNode };
  const notes: Note[] = [];
  if (cur0 && cur0.profit < 0 && (cur0.revenue || cur0.expenses)) notes.push({ tag: "Watch", text: <>{mName(cur0.month, true)} ran at a loss of {inr(-cur0.profit)} — expenses of {inr(cur0.expenses)} outpaced sales of {inr(cur0.revenue)}.</> });
  if (topExpenses[0] && totalExpenses && topExpenses[0].amount / totalExpenses > 0.4) notes.push({ tag: "Watch", text: <>{topExpenses[0].name} is {Math.round((topExpenses[0].amount / totalExpenses) * 100)}% of all expenses this year ({inr(topExpenses[0].amount)}).</> });
  if (empty.length) notes.push({ tag: "Check", text: <>No entries for {empty.length === 1 ? mName(empty[0].month, true) : `${mName(empty[0].month, true)} to ${mName(empty[empty.length - 1].month, true)}`}. <Link href="/finance/banking/import" style={{ color: HT.ink }}>Upload statements</Link> to complete the year.</> });
  if (!gstin) notes.push({ tag: "Check", text: <>GST payable can’t be worked out without a GSTIN. <Link href="/finance/settings/business" style={{ color: HT.ink }}>Add it</Link>.</> });
  if (cashBalance < 0) notes.push({ tag: "Watch", text: <>Cash & bank is negative ({inr(cashBalance)}) — a receipt may be missing.</> });
  if (totalRevenue && margin > 0) notes.push({ tag: "Good", text: <>Year-to-date margin of {margin.toFixed(1)}%{monthlySpend > 0 && cashBalance > 0 ? `; cash covers about ${(cashBalance / monthlySpend).toFixed(1)} months of average spending` : ""}.</> });
  const TAG = { Watch: { bg: "#FBE3DE", c: "#B4321F" }, Check: { bg: "#FBF1DA", c: "#9A6B22" }, Good: { bg: "#E3F3EC", c: "#0B7A55" } };

  const goAsk = (q: string) => { if (q.trim()) router.push(`/finance/chat-book?q=${encodeURIComponent(q.trim())}`); };
  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const best = active.length ? active.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <style>{`.in-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start}@media(max-width:900px){.in-two{grid-template-columns:minmax(0,1fr)}}`}</style>
      <PageHero eyebrow={`AI insights · FY ${fyLabel} to date`} title={headline}
        actions={<HeroAction onClick={() => document.getElementById("in-ask")?.focus()}>✦ Ask your books</HeroAction>}
        tiles={[
          { label: "Revenue", value: inr(totalRevenue) },
          { label: "Expenses", value: inr(totalExpenses) },
          { label: netProfit < 0 ? "Net loss" : "Net profit", value: inr(netProfit), sub: totalRevenue ? `margin ${margin.toFixed(1)}%` : undefined, tone: netProfit < 0 ? "bad" : "good" },
          { label: "Cash & bank", value: inr(cashBalance), tone: cashBalance < 0 ? "bad" : "plain" },
          { label: "GST payable", value: inr(gstPayable), sub: gstin ? undefined : "GSTIN not set", tone: "warn" },
        ]} />

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="in-two">
          <section style={{ ...card, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <span style={{ flex: 1, fontSize: 22, fontStyle: "italic" }}>Revenue against expenses</span>
              <span style={{ fontSize: 13.5, color: HT.muted }}><i style={{ display: "inline-block", width: 10, height: 10, background: HT.green, marginRight: 5 }} />Revenue <i style={{ display: "inline-block", width: 10, height: 10, background: "#D7B266", margin: "0 5px 0 10px" }} />Expenses</span>
            </div>
            <div role="img" aria-label="Revenue and expenses by month" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(months.length, 1)},minmax(0,1fr))`, gap: 8, alignItems: "end", height: 190, borderBottom: `1px solid ${HT.line}` }}>
              {months.map(m => (
                <div key={m.month} title={`${mName(m.month, true)}: revenue ${inr(m.revenue)}, expenses ${inr(m.expenses)}`} style={{ height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                  {m.revenue || m.expenses
                    ? <><span style={{ width: "34%", maxWidth: 22, height: `${(Math.max(0, m.revenue) / max) * 100}%`, background: HT.green }} /><span style={{ width: "34%", maxWidth: 22, height: `${(Math.max(0, m.expenses) / max) * 100}%`, background: "#D7B266" }} /></>
                    : <span style={{ width: 3, height: 3, borderRadius: 999, background: HT.muted, marginBottom: "50%" }} />}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(months.length, 1)},minmax(0,1fr))`, gap: 8, fontSize: 13.5, color: HT.muted, textAlign: "center", marginTop: 8 }}>
              {months.map(m => <span key={m.month}>{mName(m.month)}</span>)}
            </div>
            {(best || cur0) && <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${HT.line}`, marginTop: 14, paddingTop: 12, fontSize: 15 }}>
              {best && best !== cur0 ? <span>{mName(best.month, true)} profit <span style={{ color: "#0B7A55" }}>{best.profit >= 0 ? "+" : ""}{inr(best.profit)}</span></span> : <span />}
              {cur0 && <span>{mName(cur0.month, true)} <span style={{ color: cur0.profit < 0 ? "#B4321F" : "#0B7A55" }}>{cur0.profit >= 0 ? "+" : ""}{inr(cur0.profit)}</span></span>}
            </div>}
          </section>

          <section>
            <div style={{ fontSize: 22, fontStyle: "italic", marginBottom: 12 }}>What FreBook noticed</div>
            <div style={{ ...card, overflow: "hidden" }}>
              {loading ? <div style={{ padding: 22, color: HT.muted, fontStyle: "italic" }}>Reading…</div>
                : notes.length === 0 ? <div style={{ padding: 22, color: HT.muted, fontStyle: "italic" }}>Nothing stands out yet — add a few months of entries.</div>
                : notes.map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "15px 22px", borderTop: i ? `1px solid ${HT.line}` : undefined, fontSize: 15.5, lineHeight: 1.55 }}>
                    <span style={{ flexShrink: 0, marginTop: 2, fontSize: 12.5, padding: "2px 10px", borderRadius: 999, background: TAG[n.tag].bg, color: TAG[n.tag].c }}>{n.tag}</span>
                    <span>{n.text}</span>
                  </div>
                ))}
            </div>
            {(topExpenses.length > 0 || topRevenue.length > 0) && (
              <div style={{ ...card, marginTop: 14, padding: "14px 22px", display: "grid", gap: 6, fontSize: 14.5 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.2em", color: HT.goldInk }}>LARGEST EXPENSES</div>
                {topExpenses.slice(0, 4).map(e => (
                  <div key={e.name} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span style={{ width: 90, height: 5, borderRadius: 999, background: "#EFE6D3", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(e.amount / (topExpenses[0]?.amount || 1)) * 100}%`, background: "#D7B266" }} /></span>
                    <span style={{ width: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{inr(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 22, fontStyle: "italic", marginBottom: 12 }}>Ask your books</div>
          <form onSubmit={e => { e.preventDefault(); goAsk(ask); }} style={{ display: "flex", gap: 10 }}>
            <input id="in-ask" value={ask} onChange={e => setAsk(e.target.value)} placeholder={cur0 && cur0.profit < 0 ? `Why was ${mName(cur0.month, true)} a loss?` : "Where did most of my money go?"}
              style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 999, border: `1px solid ${HT.line}`, background: "#FFFFFF", padding: "0 20px", fontFamily: SERIF, fontSize: 16, color: HT.ink, outline: "none" }} />
            <button type="submit" style={{ height: 48, padding: "0 24px", borderRadius: 999, border: "none", background: HT.green, color: "#FFFFFF", fontFamily: SERIF, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Ask</button>
          </form>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {["Biggest expenses this year", "Who owes me?", best && cur0 && best !== cur0 ? `Compare ${mName(best.month, true)} and ${mName(cur0.month, true)}` : "Profit this month"].map(q => (
              <button key={q} onClick={() => goAsk(q)} style={{ height: 38, padding: "0 16px", borderRadius: 999, border: `1px solid ${HT.line}`, background: HT.paper, color: HT.ink, fontFamily: SERIF, fontSize: 14.5, cursor: "pointer" }}>{q}</button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
