"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Invoice = { id: string; entry_no: string; date: string; narration: string; total_credit: number; status: string; contact_id: string | null };
type Contact = { id: string; name: string };

export default function SalesListPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posted" | "draft">("all");
  const [search, setSearch] = useState("");

  const [totals, setTotals] = useState({ count: 0, total: 0, posted: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [invoicesRes, contactsRes] = await Promise.all([
        supabase.from("fw_fin_journals").select("id,entry_no,date,narration,total_credit,status,contact_id").eq("business_id", saved).eq("type", "sales").order("date", { ascending: false }),
        supabase.from("fw_fin_contacts").select("id,name").eq("business_id", saved),
      ]);

      const inv = (invoicesRes.data ?? []) as Invoice[];
      setInvoices(inv);
      const cMap: Record<string, string> = {};
      ((contactsRes.data ?? []) as Contact[]).forEach(c => { cMap[c.id] = c.name; });
      setContacts(cMap);
      setTotals({
        count: inv.length,
        total: inv.reduce((s, i) => s + i.total_credit, 0),
        posted: inv.filter(i => i.status === "posted").reduce((s, i) => s + i.total_credit, 0),
      });
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter(i => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.entry_no?.toLowerCase().includes(q) || i.narration?.toLowerCase().includes(q) || contacts[i.contact_id ?? ""]?.toLowerCase().includes(q);
    }
    return true;
  });

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const statusColor = (s: string) => s === "posted" ? "#0B7A55" : s === "draft" ? "#232A63" : "rgba(20,26,58,0.65)";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Sales Invoices</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/sales/new" style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "7px 16px", borderRadius: 7, textDecoration: "none", fontWeight: 700, fontSize: "0.82rem" }}>
          + New Invoice
        </Link>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 1rem", fontSize: "1.3rem", fontWeight: 800 }}>Sales Invoices</h1>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Invoices", value: totals.count, color: "#1F5EFF", prefix: "" },
            { label: "Total Billed", value: totals.total, color: "#232A63", prefix: "₹" },
            { label: "Total Posted", value: totals.posted, color: "#0B7A55", prefix: "₹" },
          ].map(k => (
            <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 10, padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>
                {k.prefix}{typeof k.value === "number" && k.prefix ? fmt(k.value) : k.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.60)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["all", "posted", "draft"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 7, fontSize: "0.8rem", cursor: "pointer", border: "none", fontWeight: filter === f ? 700 : 400, background: filter === f ? "rgba(35,42,99,0.15)" : "rgba(20,26,58,0.08)", color: filter === f ? "#232A63" : "rgba(20,26,58,0.70)" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices…"
            style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "6px 12px", borderRadius: 7, fontSize: "0.82rem", outline: "none", flex: 1, maxWidth: 300 }} />
        </div>

        {/* Table */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🧾</div>
              <div>{search ? "No invoices match your search." : "No sales invoices yet."}</div>
              <Link href="/finance/sales/new" style={{ display: "inline-block", marginTop: "1rem", color: "#232A63", textDecoration: "none", fontSize: "0.85rem" }}>→ Create First Invoice</Link>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFFFF" }}>
                  {["Invoice No", "Date", "Customer", "Narration", "Amount", "Status"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: h === "Amount" ? "right" : "left", fontSize: "0.65rem", color: "rgba(20,26,58,0.60)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                    <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.82rem", color: "#232A63" }}>{inv.entry_no}</td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", color: "rgba(20,26,58,0.80)", whiteSpace: "nowrap" }}>
                      {new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.82rem", color: "rgba(20,26,58,0.95)" }}>{contacts[inv.contact_id ?? ""] ?? "—"}</td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(20,26,58,0.80)" }}>{inv.narration}</td>
                    <td style={{ padding: "0.65rem 1rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₹{fmt(inv.total_credit)}</td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 8, background: `${statusColor(inv.status)}18`, color: statusColor(inv.status), fontWeight: 600, textTransform: "capitalize" }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(35,42,99,0.25)", background: "rgba(35,42,99,0.04)" }}>
                  <td colSpan={4} style={{ padding: "0.7rem 1rem", fontWeight: 800 }}>Total ({filtered.length} invoices)</td>
                  <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 900, color: "#232A63", fontVariantNumeric: "tabular-nums" }}>
                    ₹{fmt(filtered.reduce((s, i) => s + i.total_credit, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
