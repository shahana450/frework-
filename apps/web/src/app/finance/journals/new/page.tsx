"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Account = { id: string; code: string; name: string; type: string };
type Line = { account_id: string; account_name: string; dr: string; cr: string; narration: string };

const VOUCHER_TYPES = [
  { value: "journal", label: "Journal Voucher (JV)" },
  { value: "payment", label: "Payment Voucher (PV)" },
  { value: "receipt", label: "Receipt Voucher (RV)" },
  { value: "sales", label: "Sales Entry" },
  { value: "purchase", label: "Purchase Entry" },
  { value: "contra", label: "Contra Voucher (CV)" },
  { value: "debit_note", label: "Debit Note" },
  { value: "credit_note", label: "Credit Note" },
];

export default function NewJournalPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("journal");
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", account_name: "", dr: "", cr: "", narration: "" },
    { account_id: "", account_name: "", dr: "", cr: "", narration: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const [coaRes, fyRes] = await Promise.all([
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
      ]);
      setAccounts(coaRes.data ?? []);
      setFyId(fyRes.data?.id ?? null);
    });
  }, []);

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.dr) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.cr) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;
  const diff = totalDr - totalCr;

  function setLine(i: number, k: keyof Line, v: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function selectAccount(i: number, acc: Account) {
    setLine(i, "account_id", acc.id);
    setLine(i, "account_name", acc.name);
    setSearch(prev => ({ ...prev, [i]: acc.name }));
    setShowDropdown(null);
  }

  function addLine() {
    setLines(prev => [...prev, { account_id: "", account_name: "", dr: "", cr: "", narration: "" }]);
  }

  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  function autoBalance(i: number, side: "dr" | "cr") {
    const val = parseFloat(lines[i][side]) || 0;
    if (val === 0 || lines.length < 2) return;
    const otherIdx = i === 0 ? 1 : 0;
    if (!lines[otherIdx].dr && !lines[otherIdx].cr) {
      const oppSide = side === "dr" ? "cr" : "dr";
      setLine(otherIdx, oppSide, val.toString());
    }
  }

  async function save(status: "draft" | "posted") {
    if (!bizId) return;
    if (lines.some(l => !l.account_id)) { setError("All lines must have an account selected"); return; }
    if (!balanced) { setError(`Entry is unbalanced by ₹${Math.abs(diff).toFixed(2)}. Debit must equal Credit.`); return; }
    setSaving(true); setError("");

    try {
      await saveEntry({
        business_id: bizId, mode: status === "posted" ? "post" : "draft", date, narration, type, source: "manual_journal",
        reference_no: refNo || null,
        lines: lines.filter(l => l.account_id).map(l => ({ account_id: l.account_id, dr: parseFloat(l.dr) || 0, cr: parseFloat(l.cr) || 0, narration: l.narration || narration })),
      });

      router.push("/finance/journals");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filteredAccounts = (idx: number) => {
    const q = (search[idx] ?? "").toLowerCase();
    if (!q) return accounts.slice(0, 20);
    return accounts.filter(a => a.name.toLowerCase().includes(q) || a.code.includes(q)).slice(0, 10);
  };

  const inp: React.CSSProperties = { background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }} onClick={() => setShowDropdown(null)}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <Link href="/finance/journals" style={{ color: "rgba(20,26,58,0.75)", fontSize: "0.85rem", textDecoration: "none" }}>Journal Entries</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>New Entry</span>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 1.75rem", fontSize: "1.4rem", fontWeight: 800 }}>New Journal Entry</h1>

        {/* Header Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Voucher Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
              {VOUCHER_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Reference No.</label>
            <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Bill/Invoice No." style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Narration</label>
            <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of entry" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Journal Lines */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 12, overflow: "hidden", marginBottom: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FFFFFF" }}>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", width: "40%" }}>Account</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", width: "18%" }}>Debit (₹)</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", width: "18%" }}>Credit (₹)</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Narration</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                  {/* Account Search */}
                  <td style={{ padding: "0.5rem 0.75rem", position: "relative" }} onClick={e => e.stopPropagation()}>
                    <input
                      value={search[i] ?? line.account_name}
                      onChange={e => { setSearch(prev => ({ ...prev, [i]: e.target.value })); setShowDropdown(i); }}
                      onFocus={() => setShowDropdown(i)}
                      placeholder="Search account…"
                      style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                    />
                    {showDropdown === i && filteredAccounts(i).length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: "1px solid rgba(35,42,99,0.3)", borderRadius: 6, zIndex: 50, maxHeight: 220, overflowY: "auto" }}>
                        {filteredAccounts(i).map(acc => (
                          <div key={acc.id} onMouseDown={() => selectAccount(i, acc)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "0.83rem", display: "flex", gap: "0.5rem" }}>
                            <span style={{ color: "rgba(20,26,58,0.65)", fontFamily: "monospace", fontSize: "0.75rem" }}>{acc.code}</span>
                            <span>{acc.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <input type="number" value={line.dr} placeholder="0.00"
                      onChange={e => setLine(i, "dr", e.target.value)}
                      onBlur={() => autoBalance(i, "dr")}
                      style={{ ...inp, width: "100%", boxSizing: "border-box", textAlign: "right" }} />
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <input type="number" value={line.cr} placeholder="0.00"
                      onChange={e => setLine(i, "cr", e.target.value)}
                      onBlur={() => autoBalance(i, "cr")}
                      style={{ ...inp, width: "100%", boxSizing: "border-box", textAlign: "right" }} />
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <input value={line.narration} onChange={e => setLine(i, "narration", e.target.value)} placeholder="optional"
                      style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </td>
                  <td style={{ padding: "0.5rem 0.5rem" }}>
                    <button onClick={() => removeLine(i)} disabled={lines.length <= 2} style={{ background: "none", border: "none", color: "rgba(20,26,58,0.55)", cursor: "pointer", fontSize: "1rem", opacity: lines.length <= 2 ? 0.3 : 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid rgba(20,26,58,0.14)", background: "#FFFFFF" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.85rem" }}>Total</td>
                <td style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#141A3A" }}>{totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#141A3A" }}>{totalCr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td colSpan={2} style={{ padding: "0.6rem 1rem", fontSize: "0.78rem", color: balanced ? "#0B7A55" : "#C2321F", fontWeight: 600, textAlign: "right" }}>
                  {balanced ? "✓ Balanced" : `⚠ Difference: ₹${Math.abs(diff).toFixed(2)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <button onClick={addLine} style={{ background: "none", border: "1px dashed rgba(20,26,58,0.28)", color: "rgba(20,26,58,0.65)", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", marginBottom: "1.5rem" }}>
          + Add Line
        </button>

        {error && <div style={{ color: "#C2321F", background: "rgba(194,50,31,0.08)", padding: "0.75rem 1rem", borderRadius: 6, fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/finance/journals" style={{ background: "rgba(20,26,58,0.08)", border: "none", color: "#141A3A", padding: "10px 24px", borderRadius: 8, textDecoration: "none", fontSize: "0.9rem" }}>Cancel</Link>
          <button onClick={() => save("draft")} disabled={saving} style={{ background: "rgba(20,26,58,0.11)", border: "1px solid rgba(20,26,58,0.21)", color: "#141A3A", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: "0.9rem" }}>Save as Draft</button>
          <button onClick={() => save("posted")} disabled={saving || !balanced} style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: (!balanced || saving) ? 0.6 : 1 }}>
            {saving ? "Posting…" : "Post Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
