"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { loadBookLines } from "@/lib/books";
import { partyBalances } from "@/lib/partyBalances";
import { readActiveBusiness } from "@/lib/activeBusiness";

type AREntry = {
  contact_id: string | null;
  contact_name: string;
  invoice_count: number;
  total_invoiced: number;
  total_received: number;
  outstanding: number;
  oldest_invoice: string;
  days_overdue: number;
};

export default function ReceivablesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      await loadReceivables(saved);
    });
  }, []);

  // B2 — one ledger per customer: balances, FIFO ageing and advances come from the ledgers themselves
  async function loadReceivables(bid: string) {
    setLoading(true);
    const today = new Date().toLocaleDateString("en-CA");
    const { lines, accounts } = await loadBookLines(supabase, bid, today);
    const report = partyBalances("receivable", accounts, lines, today);
    const result: AREntry[] = report.rows.map(r => {
      const own = lines.filter(l => l.account_id === r.id);
      return {
        contact_id: r.id, contact_name: r.name,
        invoice_count: own.filter(l => l.dr > 0).length,
        total_invoiced: own.reduce((s, l) => s + l.dr, 0), total_received: own.reduce((s, l) => s + l.cr, 0),
        outstanding: r.balance, oldest_invoice: r.oldest ?? "", days_overdue: r.days,
      };
    });
    setEntries(result);
    setTotalOutstanding(report.total);
    setOverdueAmount(result.filter(e => e.outstanding > 0 && e.days_overdue > 30).reduce((s, e) => s + e.outstanding, 0));
    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  function agingBucket(days: number) {
    if (days <= 30) return { label: "0–30 days", color: "#0B7A55" };
    if (days <= 60) return { label: "31–60 days", color: "#232A63" };
    if (days <= 90) return { label: "61–90 days", color: "#B4561E" };
    return { label: "90+ days", color: "#C2321F" };
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Receivables (AR)</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/sales/new" style={{ background: "#232A63", color: "#F5F6FA", padding: "6px 16px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.82rem" }}>
          + New Invoice
        </Link>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Accounts Receivable</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(20,26,58,0.65)", fontSize: "0.82rem" }}>Aging report — money customers owe you</p>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Total Outstanding", value: totalOutstanding, color: "#232A63", icon: "💰" },
            { label: "Overdue > 30 days", value: overdueAmount, color: "#C2321F", icon: "⚠️" },
            { label: "Customers with dues", value: entries.length, color: "#1F5EFF", icon: "👥", isCount: true },
            { label: "Avg per Customer", value: entries.length ? totalOutstanding / entries.length : 0, color: "rgba(20,26,58,0.95)", icon: "📊" },
          ].map(k => (
            <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>{k.icon}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>
                {k.isCount ? k.value : `${cur()}${fmt(k.value)}`}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.60)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Aging Summary */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", color: "rgba(20,26,58,0.75)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aging Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
            {[
              { label: "0–30 days", amount: entries.filter(e => e.days_overdue <= 30).reduce((s, e) => s + e.outstanding, 0), color: "#0B7A55" },
              { label: "31–60 days", amount: entries.filter(e => e.days_overdue > 30 && e.days_overdue <= 60).reduce((s, e) => s + e.outstanding, 0), color: "#232A63" },
              { label: "61–90 days", amount: entries.filter(e => e.days_overdue > 60 && e.days_overdue <= 90).reduce((s, e) => s + e.outstanding, 0), color: "#B4561E" },
              { label: "90+ days", amount: entries.filter(e => e.days_overdue > 90).reduce((s, e) => s + e.outstanding, 0), color: "#C2321F" },
            ].map(bucket => (
              <div key={bucket.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: bucket.color, fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(bucket.amount)}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>{bucket.label}</div>
                <div style={{ height: 3, background: bucket.amount > 0 ? bucket.color : "rgba(20,26,58,0.11)", borderRadius: 2, marginTop: "0.4rem", opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>Loading receivables…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No outstanding receivables</div>
            <div style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.85rem" }}>All customer invoices are settled, or no sales invoices posted yet.</div>
            <Link href="/finance/sales/new" style={{ display: "inline-block", marginTop: "1.5rem", background: "#232A63", color: "#F5F6FA", padding: "9px 22px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.88rem" }}>
              Raise Sales Invoice →
            </Link>
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFFFF" }}>
                  {["Customer", "Invoices", "Total Invoiced", "Received", "Outstanding", "Oldest Invoice", "Aging", "Action"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: ["Total Invoiced", "Received", "Outstanding"].includes(h) ? "right" : "left", fontSize: "0.65rem", color: "rgba(20,26,58,0.60)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const aging = agingBucket(e.days_overdue);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                      <td style={{ padding: "0.75rem 0.85rem", fontWeight: 600, fontSize: "0.85rem" }}>{e.contact_name}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.82rem", color: "rgba(20,26,58,0.75)" }}>{e.invoice_count}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(e.total_invoiced)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#0B7A55" }}>{cur()}{fmt(e.total_received)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: e.outstanding < 0 ? "#0B7A55" : aging.color }}>{e.outstanding < 0 ? "−" : ""}{cur()}{fmt(Math.abs(e.outstanding))}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>
                        {e.oldest_invoice ? new Date(e.oldest_invoice).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 12, background: `${aging.color}18`, color: aging.color, border: `1px solid ${aging.color}40`, fontWeight: 700 }}>
                          {e.outstanding < 0 ? "Advance received" : aging.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <Link href={`/finance/sales/new?contact=${e.contact_id}`} style={{ fontSize: "0.75rem", color: "#232A63", textDecoration: "none" }}>
                          New Invoice →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(35,42,99,0.3)", background: "rgba(35,42,99,0.05)" }}>
                  <td colSpan={4} style={{ padding: "0.7rem 0.85rem", fontWeight: 800, fontSize: "0.85rem" }}>Total outstanding (net of advances)</td>
                  <td style={{ padding: "0.7rem 0.85rem", textAlign: "right", fontWeight: 900, fontSize: "1rem", color: "#232A63", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(totalOutstanding)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
