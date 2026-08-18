"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      await loadPayables(saved);
    });
  }, []);

  async function loadPayables(bid: string) {
    setLoading(true);

    const { data: journals } = await supabase
      .from("fw_fin_journals")
      .select("id,date,total_debit,total_credit,contact_id,type")
      .eq("business_id", bid)
      .eq("status", "posted")
      .in("type", ["purchase", "payment", "expense"]);

    type Journal = { id: string; date: string; total_debit: number; total_credit: number; contact_id: string | null; type: string };
    const jList = (journals ?? []) as Journal[];

    const { data: contactsData } = await supabase.from("fw_fin_contacts").select("id,name").eq("business_id", bid);
    const contactMap = new Map((contactsData ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

    const byContact = new Map<string | null, { bills: Journal[]; payments: Journal[] }>();
    for (const j of jList) {
      const key = j.contact_id;
      if (!byContact.has(key)) byContact.set(key, { bills: [], payments: [] });
      if (j.type === "purchase" || j.type === "expense") byContact.get(key)!.bills.push(j);
      else byContact.get(key)!.payments.push(j);
    }

    const today = new Date();
    const result: APEntry[] = [];

    for (const [contactId, { bills, payments }] of byContact) {
      const totalBilled = bills.reduce((s, j) => s + j.total_debit, 0);
      const totalPaid = payments.reduce((s, j) => s + j.total_debit, 0);
      const outstanding = totalBilled - totalPaid;
      if (outstanding <= 0) continue;

      const oldestDate = bills.reduce((oldest, j) => j.date < oldest ? j.date : oldest, bills[0]?.date ?? today.toISOString());
      const daysPending = Math.floor((today.getTime() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24));

      result.push({
        contact_id: contactId,
        contact_name: contactId ? (contactMap.get(contactId) ?? "Unknown Vendor") : "Misc / Untagged",
        bill_count: bills.length,
        total_billed: totalBilled,
        total_paid: totalPaid,
        outstanding,
        oldest_bill: oldestDate,
        days_pending: daysPending,
      });
    }

    result.sort((a, b) => b.outstanding - a.outstanding);
    setEntries(result);
    setTotalOutstanding(result.reduce((s, e) => s + e.outstanding, 0));
    setOverdueAmount(result.filter(e => e.days_pending > 30).reduce((s, e) => s + e.outstanding, 0));
    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  function agingBucket(days: number) {
    if (days <= 30) return { label: "0\u201330 days", color: "#4ade80" };
    if (days <= 60) return { label: "31\u201360 days", color: "#C9A84C" };
    if (days <= 90) return { label: "61\u201390 days", color: "#fb923c" };
    return { label: "90+ days", color: "#f87171" };
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>\u203A</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Payables (AP)</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/purchases/new" style={{ background: "#C9A84C", color: "#070C1A", padding: "6px 16px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.82rem" }}>
          + New Bill
        </Link>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Accounts Payable</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Aging report \u2014 money you owe to vendors</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Total Payable", value: totalOutstanding, color: "#f87171", icon: "\u{1F4E4}" },
            { label: "Overdue > 30 days", value: overdueAmount, color: "#fb923c", icon: "\u26A0\uFE0F" },
            { label: "Vendors with dues", value: entries.length, color: "#60a5fa", icon: "\u{1F3E2}", isCount: true },
            { label: "Avg per Vendor", value: entries.length ? totalOutstanding / entries.length : 0, color: "rgba(237,232,220,0.7)", icon: "\u{1F4CA}" },
          ].map(k => (
            <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>{k.icon}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>
                {k.isCount ? k.value : `\u20B9${fmt(k.value)}`}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.35)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", color: "rgba(237,232,220,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aging Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
            {[
              { label: "0\u201330 days", amount: entries.filter(e => e.days_pending <= 30).reduce((s, e) => s + e.outstanding, 0), color: "#4ade80" },
              { label: "31\u201360 days", amount: entries.filter(e => e.days_pending > 30 && e.days_pending <= 60).reduce((s, e) => s + e.outstanding, 0), color: "#C9A84C" },
              { label: "61\u201390 days", amount: entries.filter(e => e.days_pending > 60 && e.days_pending <= 90).reduce((s, e) => s + e.outstanding, 0), color: "#fb923c" },
              { label: "90+ days", amount: entries.filter(e => e.days_pending > 90).reduce((s, e) => s + e.outstanding, 0), color: "#f87171" },
            ].map(bucket => (
              <div key={bucket.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: bucket.color, fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(bucket.amount)}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>{bucket.label}</div>
                <div style={{ height: 3, background: bucket.amount > 0 ? bucket.color : "rgba(237,232,220,0.08)", borderRadius: 2, marginTop: "0.4rem", opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(237,232,220,0.3)" }}>Loading payables\u2026</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>\u2705</div>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No outstanding payables</div>
            <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.85rem" }}>All vendor bills are paid, or no purchase bills posted yet.</div>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Vendor", "Bills", "Total Billed", "Paid", "Outstanding", "Oldest Bill", "Aging", "Action"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: ["Total Billed", "Paid", "Outstanding"].includes(h) ? "right" : "left", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const aging = agingBucket(e.days_pending);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                      <td style={{ padding: "0.75rem 0.85rem", fontWeight: 600, fontSize: "0.85rem" }}>{e.contact_name}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.82rem", color: "rgba(237,232,220,0.5)" }}>{e.bill_count}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(e.total_billed)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#4ade80" }}>\u20B9{fmt(e.total_paid)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: aging.color }}>\u20B9{fmt(e.outstanding)}</td>
                      <td style={{ padding: "0.75rem 0.85rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>
                        {new Date(e.oldest_bill).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 12, background: `${aging.color}18`, color: aging.color, border: `1px solid ${aging.color}40`, fontWeight: 700 }}>
                          {aging.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.85rem" }}>
                        <Link href="/finance/journals/new" style={{ fontSize: "0.75rem", color: "#C9A84C", textDecoration: "none" }}>
                          Record Payment \u2192
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.05)" }}>
                  <td colSpan={4} style={{ padding: "0.7rem 0.85rem", fontWeight: 800, fontSize: "0.85rem" }}>Total Payable</td>
                  <td style={{ padding: "0.7rem 0.85rem", textAlign: "right", fontWeight: 900, fontSize: "1rem", color: "#f87171", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(totalOutstanding)}</td>
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
