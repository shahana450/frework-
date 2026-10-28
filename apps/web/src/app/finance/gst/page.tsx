"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Gstr1Panel from "./Gstr1Panel";
import Link from "next/link";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";
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
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      {(() => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const nxt = new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short" });
        return (
          <PageHero eyebrow={`Goods & services tax · ${monthLabel}`} title="GST returns, from your books"
            sub={gstin ? `${bizName} · GSTIN ${gstin}` : undefined}
            actions={<select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} aria-label="Return month"
              style={{ height: 46, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.28)", background: HT.green, color: "#FFFFFF", fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>
              {monthOptions.map(mo => <option key={mo.value} value={mo.value}>{mo.label}</option>)}
            </select>}
            tiles={[
              { label: "Taxable sales", value: summary ? `₹${fmt(summary.taxable_sales ?? summary.total_sales)}` : "—" },
              { label: "Purchases", value: summary ? `₹${fmt(summary.total_purchases)}` : "—" },
              ...(gstin ? [{ label: "Net GST payable", value: summary ? `₹${fmt(summary.net_gst_payable)}` : "—", tone: (summary && summary.net_gst_payable > 0 ? "bad" : "good") as "bad" | "good", sub: `GSTR-1 due 11 ${nxt} · GSTR-3B due 20 ${nxt}` }] : []),
            ]}
            side={gstin ? undefined : <>
              <div style={{ fontSize: 17 }}><span style={{ color: HT.rose }}>●</span> GSTIN not set</div>
              <ol style={{ margin: "8px 0 14px", paddingLeft: 20, fontSize: 14, color: "#D3DCD8", lineHeight: 1.6 }}><li>Add your GSTIN in Business details</li><li>Returns are prepared from posted invoices and bills</li></ol>
              <HeroAction href="/finance/settings/business" primary>Add GSTIN →</HeroAction>
            </>} />
        );
      })()}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          {([
            { key: "dashboard", label: "Tax summary" },
            { key: "gstr1", label: "GSTR-1 · outward supplies" },
            { key: "gstr3b", label: "GSTR-3B · summary return" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ height: 42, padding: "0 18px", borderRadius: 999, border: `1px solid ${activeTab === t.key ? HT.green : HT.line}`, background: activeTab === t.key ? HT.green : HT.paper, color: activeTab === t.key ? "#FFFFFF" : HT.ink, fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>{t.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 14, color: HT.muted }}>{(() => { const [y, m] = selectedMonth.split("-").map(Number); const nx = new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short" }); return `GSTR-1 due 11 ${nx} · GSTR-3B due 20 ${nx} (monthly)`; })()}</span>
        </div>

        {error && <div style={{ color: "#B4321F", background: "#FBECE8", padding: "1rem", borderRadius: 12, marginBottom: "1rem" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(16,36,31,0.55)" }}>Calculating GST…</div>
        ) : summary && (
          <>
            {activeTab === "dashboard" && (
              <>
                <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.11)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(16,36,31,0.11)", fontWeight: 700, fontSize: "0.88rem" }}>GST Computation — {monthLabel}</div>
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
                      borderTop: "1px solid rgba(16,36,31,0.08)",
                      background: row.label === "Net GST Payable" ? "rgba(18,53,45,0.06)" : "transparent",
                    }}>
                      <div>
                        <span style={{ fontSize: row.bold ? "0.88rem" : "0.83rem", fontWeight: row.bold ? 700 : 400, color: row.indent ? "rgba(16,36,31,0.90)" : "#10241F" }}>{row.label}</span>
                        {row.sub && <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "rgba(16,36,31,0.60)" }}>({row.sub})</span>}
                      </div>
                      <span style={{
                        fontVariantNumeric: "tabular-nums", fontWeight: row.bold ? 700 : 400,
                        color: row.label === "Net GST Payable" ? (row.value > 0 ? "#B4321F" : "#0B7A55") : "#10241F",
                      }}>₹{fmt(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "gstr1" && <Gstr1Panel bizId={bizId ?? ""} month={selectedMonth} monthLabel={monthLabel} />}

            {activeTab === "gstr3b" && (
              <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.11)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(16,36,31,0.11)", fontWeight: 700 }}>GSTR-3B Summary — {monthLabel}</div>
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
                    borderTop: "1px solid rgba(16,36,31,0.08)",
                    background: row.section === "6.1" ? "rgba(18,53,45,0.06)" : "transparent",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(16,36,31,0.60)", width: 56, flexShrink: 0, fontFamily: "monospace" }}>{row.section}</span>
                    <span style={{ flex: 1, fontSize: row.sub ? "0.82rem" : "0.88rem", color: row.sub ? "rgba(16,36,31,0.90)" : "#10241F", fontWeight: row.section === "6.1" ? 700 : 400 }}>{row.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: row.section === "6.1" ? 700 : 400, color: row.section === "6.1" && row.value > 0 ? "#B4321F" : "#10241F" }}>₹{fmt(row.value)}</span>
                  </div>
                ))}
                <div style={{ padding: "1rem", borderTop: "1px solid rgba(16,36,31,0.11)", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                  <button onClick={() => {
                    const text = `GSTR-3B Summary — ${monthLabel}\nGSTIN: ${gstin}\n\nOutward Tax: ₹${fmt(summary.output_tax)}\nInput Credit: ₹${fmt(summary.input_credit)}\nNet Payable: ₹${fmt(summary.net_gst_payable)}`;
                    navigator.clipboard.writeText(text);
                  }} style={{ background: "rgba(16,36,31,0.08)", border: "1px solid rgba(16,36,31,0.14)", color: "#10241F", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}>
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