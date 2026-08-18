"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type GSTSummary = {
  month: string;
  total_sales: number;
  total_purchases: number;
  output_tax: number;
  cgst_payable: number;
  sgst_payable: number;
  igst_payable: number;
  input_credit: number;
  net_gst_payable: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthOptions() {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    result.push({ value: `${d.getFullYear()}-${mm}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return result;
}

export default function GSTPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [gstin, setGstin] = useState("");
  const [bizName, setBizName] = useState("");
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [summary, setSummary] = useState<GSTSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "gstr1" | "gstr3b">("dashboard");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("id", saved).single();
      if (data) { setBizName(data.name); setGstin(data.gstin ?? ""); }
    });
  }, []);

  useEffect(() => {
    if (bizId) fetchSummary(bizId, selectedMonth);
  }, [bizId, selectedMonth]);

  async function fetchSummary(bid: string, month: string) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/finance/gst?business_id=${bid}&month=${month}&report=summary`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>\u203A</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>GST Returns</span>
        <div style={{ flex: 1 }} />
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#EDE8DC", padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>GST Returns</h1>
          {gstin && <div style={{ fontSize: "0.82rem", color: "rgba(237,232,220,0.4)" }}>{bizName} \u00B7 GSTIN: {gstin}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(237,232,220,0.08)", marginBottom: "1.5rem", paddingBottom: 0 }}>
          {([
            { key: "dashboard", label: "Tax Summary" },
            { key: "gstr1", label: "GSTR-1 (Outward Supplies)" },
            { key: "gstr3b", label: "GSTR-3B (Summary Return)" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: "none", border: "none", color: activeTab === t.key ? "#C9A84C" : "rgba(237,232,220,0.45)",
              padding: "0.6rem 1rem", cursor: "pointer", fontWeight: activeTab === t.key ? 700 : 400, fontSize: "0.88rem",
              borderBottom: activeTab === t.key ? "2px solid #C9A84C" : "2px solid transparent", marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>

        {error && <div style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

        {!gstin && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "#f59e0b" }}>
            \u26A0 GSTIN not set for this business. <Link href="/finance/setup" style={{ color: "#C9A84C", textDecoration: "none", fontWeight: 600 }}>Update business settings \u2192</Link>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(237,232,220,0.3)" }}>Calculating GST\u2026</div>
        ) : summary && (
          <>
            {activeTab === "dashboard" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                  {[
                    { label: "Total Sales (Taxable)", value: summary.total_sales, color: "#4ade80" },
                    { label: "Total Purchases", value: summary.total_purchases, color: "#60a5fa" },
                    { label: "Net GST Payable", value: summary.net_gst_payable, color: summary.net_gst_payable > 0 ? "#f87171" : "#4ade80" },
                  ].map(k => (
                    <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>{k.label}</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(k.value)}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.3)", marginTop: "0.2rem" }}>{monthLabel}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)", fontWeight: 700, fontSize: "0.88rem" }}>GST Computation \u2014 {monthLabel}</div>
                  {[
                    { label: "Output Tax (Sales)", sub: "", value: summary.output_tax, indent: false, bold: true },
                    { label: "CGST Payable", sub: "9%", value: summary.cgst_payable, indent: true, bold: false },
                    { label: "SGST Payable", sub: "9%", value: summary.sgst_payable, indent: true, bold: false },
                    { label: "IGST Payable", sub: "18%", value: summary.igst_payable, indent: true, bold: false },
                    { label: "Input Tax Credit (Purchases)", sub: "", value: summary.input_credit, indent: false, bold: true },
                    { label: "Net GST Payable", sub: "Output \u2212 ITC", value: summary.net_gst_payable, indent: false, bold: true },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: `${row.indent ? "0.45" : "0.6"}rem ${row.indent ? "2" : "1"}rem`,
                      borderTop: "1px solid rgba(237,232,220,0.05)",
                      background: row.label === "Net GST Payable" ? "rgba(201,168,76,0.06)" : "transparent",
                    }}>
                      <div>
                        <span style={{ fontSize: row.bold ? "0.88rem" : "0.83rem", fontWeight: row.bold ? 700 : 400, color: row.indent ? "rgba(237,232,220,0.65)" : "#EDE8DC" }}>{row.label}</span>
                        {row.sub && <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "rgba(237,232,220,0.35)" }}>({row.sub})</span>}
                      </div>
                      <span style={{
                        fontVariantNumeric: "tabular-nums", fontWeight: row.bold ? 700 : 400,
                        color: row.label === "Net GST Payable" ? (row.value > 0 ? "#f87171" : "#4ade80") : "#EDE8DC",
                      }}>\u20B9{fmt(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "gstr1" && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>\u{1F4CB}</div>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>GSTR-1 \u2014 Outward Supplies</div>
                <div style={{ color: "rgba(237,232,220,0.5)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  Auto-prepared from your posted sales journal entries for {monthLabel}.
                </div>
                <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Total Taxable Supplies (B2B + B2C)</span>
                    <span style={{ fontWeight: 700 }}>\u20B9{fmt(summary.total_sales)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Integrated Tax (IGST)</span>
                    <span>\u20B9{fmt(summary.igst_payable)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Central Tax (CGST)</span>
                    <span>\u20B9{fmt(summary.cgst_payable)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>State Tax (SGST/UTGST)</span>
                    <span>\u20B9{fmt(summary.sgst_payable)}</span>
                  </div>
                </div>
                <a href={`/api/finance/gst?business_id=${bizId}&month=${selectedMonth}&report=gstr1`}
                  style={{ background: "#C9A84C", color: "#070C1A", padding: "10px 24px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" }}>
                  Download GSTR-1 JSON
                </a>
                <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(237,232,220,0.3)" }}>Full GSTR-1 JSON export \u2014 coming in next update</div>
              </div>
            )}

            {activeTab === "gstr3b" && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(237,232,220,0.08)", fontWeight: 700 }}>GSTR-3B Summary \u2014 {monthLabel}</div>
                {[
                  { section: "3.1", label: "Tax on outward and reverse charge inward supplies", value: summary.output_tax },
                  { section: "3.1(a)", label: "Outward taxable supplies (other than zero rated, nil and exempted)", value: summary.total_sales, sub: true },
                  { section: "4", label: "Eligible ITC", value: summary.input_credit },
                  { section: "4(A)(5)", label: "All other ITC (inputs, capital goods, services)", value: summary.input_credit, sub: true },
                  { section: "6.1", label: "Net Tax Payable (3.1 \u2212 4)", value: summary.net_gst_payable },
                ].map(row => (
                  <div key={row.section} style={{
                    display: "flex", gap: "1rem", padding: `${row.sub ? "0.5rem 1.5rem" : "0.75rem 1rem"}`,
                    borderTop: "1px solid rgba(237,232,220,0.06)",
                    background: row.section === "6.1" ? "rgba(201,168,76,0.06)" : "transparent",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.35)", width: 56, flexShrink: 0, fontFamily: "monospace" }}>{row.section}</span>
                    <span style={{ flex: 1, fontSize: row.sub ? "0.82rem" : "0.88rem", color: row.sub ? "rgba(237,232,220,0.65)" : "#EDE8DC", fontWeight: row.section === "6.1" ? 700 : 400 }}>{row.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: row.section === "6.1" ? 700 : 400, color: row.section === "6.1" && row.value > 0 ? "#f87171" : "#EDE8DC" }}>\u20B9{fmt(row.value)}</span>
                  </div>
                ))}
                <div style={{ padding: "1rem", borderTop: "1px solid rgba(237,232,220,0.08)", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                  <button onClick={() => {
                    const text = `GSTR-3B Summary \u2014 ${monthLabel}\nGSTIN: ${gstin}\n\nOutward Tax: \u20B9${fmt(summary.output_tax)}\nInput Credit: \u20B9${fmt(summary.input_credit)}\nNet Payable: \u20B9${fmt(summary.net_gst_payable)}`;
                    navigator.clipboard.writeText(text);
                  }} style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}>
                    Copy Summary
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
