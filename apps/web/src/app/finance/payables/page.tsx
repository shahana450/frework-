"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { loadBookLines } from "@/lib/books";
import { partyBalances } from "@/lib/partyBalances";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { msmeReport, type MsmeReport, type MsmeSupplier } from "@/lib/msme43bh";
import MsmePanel from "./MsmePanel";

type APEntry = {
  contact_id: string | null;
  contact_name: string;
  bill_count: number;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  oldest_bill: string;
  days_pending: number;
};

export default function PayablesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [entries, setEntries] = useState<APEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [msme, setMsme] = useState<{ report: MsmeReport | null; setup: boolean; marked: number }>({ report: null, setup: false, marked: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      await loadPayables(saved);
    });
  }, []);

  // B2 — one ledger per supplier: balances, FIFO ageing and advances paid come from the ledgers themselves
  async function loadPayables(bid: string) {
    setLoading(true);
    const today = new Date().toLocaleDateString("en-CA");
    const { lines, accounts } = await loadBookLines(supabase, bid, today);
    const report = partyBalances("payable", accounts, lines, today);
    const result: APEntry[] = report.rows.map(r => {
      const own = lines.filter(l => l.account_id === r.id);
      return {
        contact_id: r.id, contact_name: r.name,
        bill_count: own.filter(l => l.cr > 0).length,
        total_billed: own.reduce((s, l) => s + l.cr, 0), total_paid: own.reduce((s, l) => s + l.dr, 0),
        outstanding: r.balance, oldest_bill: r.oldest ?? "", days_pending: r.days,
      };
    });
    setEntries(result);
    setTotalOutstanding(report.total);
    setOverdueAmount(result.filter(e => e.outstanding > 0 && e.days_pending > 30).reduce((s, e) => s + e.outstanding, 0));
    // Section 43B(h): MSME suppliers (marked in Customers & Suppliers) matched to their ledgers by name
    const { data: cs, error: ce } = await supabase.from("fw_fin_contacts").select("name,msme_type,msme_written_terms,credit_days").eq("business_id", bid).not("msme_type", "is", null);
    if (ce) setMsme({ report: null, setup: /msme|column/i.test(ce.message), marked: 0 });
    else {
      const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const byName = new Map(((cs ?? []) as { name: string; msme_type: MsmeSupplier["type"]; msme_written_terms: boolean; credit_days: number | null }[]).map(x => [key(x.name), x]));
      const sups: MsmeSupplier[] = accounts.filter(a => byName.has(key(a.name))).map(a => { const x = byName.get(key(a.name))!; return { accountId: a.id, name: a.name, type: x.msme_type, creditDays: x.msme_written_terms ? x.credit_days : null }; });
      setMsme({ report: msmeReport(sups, lines, today), setup: false, marked: (cs ?? []).length });
    }
    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  function agingBucket(days: number) {
    if (days <= 30) return { label: "0–30 days", color: "#0B7A55" };
    if (days <= 60) return { label: "31–60 days", color: "#12352D" };
    if (days <= 90) return { label: "61–90 days", color: "#B4561E" };
    return { label: "90+ days", color: "#B4321F" };
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(18,53,45,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#12352D", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(16,36,31,0.55)" }}>›</span>
        <span style={{ color: "rgba(16,36,31,0.85)", fontSize: "0.85rem" }}>Payables (AP)</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/purchases/new" style={{ background: "#12352D", color: "#F4EFE4", padding: "6px 16px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.82rem" }}>
          + New Bill
        </Link>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Accounts Payable</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(16,36,31,0.65)", fontSize: "0.82rem" }}>Aging report — money you owe to vendors</p>

        {!loading && <MsmePanel report={msme.report} setupNeeded={msme.setup} marked={msme.marked} />}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Total Payable", value: totalOutstanding, color: "#B4321F", icon: "📤" },
            { label: "Overdue > 30 days", value: overdueAmount, color: "#B4561E", icon: "⚠️" },
            { label: "Vendors with dues", value: entries.length, color: "#12352D", icon: "🏢", isCount: true },
            { label: "Avg per Vendor", value: entries.length ? totalOutstanding / entries.length : 0, color: "rgba(16,36,31,0.95)", icon: "📊" },
          ].map(k => (
            <div key={k.label} style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>{k.icon}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>
                {k.isCount ? k.value : `${cur()}${fmt(k.value)}`}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(16,36,31,0.60)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", color: "rgba(16,36,31,0.75)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aging Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
            {[
              { label: "0–30 days", amount: entries.filter(e => e.days_pending <= 30).reduce((s, e) => s + e.outstanding, 0), color: "#0B7A55" },
              { label: "31–60 days", amount: entries.filter(e => e.days_pending > 30 && e.days_pending <= 60).reduce((s, e) => s + e.outstanding, 0), color: "#12352D" },
              { label: "61–90 days", amount: entries.filter(e => e.days_pending > 60 && e.days_pending <= 90).reduce((s, e) => s + e.outstanding, 0), color: "#B4561E" },
              { label: "90+ days", amount: entries.filter(e => e.days_pending > 90).reduce((s, e) => s + e.outstanding, 0), color: "#B4321F" },
            ].map(bucket => (
              <div key={bucket.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: bucket.color, fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(bucket.amount)}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(16,36,31,0.65)", marginTop: "0.2rem" }}>{bucket.label}</div>
                <div style={{ height: 3, background: bucket.amount > 0 ? bucket.color : "rgba(16,36,31,0.11)", borderRadius: 2, marginTop: "0.4rem", opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(16,36,31,0.55)" }}>Loading payables…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No outstanding payables</div>
            <div style={{ color: "rgba(16,36,31,0.65)", fontSize: "0.85rem" }}>All vendor bills are paid, or no purchase bills posted yet.</div>
          </div>
        ) : (
          <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFDF8" }}>
                  {["Vendor", "Bills", "Total Billed", "Paid", "Outstanding", "Oldest Bill", "Aging", "Action"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: ["Total Billed", "Paid", "Outstanding"].includes(h) ? "right" : "left", fontSize: "0.65rem", color: "rgba(16,36,31,0.60)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const aging = agingBucket(e.days_pending);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid rgba(16,36,31,0.08)" }}>
                      <td style={{ padding: "0.75rem 0.85rem", fontWeight: 600, fontSize: "0.85rem" }}>{e.contact_name}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.82rem", color: "rgba(16,36,31,0.75)" }}>{e.bill_count}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(e.total_billed)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#0B7A55" }}>{cur()}{fmt(e.total_paid)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: e.outstanding < 0 ? "#0B7A55" : aging.color }}>{e.outstanding < 0 ? "−" : ""}{cur()}{fmt(Math.abs(e.outstanding))}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.78rem", color: "rgba(16,36,31,0.65)" }}>
                        {e.oldest_bill ? new Date(e.oldest_bill).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 12, background: `${aging.color}18`, color: aging.color, border: `1px solid ${aging.color}40`, fontWeight: 700 }}>
                          {aging.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <Link href="/finance/journals/new" style={{ fontSize: "0.75rem", color: "#12352D", textDecoration: "none" }}>
                          Record Payment →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(18,53,45,0.3)", background: "rgba(18,53,45,0.05)" }}>
                  <td colSpan={4} style={{ padding: "0.7rem 0.85rem", fontWeight: 800, fontSize: "0.85rem" }}>Total Payable</td>
                  <td style={{ padding: "0.7rem 0.85rem", textAlign: "right", fontWeight: 900, fontSize: "1rem", color: "#B4321F", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(totalOutstanding)}</td>
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
