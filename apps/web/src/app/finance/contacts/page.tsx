"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";
import BulkImport from "@/components/finance/BulkImport";

type Contact = {
  id: string; name: string; type: string; gstin: string | null; pan: string | null;
  email: string | null; phone: string | null; city: string | null; state: string | null;
  credit_days: number; opening_balance: number; opening_balance_type: string; is_active: boolean;
  msme_type?: "micro" | "small" | "medium" | null; udyam_no?: string | null; msme_written_terms?: boolean | null;
};
type Msme = { type: "" | "micro" | "small" | "medium"; udyam: string; written: boolean };
const noMsme: Msme = { type: "", udyam: "", written: false };

const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry","Other"];

const blank = (): Omit<Contact, "id" | "is_active"> => ({ name: "", type: "vendor", gstin: "", pan: "", email: "", phone: "", city: "", state: "Kerala", credit_days: 30, opening_balance: 0, opening_balance_type: "cr" });

export default function ContactsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "customer" | "vendor">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [msme, setMsme] = useState<Msme>(noMsme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_contacts").select("*").eq("business_id", saved).eq("is_active", true).order("name");
      setContacts(data ?? []);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!bizId || !form.name) { setError("Name is required"); return; }
    // Same name, GSTIN or phone as someone already saved? Ask first.
    const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);
    const twin = contacts.find(c => c.id !== editId && (
      norm(c.name) === norm(form.name) ||
      (!!form.gstin && norm(c.gstin) === norm(form.gstin)) ||
      (digits(form.phone).length === 10 && digits(c.phone) === digits(form.phone))));
    if (twin) {
      const why = norm(twin.name) === norm(form.name) ? "the same name" : form.gstin && norm(twin.gstin) === norm(form.gstin) ? "the same GSTIN" : "the same phone number";
      if (!window.confirm(`"${twin.name}" is already saved with ${why}${twin.gstin ? ` (GSTIN ${twin.gstin})` : ""}.\n\nPress OK only if this is a different ${form.type === "customer" ? "customer" : "party"}. Cancel to go back.`)) return;
    }
    setSaving(true); setError("");
    const payload = { ...form, business_id: bizId, is_active: true, gstin: form.gstin || null, pan: form.pan || null, email: form.email || null, phone: form.phone || null };
    let res;
    if (editId) {
      res = await supabase.from("fw_fin_contacts").update(payload).eq("id", editId).select("*").single();
    } else {
      res = await supabase.from("fw_fin_contacts").insert(payload).select("*").single();
    }
    if (res.error) { setError(res.error.message); setSaving(false); return; }
    // MSME details saved on their own, so contacts still save before the MSME columns exist
    if (form.type !== "customer" && (msme.type || msme.udyam || res.data?.msme_type)) {
      const m = await supabase.from("fw_fin_contacts").update({ msme_type: msme.type || null, udyam_no: msme.udyam.trim().toUpperCase() || null, msme_written_terms: msme.written }).eq("id", res.data.id).select("*").single();
      if (m.error) { setError(/msme|udyam|column/i.test(m.error.message) ? "Saved, but MSME details need a one-time setup: run 2026-11-04_msme.sql in Supabase." : m.error.message); setSaving(false); return; }
      res = m;
    }
    if (editId) setContacts(prev => prev.map(c => c.id === editId ? res.data : c));
    else setContacts(prev => [...prev, res.data]);
    setShowForm(false); setEditId(null); setForm(blank()); setMsme(noMsme);
    setSaving(false);
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, type: c.type, gstin: c.gstin ?? "", pan: c.pan ?? "", email: c.email ?? "", phone: c.phone ?? "", city: c.city ?? "", state: c.state ?? "Kerala", credit_days: c.credit_days, opening_balance: c.opening_balance, opening_balance_type: c.opening_balance_type });
    setMsme({ type: c.msme_type ?? "", udyam: c.udyam_no ?? "", written: !!c.msme_written_terms });
    setEditId(c.id); setShowForm(true);
  }

  const filtered = contacts.filter(c => {
    if (filter !== "all" && c.type !== filter && c.type !== "both") return false;
    if (search) return c.name.toLowerCase().includes(search.toLowerCase()) || (c.gstin ?? "").includes(search);
    return true;
  });

  const inp: React.CSSProperties = { background: "rgba(16,36,31,0.08)", border: "1px solid rgba(16,36,31,0.17)", color: "#10241F", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      {(() => {
        const cust = contacts.filter(x => x.type === "customer" || x.type === "both").length;
        const vend = contacts.filter(x => x.type === "vendor" || x.type === "both").length;
        const noGst = contacts.filter(x => !x.gstin).length;
        return (
          <PageHero eyebrow="Customers & vendors" title="Everyone you trade with"
            actions={<><HeroAction onClick={() => setImporting(true)}>↑ Import from Excel</HeroAction><HeroAction primary onClick={() => { setForm(blank()); setMsme(noMsme); setEditId(null); setShowForm(true); }}>+ New contact</HeroAction></>}
            tiles={[
              { label: "Contacts", value: loading ? "—" : contacts.length },
              { label: "Customers", value: loading ? "—" : cust },
              { label: "Vendors", value: loading ? "—" : vend, sub: vend ? undefined : "Import your supplier list", tone: vend ? "plain" : "warn" },
              { label: "Missing GSTIN", value: loading ? "—" : noGst, sub: noGst ? "Treated as B2C in GSTR-1" : "All have GSTIN", tone: noGst ? "warn" : "good" },
            ]} />
        );
      })()}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["all", "customer", "vendor"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${filter === f ? HT.green : HT.line}`, background: filter === f ? HT.green : HT.paper, color: filter === f ? "#FFFFFF" : HT.ink, fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>
              {f === "all" ? `All ${contacts.length}` : f === "customer" ? `Customers ${contacts.filter(x => x.type === "customer" || x.type === "both").length}` : `Vendors ${contacts.filter(x => x.type === "vendor" || x.type === "both").length}`}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or GSTIN…"
            style={{ width: 340, maxWidth: "100%", height: 42, borderRadius: 999, border: `1px solid ${HT.line}`, background: HT.paper, padding: "0 18px", fontFamily: SERIF, fontSize: 15, color: HT.ink, outline: "none" }} />
        </div>

        <div style={{ background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18, overflow: "hidden" }}>
          {loading ? <div style={{ padding: "3rem", textAlign: "center", color: HT.muted, fontStyle: "italic" }}>Loading…</div>
            : filtered.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontStyle: "italic" }}>{contacts.length ? "No contact matches" : "No contacts yet"}</div>
                {!contacts.length && <button onClick={() => setShowForm(true)} style={{ marginTop: 14, height: 44, padding: "0 22px", borderRadius: 999, border: "none", background: HT.green, color: "#FFFFFF", fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>+ Add your first contact</button>}
              </div>
            ) : filtered.map((ct, i) => {
              const ledgerLike = /\b(advance|control|suspense|account|a\/c|deposit|payable|receivable)\b/i.test(ct.name);
              const initials = ct.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
              const tag = ct.type === "customer" ? { t: "Customer", bg: "#E3F6EE", c: "#0B7A55" } : ct.type === "vendor" ? { t: "Vendor", bg: "#EFE6D3", c: "#9A6B22" } : { t: "Both", bg: "#EEE9F8", c: "#5B4BC4" };
              return (
                <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderTop: i ? `1px solid ${HT.line}` : undefined }}>
                  <span style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 999, background: HT.green, color: HT.gold, display: "grid", placeItems: "center", fontSize: 15 }}>{initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 17 }}>{ct.name}</span>
                      <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: tag.bg, color: tag.c }}>{tag.t}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: HT.muted, marginTop: 2 }}>
                      GSTIN {ct.gstin ?? "—"} · {ct.city ? `${ct.city}, ${ct.state}` : "City —"} · {ct.phone ? <a href={`https://wa.me/${ct.phone.replace(/\D/g, "").length === 10 ? "91" : ""}${ct.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#0B7A55" }}>{ct.phone}</a> : "Phone —"} · {ct.credit_days} days credit · Opening {ct.opening_balance > 0 ? `${cur()}${ct.opening_balance.toLocaleString(activeMoney().locale)} ${ct.opening_balance_type.toUpperCase()}` : "—"}
                    </div>
                    {ledgerLike && <div style={{ fontSize: 13, fontStyle: "italic", color: HT.goldInk, marginTop: 2 }}>Looks like a ledger account, not a {ct.type === "vendor" ? "vendor" : "customer"}</div>}
                  </div>
                  <button onClick={() => startEdit(ct)} style={{ height: 38, padding: "0 18px", borderRadius: 999, border: `1px solid ${HT.gold}`, background: "transparent", color: HT.goldInk, fontFamily: SERIF, fontSize: 14.5, cursor: "pointer" }}>Edit</button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(16,36,31,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "2rem" }}>
          <div style={{ background: "#FFFDF8", border: "1px solid rgba(18,53,45,0.3)", borderRadius: 14, padding: "1.75rem", width: 540, maxWidth: "95vw" }}>
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
              {form.type !== "customer" && <>
                <div>
                  <label style={lbl}>MSME (Udyam)</label>
                  <select value={msme.type} onChange={e => setMsme(m => ({ ...m, type: e.target.value as Msme["type"] }))} style={inp}>
                    <option value="">Not MSME / not known</option><option value="micro">Micro</option><option value="small">Small</option><option value="medium">Medium</option>
                  </select>
                </div>
                {msme.type && <div>
                  <label style={lbl}>Udyam number</label>
                  <input value={msme.udyam} onChange={e => setMsme(m => ({ ...m, udyam: e.target.value.toUpperCase() }))} placeholder="UDYAM-KL-00-0000000" maxLength={19} style={inp} />
                </div>}
                {(msme.type === "micro" || msme.type === "small") && <label style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.8rem", color: "rgba(16,36,31,0.75)", lineHeight: 1.5 }}>
                  <input type="checkbox" checked={msme.written} onChange={e => setMsme(m => ({ ...m, written: e.target.checked }))} style={{ marginTop: 3 }} />
                  Credit period agreed in writing (then the credit days below apply, up to 45). Otherwise pay within 15 days — section 43B(h).
                </label>}
              </>}
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
                <label style={lbl}>Opening Balance (₹)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" value={form.opening_balance} onChange={e => set("opening_balance", parseFloat(e.target.value) || 0)} style={{ ...inp, flex: 1 }} />
                  <select value={form.opening_balance_type} onChange={e => set("opening_balance_type", e.target.value)} style={{ ...inp, width: 60 }}>
                    <option value="dr">Dr</option>
                    <option value="cr">Cr</option>
                  </select>
                </div>
              </div>
            </div>

            {error && <div style={{ color: "#B4321F", fontSize: "0.82rem", marginTop: "1rem" }}>{error}</div>}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button onClick={() => { setShowForm(false); setEditId(null); setError(""); }} style={{ background: "rgba(16,36,31,0.08)", border: "none", color: "#10241F", padding: "8px 18px", borderRadius: 7, cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ background: "#12352D", border: "none", color: "#F4EFE4", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editId ? "Update" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
      {importing && bizId && <BulkImport kind="customers" bizId={bizId} onClose={() => setImporting(false)} onDone={() => setReloadKey(k => k + 1)} />}
    </div>
  );
}
