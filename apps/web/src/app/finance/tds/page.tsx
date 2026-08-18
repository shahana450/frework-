"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const TDS_SECTIONS = [
  { section: "194C", description: "Contractor / Sub-contractor payments", threshold: 30000, rate_individual: 1, rate_company: 2 },
  { section: "194J", description: "Professional / Technical fees", threshold: 30000, rate_individual: 10, rate_company: 10 },
  { section: "194I(a)", description: "Rent \u2014 Plant, Machinery, Equipment", threshold: 240000, rate_individual: 2, rate_company: 2 },
  { section: "194I(b)", description: "Rent \u2014 Land, Building, Furniture", threshold: 240000, rate_individual: 10, rate_company: 10 },
  { section: "194A", description: "Interest (other than on securities)", threshold: 40000, rate_individual: 10, rate_company: 10 },
  { section: "194H", description: "Commission or brokerage", threshold: 15000, rate_individual: 5, rate_company: 5 },
  { section: "194B", description: "Lottery / game winnings", threshold: 10000, rate_individual: 30, rate_company: 30 },
  { section: "194Q", description: "Purchase of goods (buyer TDS)", threshold: 5000000, rate_individual: 0.1, rate_company: 0.1 },
  { section: "192", description: "Salary payments to employees", threshold: 250000, rate_individual: 5, rate_company: 5 },
  { section: "194M", description: "Payment by individual/HUF to contractor/professional", threshold: 5000000, rate_individual: 5, rate_company: 5 },
];

const DUE_DATES = [
  { month: "April", date: "May 7" }, { month: "May", date: "Jun 7" }, { month: "June", date: "Jul 7" },
  { month: "July", date: "Aug 7" }, { month: "August", date: "Sep 7" }, { month: "September", date: "Oct 7" },
  { month: "October", date: "Nov 7" }, { month: "November", date: "Dec 7" }, { month: "December", date: "Jan 7" },
  { month: "January", date: "Feb 7" }, { month: "February", date: "Mar 7" }, { month: "March", date: "Apr 30" },
];

