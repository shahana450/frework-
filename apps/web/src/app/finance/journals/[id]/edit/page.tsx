"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Account = { id: string; code: string; name: string; type: string };
type Line = { id?: string; account_id: string; account_name: string; dr: string; cr: string; narration: string };

const VOUCHER_TYPES = [
  { value: "journal", label: "Journal Voucher (JV)" },
  { value: "payment", label: "Payment Voucher (PV)" },
  { value: "receipt", label: "Receipt Voucher (RV)" },
  { value: "expense", label: "Expense" },
  { value: "sales", label: "Sales Entry" },
  { value: "purchase", label: "Purchase Entry" },
  { value: "contra", label: "Contra Voucher (CV)" },
  { value: "debit_note", label: "Debit Note" },
  { value: "credit_note", label: "Credit Note" },
];

const inp: React.CSSProperties = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "8px 10px", borderRadius: 6, fontSize: "0.84rem", outline: "none", width: "100%", boxSizing: "border-box" };

export default function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState("");
  const [type, setType] = useState("journal");
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [entryNo, setEntryNo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [coaRes, jRes, linesRes] = await Promise.all([
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_journals").select("*").eq("id", id).single(),
        supabase.from("fw_fin_journal_lines").select("id,account_id,dr_amount,cr_amount,narration,fw_fin_chart_of_accounts(name)").eq("journal_id", id).order("sort_order"),
      ]);

      setAccounts(coaRes.data ?? []);
      if (jRes.data) {
        setDate(jRes.data.date?.slice(0, 10) ?? "");
        setType(jRes.data.type ?? "journal");
        setNarration(jRes.data.narration ?? "");
        setRefNo(jRes.data.reference_no ?? "");
        setEntryNo(jRes.data.entry_no ?? "");
      }
      setLines((linesRes.data ?? []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        account_id: l.account_id as string ?? "",
        account_name: (l.fw_fin_chart_of_accounts as Record<string, unknown> | null)?.name as string ?? "",
        dr: String(l.dr_amount ?? ""),
        cr: String(l.cr_amount ?? ""),
        narration: l.narration as string ?? "",
      })));
      setLoading(false);
    });
  }, [id, router]);

  function updateLine(i: number, field: keyof Line, val: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }
  function addLine() {
    setLines(prev => [...prev, { account_id: "", account_name: "", dr: "", cr: "", narration: "" }]);
  }
  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }
  function selectAccount(i: number, acc: Account) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, account_id: acc.id, account_name: acc.name } : l));
    setSearch(p => ({ ...p, [i]: "" }));
    setShowDropdown(null);
  }

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.dr) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.cr) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  async function save() {
    if (!bizId || !date) { setError("Date is required"); return; }
    if (!balanced) { setError(`Not balanced: DR ₹${totalDr.toFixed(2)} ≠ CR ₹${totalCr.toFixed(2)}`); return; }
    if (lines.some(l => !l.account_id)) { setError("All lines must have an account selected"); return; }
    setSaving(true); setError("");

    await supabase.from("fw_fin_journals").update({
      date, type, narration, reference_no: refNo || null,
      total_debit: totalDr, total_credit: totalCr,
    }).eq("id", id);

    await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", id);
    await supabase.from("fw_fin_journal_lines").insert(
      lines.map((l, i) => ({
        journal_id: id,
        account_id: l.account_id,
        dr_amount: parseFloat(l.dr) || 0,
        cr_amount: parseFloat(l.cr) || 0,
        narration: l.narration || narration,
        sort_order: i,
      }))
    );

    setSaving(false);
    router.push("/finance/tally");
  }

  if (loading) return <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>;

  const filteredAccounts = (i: number) => {
    const q = (search[i] ?? "").toLowerCase();
    return q ? accounts.filter(a => a.name.toLowerCase().includes(q) || a.code.includes(q)) : accounts;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance/tally" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>← Tally Bridge</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Edit Journal {entryNo}</span>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem" }}>
        <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 800 }}>Edit Journal Entry</h2>

        {/* Header fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Voucher Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {VOUCHER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Reference No</label>
            <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Invoice / Bill no." style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Narration</label>
          <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of transaction" style={inp} />
        </div>

        {/* Lines */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, overflow: "hidden", marginBottom: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Account / Ledger", "DR (₹)", "CR (₹)", "Narration", ""].map(h => (
                  <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(237,232,220,0.05)" }}>
                  <td style={{ padding: "0.4rem 0.6rem", position: "relative", minWidth: 220 }}>
                    <input
                      value={showDropdown === i ? (search[i] ?? "") : line.account_name}
                      onFocus={() => { setShowDropdown(i); setSearch(p => ({ ...p, [i]: "" })); }}
                      onChange={e => setSearch(p => ({ ...p, [i]: e.target.value }))}
                      placeholder="Search account…"
                      style={{ ...inp, fontSize: "0.8rem" }}
                    />
                    {showDropdown === i && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1526", border: "1px solid rgba(237,232,220,0.15)", borderRadius: 6, zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
                        {filteredAccounts(i).slice(0, 30).map(acc => (
                          <div key={acc.id} onMouseDown={() => selectAccount(i, acc)} style={{ padding: "0.45rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", color: "#EDE8DC" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                            <span style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.72rem", marginRight: 8 }}>{acc.code}</span>{acc.name}
                          </div>
                        ))}
                        {filteredAccounts(i).length === 0 && <div style={{ padding: "0.5rem 0.75rem", color: "rgba(237,232,220,0.3)", fontSize: "0.78rem" }}>No accounts found</div>}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", width: 110 }}>
                    <input type="number" value={line.dr} onChange={e => updateLine(i, "dr", e.target.value)} placeholder="0.00" style={{ ...inp, fontSize: "0.8rem", color: "#4ade80" }} />
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", width: 110 }}>
                    <input type="number" value={line.cr} onChange={e => updateLine(i, "cr", e.target.value)} placeholder="0.00" style={{ ...inp, fontSize: "0.8rem", color: "#60a5fa" }} />
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    <input value={line.narration} onChange={e => updateLine(i, "narration", e.target.value)} placeholder="Line narration" style={{ ...inp, fontSize: "0.78rem" }} />
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>
                    <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(237,232,220,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, fontSize: "0.75rem", color: "rgba(237,232,220,0.4)" }}>
                  <button onClick={addLine} style={{ background: "none", border: "1px solid rgba(237,232,220,0.2)", color: "#EDE8DC", padding: "3px 12px", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>+ Add Line</button>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 800, color: "#4ade80", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>₹{totalDr.toFixed(2)}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 800, color: "#60a5fa", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>₹{totalCr.toFixed(2)}</td>
                <td colSpan={2} style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: balanced ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {balanced ? "✓ Balanced" : `⚠ Difference: ₹${Math.abs(totalDr - totalCr).toFixed(2)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {error && <div style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: "1rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 7, padding: "0.6rem 1rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/finance/tally" style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "9px 20px", borderRadius: 8, textDecoration: "none", fontSize: "0.88rem" }}>Cancel</Link>
          <button onClick={save} disabled={saving || !balanced} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "9px 24px", borderRadius: 8, fontWeight: 800, fontSize: "0.88rem", cursor: saving || !balanced ? "not-allowed" : "pointer", opacity: saving || !balanced ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save & Return to Tally"}
          </button>
        </div>
      </div>
    </div>
  );
}
