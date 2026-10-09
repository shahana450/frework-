"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Gstr1Panel from "./Gstr1Panel";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type GSTSummary = {
  month: string;
  total_sales: number;
  taxable_sales?: number; nil_exempt_sales?: number; non_gst_sales?: number;
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
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
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
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>GST Returns</span>
        <div style={{ flex: 1 }} />
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ background: "rgba(35,42,99,0.1)", border: "1px solid rgba(35,42,99,0.3)", color: "#141A3A", padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>GST Returns</h1>
          {gstin && <div style={{ fontSize: "0.82rem", color: "rgba(20,26,58,0.65)" }}>{bizName} · GSTIN: {gstin}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(20,26,58,0.11)", marginBottom: "1.5rem", paddingBottom: 0 }}>
          {([
            { key: "dashboard", label: "Tax Summary" },
            { key: "gstr1", label: "GSTR-1 (Outward Supplies)" },
            { key: "gstr3b", label: "GSTR-3B (Summary Return)" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: "none", border: "none", color: activeTab === t.key ? "#232A63" : "rgba(20,26,58,0.70)",
              padding: "0.6rem 1rem", cursor: "pointer", fontWeight: activeTab === t.key ? 700 : 400, fontSize: "0.88rem",
              borderBottom: activeTab === t.key ? "2px solid #232A63" : "2px solid transparent", marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>

        {error && <div style={{ color: "#C2321F", background: "rgba(194,50,31,0.08)", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

        {!gstin && (
          <div style={{ background: "rgba(184,120,0,0.08)", border: "1px solid rgba(184,120,0,0.2)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "#8A5A00" }}>
            ⚠ GSTIN not set for this business. <Link href="/finance/settings/business" style={{ color: "#232A63", textDecoration: "none", fontWeight: 600 }}>Add it in Business Details →</Link>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(20,26,58,0.55)" }}>Calculating GST…</div>
        ) : summary && (
          <>
            {activeTab === "dashboard" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                  {[
                    { label: "Taxable sales", value: summary.taxable_sales ?? summary.total_sales, color: "#0B7A55" },
                    { label: "Total Purchases", value: summary.total_purchases, color: "#1F5EFF" },
                    { label: "Net GST Payable", value: summary.net_gst_payable, color: summary.net_gst_payable > 0 ? "#C2321F" : "#0B7A55" },
                  ].map(k => (
                    <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 10, padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>{k.label}</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>₹{fmt(k.value)}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.55)", marginTop: "0.2rem" }}>{monthLabel}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)", fontWeight: 700, fontSize: "0.88rem" }}>GST Computation — {monthLabel}</div>
                  {[
                    { label: "Output Tax (Sales)", sub: "", value: summary.output_tax, indent: false, bold: true },
                    { label: "CGST Payable", sub: "9%", value: summary.cgst_payable, indent: true, bold: false },
                    { label: "SGST Payable", sub: "9%", value: summary.sgst_payable, indent: true, bold: false },
                    { label: "IGST Payable", sub: "18%", value: summary.igst_payable, indent: true, bold: false },
                    { label: "Input Tax Credit (Purchases)", sub: "", value: summary.input_credit, indent: false, bold: true },
                    { label: "Net GST Payable", sub: "Output − ITC", value: summary.net_gst_payable, indent: false, bold: true },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: `${row.indent ? "0.45" : "0.6"}rem ${row.indent ? "2" : "1"}rem`,
                      borderTop: "1px solid rgba(20,26,58,0.08)",
                      background: row.label === "Net GST Payable" ? "rgba(35,42,99,0.06)" : "transparent",
                    }}>
                      <div>
                        <span style={{ fontSize: row.bold ? "0.88rem" : "0.83rem", fontWeight: row.bold ? 700 : 400, color: row.indent ? "rgba(20,26,58,0.90)" : "#141A3A" }}>{row.label}</span>
                        {row.sub && <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "rgba(20,26,58,0.60)" }}>({row.sub})</span>}
                      </div>
                      <span style={{
                        fontVariantNumeric: "tabular-nums", fontWeight: row.bold ? 700 : 400,
                        color: row.label === "Net GST Payable" ? (row.value > 0 ? "#C2321F" : "#0B7A55") : "#141A3A",
                      }}>₹{fmt(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "gstr1" && <Gstr1Panel bizId={bizId ?? ""} month={selectedMonth} monthLabel={monthLabel} />}

            {activeTab === "gstr3b" && (
              <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(20,26,58,0.11)", fontWeight: 700 }}>GSTR-3B Summary — {monthLabel}</div>
                {[
                  { section: "3.1", label: "Tax on outward and reverse charge inward supplies", value: summary.output_tax },
                  { section: "3.1(a)", label: "Outward taxable supplies (other than zero rated, nil and exempted)", value: summary.taxable_sales ?? summary.total_sales, sub: true },
                  { section: "3.1(c)", label: "Other outward supplies (nil rated, exempted)", value: summary.nil_exempt_sales ?? 0, sub: true },
                  { section: "3.1(e)", label: "Non-GST outward supplies", value: summary.non_gst_sales ?? 0, sub: true },
                  { section: "4", label: "Eligible ITC", value: summary.input_credit },
                  { section: "4(A)(5)", label: "All other ITC (inputs, capital goods, services)", value: summary.input_credit, sub: true },
                  { section: "6.1", label: "Net Tax Payable (3.1 − 4)", value: summary.net_gst_payable },
                ].map(row => (
                  <div key={row.section} style={{
                    display: "flex", gap: "1rem", padding: `${row.sub ? "0.5rem 1.5rem" : "0.75rem 1rem"}`,
                    borderTop: "1px solid rgba(20,26,58,0.08)",
                    background: row.section === "6.1" ? "rgba(35,42,99,0.06)" : "transparent",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.60)", width: 56, flexShrink: 0, fontFamily: "monospace" }}>{row.section}</span>
                    <span style={{ flex: 1, fontSize: row.sub ? "0.82rem" : "0.88rem", color: row.sub ? "rgba(20,26,58,0.90)" : "#141A3A", fontWeight: row.section === "6.1" ? 700 : 400 }}>{row.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: row.section === "6.1" ? 700 : 400, color: row.section === "6.1" && row.value > 0 ? "#C2321F" : "#141A3A" }}>₹{fmt(row.value)}</span>
                  </div>
                ))}
                <div style={{ padding: "1rem", borderTop: "1px solid rgba(20,26,58,0.11)", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                  <button onClick={() => {
                    const text = `GSTR-3B Summary — ${monthLabel}\nGSTIN: ${gstin}\n\nOutward Tax: ₹${fmt(summary.output_tax)}\nInput Credit: ₹${fmt(summary.input_credit)}\nNet Payable: ₹${fmt(summary.net_gst_payable)}`;
                    navigator.clipboard.writeText(text);
                  }} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}>
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