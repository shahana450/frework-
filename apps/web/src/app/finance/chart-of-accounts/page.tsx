"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Link from "next/link";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string | null;
  is_system: boolean;
  is_group: boolean;
  description: string | null;
  sort_order: number;
};

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  asset: { label: "Assets", color: "#60a5fa" },
  liability: { label: "Liabilities", color: "#f87171" },
  equity: { label: "Capital & Equity", color: "#a78bfa" },
  income: { label: "Income", color: "#4ade80" },
  expense: { label: "Expenses", color: "#f59e0b" },
};

const SUB_TYPE_LABELS: Record<string, string> = {
  current_asset: "Current Asset", fixed_asset: "Fixed Asset",
  current_liability: "Current Liability", long_term_liability: "Long-term Liability",
  capital: "Capital", revenue: "Revenue", direct_income: "Direct Income", indirect_income: "Indirect Income",
  direct_expense: "Direct Expense", indirect_expense: "Indirect Expense",
};

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [bizId, setBizId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState("asset");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAcc, setNewAcc] = useState({ code: "", name: "", type: "expense", sub_type: "indirect_expense", description: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_$user.id`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_chart_of_accounts").select("*").eq("business_id", saved).order("sort_order");
      setAccounts(data ?? []);
      setLoading(false);
    });
  }, []);

  async function addAccount() {
    if (!bizId || !newAcc.code || !newAcc.name) { setError("Code and Name are required"); return; }
    setSaving(true); setError("");
    const { data, error: e } = await supabase.from("fw_fin_chart_of_accounts")
      .insert({ business_id: bizId, ...newAcc, is_system: false, is_group: false, sort_order: accounts.length + 1 })
      .select("*").single();
    if (e) { setError(e.message); setSaving(false); return; }
    setAccounts(prev => [...prev, data]);
    setNewAcc({ code: "", name: "", type: "expense", sub_type: "indirect_expense", description: "" });
    setShowAdd(false);
    setSaving(false);
  }

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    if (q) return a.name.toLowerCase().includes(q) || a.code.includes(q);
    return a.type === activeType;
  });

  const grouped = filtered.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.sub_type ?? a.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const typeCounts = TYPE_ORDER.reduce<Record<string, number>>((acc, t) => {
    acc[t] = accounts.filter(a => a.type === t).length;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Chart of Accounts</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAdd(true)} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
          + New Account
        </button>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {/* Type filter pills */}
          {!search && TYPE_ORDER.map(t => {
            const info = TYPE_LABEL[t];
            return (
              <button key={t} onClick={() => setActiveType(t)} style={{
                background: activeType === t ? `${info.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${activeType === t ? info.color : "rgba(237,232,220,0.1)"}`,
                color: activeType === t ? info.color : "rgba(237,232,220,0.5)",
                padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
              }}>
                {info.label} <span style={{ opacity: 0.6 }}>({typeCounts[t]})</span>
              </button>
            );
          })}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            style={{ marginLeft: "auto", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "6px 14px", borderRadius: 20, fontSize: "0.82rem", width: 220, outline: "none" }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(237,232,220,0.3)" }}>Loading…</div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Code", "Account Name", "Sub Type", "System", ""].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([subType, accs]) => (
                  <>
                    <tr key={`h-${subType}`} style={{ background: "rgba(255,255,255,0.015)" }}>
                      <td colSpan={5} style={{ padding: "0.5rem 1rem", fontSize: "0.72rem", color: "rgba(237,232,220,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {SUB_TYPE_LABELS[subType] ?? subType}
                      </td>
                    </tr>
                    {accs.map(acc => (
                      <tr key={acc.id} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", color: "rgba(237,232,220,0.5)", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>{acc.code}</td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", fontWeight: acc.is_group ? 700 : 400, color: acc.is_group ? "#C9A84C" : "#EDE8DC" }}>
                          {acc.is_group && <span style={{ marginRight: "0.4rem", fontSize: "0.7rem", opacity: 0.7 }}>▾</span>}
                          {acc.name}
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          {acc.sub_type && (
                            <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", background: "rgba(237,232,220,0.06)", padding: "2px 8px", borderRadius: 4 }}>
                              {SUB_TYPE_LABELS[acc.sub_type] ?? acc.sub_type}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          {acc.is_system && <span style={{ fontSize: "0.68rem", color: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.08)", padding: "2px 6px", borderRadius: 3 }}>System</span>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", textAlign: "right" }}>
                          {!acc.is_system && (
                            <button style={{ background: "none", border: "none", color: "rgba(237,232,220,0.3)", cursor: "pointer", fontSize: "0.78rem" }}>Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.85rem" }}>No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Account Modal */}
        {showAdd && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: "#0d1526", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14, padding: "1.75rem", width: 440, maxWidth: "95vw" }}>
              <h3 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}>New Account</h3>
              {[
                { label: "Account Code *", key: "code", placeholder: "e.g. 5112" },
                { label: "Account Name *", key: "name", placeholder: "e.g. Repair & Maintenance" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>{f.label}</label>
                  <input value={newAcc[f.key as "code" | "name"]} onChange={e => setNewAcc(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.15)", color: "#EDE8DC", padding: "9px 12px", borderRadius: 7, fontSize: "0.88rem", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", marginBottom: "0.3rem" }}>Type</label>
                  <select value={newAcc.type} onChange={e => setNewAcc(p => ({ ...p, type: e.target.value }))}
                    style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.15)", color: "#EDE8DC", padding: "9px 12px", borderRadius: 7, fontSize: "0.88rem" }}>
                    {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t].label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", marginBottom: "0.3rem" }}>Sub Type</label>
                  <select value={newAcc.sub_type} onChange={e => setNewAcc(p => ({ ...p, sub_type: e.target.value }))}
                    style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.15)", color: "#EDE8DC", padding: "9px 12px", borderRadius: 7, fontSize: "0.88rem" }}>
                    {Object.entries(SUB_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {error && <div style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: "1rem" }}>{error}</div>}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAdd(false); setError(""); }} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontSize: "0.88rem" }}>Cancel</button>
                <button onClick={addAccount} disabled={saving} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
                  {saving ? "Saving…" : "Add Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

