"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Contact = {
  id: string; name: string; type: string; gstin: string | null; pan: string | null;
  email: string | null; phone: string | null; city: string | null; state: string | null;
  credit_days: number; opening_balance: number; opening_balance_type: string; is_active: boolean;
};

const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry","Other"];

const blank = (): Omit<Contact, "id" | "is_active"> => ({ name: "", type: "vendor", gstin: "", pan: "", email: "", phone: "", city: "", state: "Kerala", credit_days: 30, opening_balance: 0, opening_balance_type: "cr" });

export default function ContactsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "customer" | "vendor">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_$user.id`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_contacts").select("*").eq("business_id", saved).eq("is_active", true).order("name");
      setContacts(data ?? []);
      setLoading(false);
    });
  }, []);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!bizId || !form.name) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const payload = { ...form, business_id: bizId, is_active: true, gstin: form.gstin || null, pan: form.pan || null, email: form.email || null, phone: form.phone || null };
    let res;
    if (editId) {
      res = await supabase.from("fw_fin_contacts").update(payload).eq("id", editId).select("*").single();
    } else {
      res = await supabase.from("fw_fin_contacts").insert(payload).select("*").single();
    }
    if (res.error) { setError(res.error.message); setSaving(false); return; }
    if (editId) setContacts(prev => prev.map(c => c.id === editId ? res.data : c));
    else setContacts(prev => [...prev, res.data]);
    setShowForm(false); setEditId(null); setForm(blank());
    setSaving(false);
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, type: c.type, gstin: c.gstin ?? "", pan: c.pan ?? "", email: c.email ?? "", phone: c.phone ?? "", city: c.city ?? "", state: c.state ?? "Kerala", credit_days: c.credit_days, opening_balance: c.opening_balance, opening_balance_type: c.opening_balance_type });
    setEditId(c.id); setShowForm(true);
  }

  const filtered = contacts.filter(c => {
    if (filter !== "all" && c.type !== filter && c.type !== "both") return false;
    if (search) return c.name.toLowerCase().includes(search.toLowerCase()) || (c.gstin ?? "").includes(search);
    return true;
  });

  const inp: React.CSSProperties = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>â€º</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Contacts</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setForm(blank()); setEditId(null); setShowForm(true); }} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
          + New Contact
        </button>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
          {(["all", "customer", "vendor"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter === f ? "rgba(201,168,76,0.35)" : "rgba(237,232,220,0.1)"}`,
              color: filter === f ? "#C9A84C" : "rgba(237,232,220,0.5)",
              padding: "5px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem", textTransform: "capitalize",
            }}>{f === "all" ? `All (${contacts.length})` : f === "customer" ? `Customers (${contacts.filter(c => c.type === "customer" || c.type === "both").length})` : `Vendors (${contacts.filter(c => c.type === "vendor" || c.type === "both").length})`}</button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or GSTINâ€¦"
            style={{ marginLeft: "auto", ...inp, width: 220 }} />
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)" }}>Loadingâ€¦</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>ðŸ‘¥</div>
              <div style={{ color: "rgba(237,232,220,0.4)", marginBottom: "1rem" }}>No contacts yet.</div>
              <button onClick={() => setShowForm(true)} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>+ Add First Contact</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Name", "Type", "GSTIN", "City", "Phone", "Credit Days", "Opening Balance", ""].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderTop: "1px solid rgba(237,232,220,0.05)" }}>
                    <td style={{ padding: "0.7rem 1rem", fontWeight: 600, fontSize: "0.88rem" }}>{c.name}</td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span style={{
                        fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                        background: c.type === "customer" ? "rgba(74,222,128,0.1)" : c.type === "vendor" ? "rgba(96,165,250,0.1)" : "rgba(167,139,250,0.1)",
                        color: c.type === "customer" ? "#4ade80" : c.type === "vendor" ? "#60a5fa" : "#a78bfa",
                      }}>
                        {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", fontFamily: "monospace", color: "rgba(237,232,220,0.5)" }}>{c.gstin ?? "â€”"}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", color: "rgba(237,232,220,0.6)" }}>{c.city ? `${c.city}, ${c.state}` : "â€”"}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", color: "rgba(237,232,220,0.6)" }}>{c.phone ?? "â€”"}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem" }}>{c.credit_days} days</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>
                      {c.opening_balance > 0 ? `â‚¹${c.opening_balance.toLocaleString("en-IN")} ${c.opening_balance_type.toUpperCase()}` : "â€”"}
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <button onClick={() => startEdit(c)} style={{ background: "none", border: "none", color: "#C9A84C", cursor: "pointer", fontSize: "0.78rem" }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "2rem" }}>
          <div style={{ background: "#0d1526", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14, padding: "1.75rem", width: 540, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 1.5rem", fontSize: "1rem", fontWeight: 700 }}>{editId ? "Edit Contact" : "New Contact"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Business / Person name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.type} onChange={e => set("type", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor / Supplier</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label style={lbl}>GSTIN</label>
                <input value={form.gstin ?? ""} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} style={inp} />
              </div>
              <div>
                <label style={lbl}>PAN</label>
                <input value={form.pan ?? ""} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} style={inp} />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input value={form.email ?? ""} onChange={e => set("email", e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>City</label>
                <input value={form.city ?? ""} onChange={e => set("city", e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>State</label>
                <select value={form.state ?? "Kerala"} onChange={e => set("state", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Credit Days</label>
                <input type="number" value={form.credit_days} onChange={e => set("credit_days", parseInt(e.target.value) || 0)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Opening Balance (â‚¹)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" value={form.opening_balance} onChange={e => set("opening_balance", parseFloat(e.target.value) || 0)} style={{ ...inp, flex: 1 }} />
                  <select value={form.opening_balance_type} onChange={e => set("opening_balance_type", e.target.value)} style={{ ...inp, width: 60 }}>
                    <option value="dr">Dr</option>
                    <option value="cr">Cr</option>
                  </select>
                </div>
              </div>
            </div>

            {error && <div style={{ color: "#f87171", fontSize: "0.82rem", marginTop: "1rem" }}>{error}</div>}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button onClick={() => { setShowForm(false); setEditId(null); setError(""); }} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "8px 18px", borderRadius: 7, cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Savingâ€¦" : editId ? "Update" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

