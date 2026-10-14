"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Contact = { id: string; name: string; state: string | null };
type Account = { id: string; code: string; name: string; type: string };

export default function CreditNotePage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [bizState, setBizState] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [contactId, setContactId] = useState("");
  const [refInvoice, setRefInvoice] = useState("");
  const [reason, setReason] = useState("sales_return");
  const [narration, setNarration] = useState("");
  const [amount, setAmount] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [salesAccountId, setSalesAccountId] = useState("");
  const [debtorAccountId, setDebtorAccountId] = useState("");

  // Recent credit notes
  const [recent, setRecent] = useState<{ id: string; date: string; entry_no: string; narration: string; total_debit: number }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [bizRes, fyRes, contactsRes, accountsRes, recentRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("state").eq("id", saved).single(),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_contacts").select("id,name,state").eq("business_id", saved).eq("type", "customer").order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_journals").select("id,date,entry_no,narration,total_debit").eq("business_id", saved).eq("type", "credit_note").order("date", { ascending: false }).limit(8),
      ]);

      setBizState(bizRes.data?.state ?? "");
      setFyId(fyRes.data?.id ?? null);
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);
      setRecent(recentRes.data ?? []);

      const salesAcc = accs.find(a => a.name.toLowerCase().includes("sales") || a.name.toLowerCase().includes("revenue"));
      const debtorAcc = accs.find(a => a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"));
      if (salesAcc) setSalesAccountId(salesAcc.id);
      if (debtorAcc) setDebtorAccountId(debtorAcc.id);
    });
  }, []);

  const amt = parseFloat(amount) || 0;
  const gstRateN = parseFloat(gstRate) / 100;
  const contactState = contacts.find(c => c.id === contactId)?.state ?? "";
  const isInterState = contactState && bizState && contactState !== bizState;
  const gstAmt = amt * gstRateN;
  const cgst = isInterState ? 0 : gstAmt / 2;
  const sgst = isInterState ? 0 : gstAmt / 2;
  const igst = isInterState ? gstAmt : 0;
  const totalAmt = amt + gstAmt;

  async function handlePost() {
    if (!bizId || !amt || !salesAccountId || !debtorAccountId) { setError("Fill all required fields"); return; }
    setSaving(true); setError(""); setSuccess("");

    const contactName = contacts.find(c => c.id === contactId)?.name ?? "Customer";
    const cgstAcc = accounts.find(a => a.name.toLowerCase().includes("cgst") && a.name.toLowerCase().includes("output"));
    const sgstAcc = accounts.find(a => a.name.toLowerCase().includes("sgst") && a.name.toLowerCase().includes("output"));
    const igstAcc = accounts.find(a => a.name.toLowerCase().includes("igst") && a.name.toLowerCase().includes("output"));
    const intra = gstAmt > 0 && !isInterState, inter = gstAmt > 0 && isInterState;
    // Dr Sales (return), Dr Output GST (reversed) — Cr Debtors
    let entryNo = "";
    try {
      const r = await saveEntry({
        business_id: bizId!, date, type: "credit_note", source: "credit_note",
        narration: narration || `Credit Note to ${contactName} — ${reason.replace("_", " ")}`,
        reference_no: refInvoice || null, party_name: contactName, contact_id: contactId || null,
        lines: [
          { account_id: salesAccountId, dr: amt, cr: 0, narration: `Credit Note — ${reason.replace("_", " ")} to ${contactName}` },
          { account_id: cgstAcc?.id, account_name: cgstAcc ? null : "Output CGST", dr: intra ? cgst : 0, cr: 0, narration: "CGST reversed" },
          { account_id: sgstAcc?.id, account_name: sgstAcc ? null : "Output SGST", dr: intra ? sgst : 0, cr: 0, narration: "SGST reversed" },
          { account_id: igstAcc?.id, account_name: igstAcc ? null : "Output IGST", dr: inter ? igst : 0, cr: 0, narration: "IGST reversed" },
          { account_id: debtorAccountId, dr: 0, cr: totalAmt, narration: "AR reduced by credit note" },
        ],
      });
      entryNo = r.entry_no;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setSaving(false); return; }
    setSuccess(`Posted: ${entryNo} — ${cur()}${totalAmt.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}`);
    setAmount(""); setNarration(""); setRefInvoice(""); setContactId("");
    setSaving(false);

    const { data: rec } = await supabase.from("fw_fin_journals").select("id,date,entry_no,narration,total_debit").eq("business_id", bizId).eq("type", "credit_note").order("date", { ascending: false }).limit(8);
    setRecent(rec ?? []);
  }

  const inputStyle = { background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Credit Note</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Credit Note</h1>
          <p style={{ margin: "0 0 1.5rem", color: "rgba(20,26,58,0.65)", fontSize: "0.82rem" }}>Issue a credit note to a customer — reduces their outstanding (AR) balance</p>

          {error && <div style={{ background: "rgba(194,50,31,0.1)", border: "1px solid rgba(194,50,31,0.3)", color: "#C2321F", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", color: "#0B7A55", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div><label style={labelStyle}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Customer</label>
                <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Customer --</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
                  <option value="sales_return">Sales Return</option>
                  <option value="price_correction">Price Correction</option>
                  <option value="discount_post_sale">Post-Sale Discount</option>
                  <option value="damaged_goods">Damaged / Defective Goods</option>
                  <option value="short_supply">Short Supply</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label style={labelStyle}>Against Invoice No</label><input value={refInvoice} onChange={e => setRefInvoice(e.target.value)} placeholder="e.g. INV-0001" style={inputStyle} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Amount (₹) before GST</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right", fontSize: "1rem", fontWeight: 700 }} />
              </div>
              <div>
                <label style={labelStyle}>GST Rate</label>
                <select value={gstRate} onChange={e => setGstRate(e.target.value)} style={inputStyle}>
                  <option value="0">0% — Exempt / Nil rated</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                  <option value="28">28% GST</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>GST Type</label>
                <input value={isInterState ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"} readOnly style={{ ...inputStyle, color: "rgba(20,26,58,0.75)", background: "rgba(20,26,58,0.08)" }} />
              </div>
            </div>

            {/* Amount breakdown */}
            {amt > 0 && (
              <div style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.08)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>Base Amount</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(amt)}</span></div>
                {!isInterState && cgst > 0 && <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>CGST @ {parseFloat(gstRate) / 2}%</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(cgst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>SGST @ {parseFloat(gstRate) / 2}%</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(sgst)}</span></div>
                </>}
                {isInterState && igst > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>IGST @ {gstRate}%</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(igst)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, borderTop: "1px solid rgba(20,26,58,0.11)", paddingTop: 6, marginTop: 6, color: "#C2321F" }}>
                  <span>Total Credit Note Value</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(totalAmt)}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Sales return against INV-0001 — damaged goods" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <button onClick={handlePost} disabled={saving || !amt} style={{ background: "#C2321F", border: "none", color: "#F5F6FA", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: (!amt || saving) ? 0.5 : 1 }}>
              {saving ? "Posting…" : "Post Credit Note"}
            </button>
          </div>
        </div>

        {/* Recent */}
        <div>
          <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.60)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", marginTop: "3.8rem" }}>Recent Credit Notes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recent.map(r => (
              <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.08)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "rgba(194,50,31,0.6)" }}>{r.entry_no}</span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(20,26,58,0.55)" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <div style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.narration}</div>
                <div style={{ textAlign: "right", marginTop: "0.25rem", fontSize: "0.82rem", fontWeight: 700, color: "#C2321F" }}>{cur()}{fmt(r.total_debit)}</div>
              </div>
            ))}
            {recent.length === 0 && <div style={{ color: "rgba(20,26,58,0.35)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No credit notes yet</div>}
          </div>
          <Link href="/finance/debit-note" style={{ display: "block", marginTop: "1rem", background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.2)", color: "#0B7A55", padding: "8px 14px", borderRadius: 8, textDecoration: "none", fontSize: "0.8rem", textAlign: "center", fontWeight: 600 }}>
            → Debit Note (from vendor)
          </Link>
        </div>
      </div>
    </div>
  );
}
