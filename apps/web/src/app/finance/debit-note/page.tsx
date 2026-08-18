"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Contact = { id: string; name: string; state: string | null };
type Account = { id: string; code: string; name: string; type: string };

export default function DebitNotePage() {
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
  const [refBill, setRefBill] = useState("");
  const [reason, setReason] = useState("purchase_return");
  const [narration, setNarration] = useState("");
  const [amount, setAmount] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [purchaseAccountId, setPurchaseAccountId] = useState("");
  const [creditorAccountId, setCreditorAccountId] = useState("");

  const [recent, setRecent] = useState<{ id: string; date: string; entry_no: string; narration: string; total_credit: number }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_$user.id`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [bizRes, fyRes, contactsRes, accountsRes, recentRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("state").eq("id", saved).single(),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_contacts").select("id,name,state").eq("business_id", saved).neq("type", "customer").order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_journals").select("id,date,entry_no,narration,total_credit").eq("business_id", saved).eq("type", "debit_note").order("date", { ascending: false }).limit(8),
      ]);

      setBizState(bizRes.data?.state ?? "");
      setFyId(fyRes.data?.id ?? null);
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);
      setRecent(recentRes.data ?? []);

      const purchaseAcc = accs.find(a => a.name.toLowerCase().includes("purchase") || a.name.toLowerCase().includes("goods"));
      const creditorAcc = accs.find(a => a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"));
      if (purchaseAcc) setPurchaseAccountId(purchaseAcc.id);
      if (creditorAcc) setCreditorAccountId(creditorAcc.id);
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
    if (!bizId || !fyId || !amt || !purchaseAccountId || !creditorAccountId) { setError("Fill all required fields"); return; }
    setSaving(true); setError(""); setSuccess("");

    const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact" }).eq("business_id", bizId).eq("type", "debit_note");
    const entryNo = `DN-${String((count ?? 0) + 1).padStart(4, "0")}`;
    const contactName = contacts.find(c => c.id === contactId)?.name ?? "Vendor";

    const lines: { account_id: string; dr_amount: number; cr_amount: number; narration: string }[] = [
      { account_id: creditorAccountId, dr_amount: totalAmt, cr_amount: 0, narration: `AP reduced â€” DN ${entryNo} to ${contactName}` },
    ];

    // ITC reversal (debit note reduces ITC)
    const cgstAcc = accounts.find(a => a.name.toLowerCase().includes("cgst") && a.name.toLowerCase().includes("input"));
    const sgstAcc = accounts.find(a => a.name.toLowerCase().includes("sgst") && a.name.toLowerCase().includes("input"));
    const igstAcc = accounts.find(a => a.name.toLowerCase().includes("igst") && a.name.toLowerCase().includes("input"));

    if (gstAmt > 0) {
      if (!isInterState && cgstAcc && sgstAcc) {
        lines.push({ account_id: cgstAcc.id, dr_amount: 0, cr_amount: cgst, narration: "CGST ITC reversed" });
        lines.push({ account_id: sgstAcc.id, dr_amount: 0, cr_amount: sgst, narration: "SGST ITC reversed" });
      } else if (isInterState && igstAcc) {
        lines.push({ account_id: igstAcc.id, dr_amount: 0, cr_amount: igst, narration: "IGST ITC reversed" });
      }
    }

    lines.push({ account_id: purchaseAccountId, dr_amount: 0, cr_amount: amt, narration: `Purchase return â€” ${reason.replace("_", " ")}` });

    const totalDr = lines.reduce((s, l) => s + l.dr_amount, 0);
    const totalCr = lines.reduce((s, l) => s + l.cr_amount, 0);

    const { data: journal, error: jErr } = await supabase.from("fw_fin_journals").insert({
      business_id: bizId, fy_id: fyId, date, entry_no: entryNo, type: "debit_note",
      narration: narration || `Debit Note to ${contactName} â€” ${reason.replace("_", " ")}`,
      reference_no: refBill || null, contact_id: contactId || null,
      total_debit: totalDr, total_credit: totalCr, status: "posted", ai_generated: false,
    }).select("id").single();

    if (jErr || !journal) { setError(jErr?.message ?? "Failed"); setSaving(false); return; }
    await supabase.from("fw_fin_journal_lines").insert(lines.map(l => ({ ...l, journal_id: journal.id })));

    setSuccess(`Posted: ${entryNo} â€” â‚¹${totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
    setAmount(""); setNarration(""); setRefBill(""); setContactId("");
    setSaving(false);

    const { data: rec } = await supabase.from("fw_fin_journals").select("id,date,entry_no,narration,total_credit").eq("business_id", bizId).eq("type", "debit_note").order("date", { ascending: false }).limit(8);
    setRecent(rec ?? []);
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>â€º</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Debit Note</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Debit Note</h1>
          <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Issue a debit note to a vendor â€” reduces your outstanding payable (AP) balance and reverses ITC</p>

          {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>âœ“ {success}</div>}

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div><label style={labelStyle}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Vendor</label>
                <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Vendor --</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
                  <option value="purchase_return">Purchase Return</option>
                  <option value="price_correction">Price Correction</option>
                  <option value="short_supply">Short Supply</option>
                  <option value="damaged_goods">Damaged / Defective Goods</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label style={labelStyle}>Against Bill No</label><input value={refBill} onChange={e => setRefBill(e.target.value)} placeholder="e.g. BILL-0001" style={inputStyle} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Amount (â‚¹) before GST</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right", fontSize: "1rem", fontWeight: 700 }} />
              </div>
              <div>
                <label style={labelStyle}>GST Rate</label>
                <select value={gstRate} onChange={e => setGstRate(e.target.value)} style={inputStyle}>
                  <option value="0">0% â€” Exempt / Nil rated</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                  <option value="28">28% GST</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>GST Type</label>
                <input value={isInterState ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"} readOnly style={{ ...inputStyle, color: "rgba(237,232,220,0.5)", background: "rgba(237,232,220,0.02)" }} />
              </div>
            </div>

            {amt > 0 && (
              <div style={{ background: "rgba(237,232,220,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>Base Amount</span><span>â‚¹{fmt(amt)}</span></div>
                {!isInterState && cgst > 0 && <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>CGST @ {parseFloat(gstRate) / 2}%</span><span>â‚¹{fmt(cgst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>SGST @ {parseFloat(gstRate) / 2}%</span><span>â‚¹{fmt(sgst)}</span></div>
                </>}
                {isInterState && igst > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>IGST @ {gstRate}%</span><span>â‚¹{fmt(igst)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, borderTop: "1px solid rgba(237,232,220,0.08)", paddingTop: 6, marginTop: 6, color: "#4ade80" }}>
                  <span>Total Debit Note Value</span><span>â‚¹{fmt(totalAmt)}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Purchase return to vendor against BILL-0001 â€” damaged goods" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <button onClick={handlePost} disabled={saving || !amt} style={{ background: "#4ade80", border: "none", color: "#070C1A", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: (!amt || saving) ? 0.5 : 1 }}>
              {saving ? "Postingâ€¦" : "Post Debit Note"}
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", marginTop: "3.8rem" }}>Recent Debit Notes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recent.map(r => (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "rgba(74,222,128,0.6)" }}>{r.entry_no}</span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.3)" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <div style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.narration}</div>
                <div style={{ textAlign: "right", marginTop: "0.25rem", fontSize: "0.82rem", fontWeight: 700, color: "#4ade80" }}>â‚¹{fmt(r.total_credit)}</div>
              </div>
            ))}
            {recent.length === 0 && <div style={{ color: "rgba(237,232,220,0.25)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No debit notes yet</div>}
          </div>
          <Link href="/finance/credit-note" style={{ display: "block", marginTop: "1rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", padding: "8px 14px", borderRadius: 8, textDecoration: "none", fontSize: "0.8rem", textAlign: "center", fontWeight: 600 }}>
            â†’ Credit Note (to customer)
          </Link>
        </div>
      </div>
    </div>
  );
}