export default function TDSTrackerPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [tdsJournals, setTdsJournals] = useState<{ date: string; narration: string; total_debit: number; entry_no: string }[]>([]);
  const [totalTdsDeducted, setTotalTdsDeducted] = useState(0);
  const [activeTab, setActiveTab] = useState<"tracker" | "rates" | "due-dates">("tracker");

  // Calculator state
  const [calcSection, setCalcSection] = useState("194C");
  const [calcAmount, setCalcAmount] = useState("");
  const [calcPartyType, setCalcPartyType] = useState<"individual" | "company">("individual");
  const [calcResult, setCalcResult] = useState<{ tds: number; net: number; rate: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      // Find TDS-related journal lines
      const { data: lines } = await supabase
        .from("fw_fin_journal_lines")
        .select(`
          dr_amount, cr_amount, narration,
          fw_fin_chart_of_accounts!inner(name),
          fw_fin_journals!inner(date, narration, entry_no, status, business_id)
        `)
        .eq("fw_fin_journals.business_id", saved)
        .eq("fw_fin_journals.status", "posted");

      type Line = {
        dr_amount: number; cr_amount: number; narration: string | null;
        fw_fin_chart_of_accounts: { name: string } | null;
        fw_fin_journals: { date: string; narration: string; entry_no: string; status: string; business_id: string } | null;
      };

      const lList = (lines as unknown as Line[]) ?? [];
      const tdsLines = lList.filter(l => l.fw_fin_chart_of_accounts?.name.toLowerCase().includes("tds"));
      const total = tdsLines.reduce((s, l) => s + l.cr_amount, 0);
      setTotalTdsDeducted(total);

      const journals = tdsLines.map(l => ({
        date: l.fw_fin_journals?.date ?? "",
        narration: l.fw_fin_journals?.narration ?? l.narration ?? "",
        total_debit: l.cr_amount,
        entry_no: l.fw_fin_journals?.entry_no ?? "",
      })).filter(j => j.date);

      setTdsJournals(journals);
    });
  }, []);

  function calculate() {
    const section = TDS_SECTIONS.find(s => s.section === calcSection);
    if (!section || !parseFloat(calcAmount)) return;
    const amt = parseFloat(calcAmount);
    const rate = calcPartyType === "individual" ? section.rate_individual : section.rate_company;
    const tds = Math.round((amt * rate / 100) * 100) / 100;
    setCalcResult({ tds, net: amt - tds, rate });
  }

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };

  const today = new Date();
  const currentMonth = today.toLocaleString("en-IN", { month: "long" });
  const nextDue = DUE_DATES.find(d => d.month === currentMonth);

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>\u203A</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>TDS Tracker</span>
        <div style={{ flex: 1 }} />
        {nextDue && (
          <div style={{ fontSize: "0.78rem", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "4px 12px", borderRadius: 8 }}>
            \u{1F4C5} Next TDS due: {nextDue.date}
          </div>
        )}
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>TDS Tracker</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Tax Deducted at Source \u2014 rates, calculator, deduction history</p>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total TDS Deducted", value: `\u20B9${fmt(totalTdsDeducted)}`, color: "#C9A84C", icon: "\u{1F516}" },
            { label: "TDS Entries Found", value: tdsJournals.length, color: "#60a5fa", icon: "\u{1F4CB}" },
            { label: "Next Deposit Due", value: nextDue?.date ?? "\u2014", color: "#f87171", icon: "\u{1F4C5}" },
          ].map(k => (
            <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "0.35rem" }}>{k.icon}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["tracker", "rates", "due-dates"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer", border: "none", fontWeight: activeTab === tab ? 700 : 400,
              background: activeTab === tab ? "rgba(201,168,76,0.15)" : "rgba(237,232,220,0.05)",
              color: activeTab === tab ? "#C9A84C" : "rgba(237,232,220,0.5)",
            }}>
              {tab === "tracker" ? "TDS History" : tab === "rates" ? "Rates & Calculator" : "Due Dates"}
            </button>
          ))}
        </div>

        {/* TDS History */}
        {activeTab === "tracker" && (
          tdsJournals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "rgba(237,232,220,0.3)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>\u{1F516}</div>
              <div>No TDS entries found. Record expenses with TDS deduction in the Expense or Purchase Bill pages.</div>
              <Link href="/finance/expenses" style={{ display: "inline-block", marginTop: "1.5rem", color: "#C9A84C", textDecoration: "none", fontSize: "0.85rem" }}>\u2192 Record Expense with TDS</Link>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Date", "Entry No", "Narration", "TDS Amount"].map(h => (
                      <th key={h} style={{ padding: "0.6rem 1rem", textAlign: h === "TDS Amount" ? "right" : "left", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tdsJournals.map((j, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                      <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", color: "rgba(237,232,220,0.5)", whiteSpace: "nowrap" }}>
                        {new Date(j.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td style={{ padding: "0.65rem 1rem", fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(201,168,76,0.6)" }}>{j.entry_no}</td>
                      <td style={{ padding: "0.65rem 1rem", fontSize: "0.82rem", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                      <td style={{ padding: "0.65rem 1rem", textAlign: "right", fontWeight: 700, color: "#C9A84C", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(j.total_debit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.05)" }}>
                    <td colSpan={3} style={{ padding: "0.7rem 1rem", fontWeight: 800 }}>Total TDS</td>
                    <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 900, color: "#C9A84C", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(totalTdsDeducted)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {/* Rates & Calculator */}
        {activeTab === "rates" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.06)", fontWeight: 700, fontSize: "0.85rem" }}>TDS Sections & Rates</div>
              <div style={{ maxHeight: 450, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", position: "sticky", top: 0 }}>
                      {["Section", "Nature", "Threshold", "Rate"].map(h => (
                        <th key={h} style={{ padding: "0.5rem 0.85rem", textAlign: h === "Rate" || h === "Threshold" ? "right" : "left", fontSize: "0.62rem", color: "rgba(237,232,220,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TDS_SECTIONS.map(s => (
                      <tr key={s.section} style={{ borderTop: "1px solid rgba(237,232,220,0.04)", cursor: "pointer" }} onClick={() => { setCalcSection(s.section); }}>
                        <td style={{ padding: "0.55rem 0.85rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#C9A84C" }}>{s.section}</span>
                        </td>
                        <td style={{ padding: "0.55rem 0.85rem", fontSize: "0.75rem", color: "rgba(237,232,220,0.6)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</td>
                        <td style={{ padding: "0.55rem 0.85rem", textAlign: "right", fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", fontVariantNumeric: "tabular-nums" }}>
                          \u20B9{(s.threshold).toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "0.55rem 0.85rem", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "#4ade80" }}>
                          {s.rate_individual === s.rate_company ? `${s.rate_individual}%` : `${s.rate_individual}%/${s.rate_company}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculator */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "1.25rem" }}>TDS Calculator</div>
              <div style={{ marginBottom: "0.85rem" }}>
                <label style={labelStyle}>TDS Section</label>
                <select value={calcSection} onChange={e => setCalcSection(e.target.value)} style={inputStyle}>
                  {TDS_SECTIONS.map(s => <option key={s.section} value={s.section}>{s.section} \u2014 {s.description}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "0.85rem" }}>
                <label style={labelStyle}>Gross Payment Amount (\u20B9)</label>
                <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="Enter gross amount" style={{ ...inputStyle, textAlign: "right", fontSize: "1rem" }} />
              </div>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Party Type</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["individual", "company"] as const).map(t => (
                    <button key={t} onClick={() => setCalcPartyType(t)} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: calcPartyType === t ? 700 : 400, background: calcPartyType === t ? "rgba(201,168,76,0.15)" : "rgba(237,232,220,0.04)", color: calcPartyType === t ? "#C9A84C" : "rgba(237,232,220,0.5)", fontSize: "0.82rem" }}>
                      {t === "individual" ? "Individual / HUF" : "Company / Firm"}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={calculate} style={{ width: "100%", background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>
                Calculate TDS
              </button>
              {calcResult && (
                <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "1rem" }}>
                  {[
                    { label: "Gross Amount", value: parseFloat(calcAmount) },
                    { label: `TDS @ ${calcResult.rate}%`, value: calcResult.tds, color: "#f87171" },
                    { label: "Net Amount to Pay", value: calcResult.net, color: "#4ade80" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.82rem", color: "rgba(237,232,220,0.5)" }}>{r.label}</span>
                      <span style={{ fontWeight: 700, color: r.color ?? "#EDE8DC", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {!calcResult && (
                <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.25)", lineHeight: 1.6 }}>
                  Click "Calculate TDS" to see the deduction breakdown. Rates shown are basic rates \u2014 surcharge and cess may apply for high-income deductees.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Due Dates */}
        {activeTab === "due-dates" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
            {DUE_DATES.map(d => {
              const isCurrentMonth = d.month === currentMonth;
              return (
                <div key={d.month} style={{ background: isCurrentMonth ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${isCurrentMonth ? "rgba(201,168,76,0.3)" : "rgba(237,232,220,0.07)"}`, borderRadius: 10, padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: isCurrentMonth ? "#C9A84C" : "#EDE8DC" }}>{d.month}</span>
                    {isCurrentMonth && <span style={{ fontSize: "0.65rem", background: "#C9A84C", color: "#070C1A", padding: "2px 6px", borderRadius: 6, fontWeight: 800 }}>CURRENT</span>}
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: "0.25rem", color: isCurrentMonth ? "#C9A84C" : "rgba(237,232,220,0.7)" }}>Due: {d.date}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.3)", marginTop: "0.2rem" }}>Deposit TDS for {d.month} payments</div>
                </div>
              );
            })}
            <div style={{ gridColumn: "1/-1", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, padding: "0.85rem 1rem", fontSize: "0.8rem", color: "rgba(237,232,220,0.5)", lineHeight: 1.6 }}>
              <strong style={{ color: "#60a5fa" }}>Note:</strong> Government deductees: TDS due by April 7 for March. For company deductors, due date for TDS on salary is April 30. File TDS returns (Form 24Q/26Q) quarterly. Late deposit attracts 1.5% interest per month under Section 201(1A).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
