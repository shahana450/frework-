"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Link from "next/link";

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const BIZ_TYPES = [
  { value: "proprietorship", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership Firm" },
  { value: "llp", label: "LLP" },
  { value: "pvt_ltd", label: "Private Limited" },
  { value: "public_ltd", label: "Public Limited" },
  { value: "huf", label: "HUF" },
  { value: "trust", label: "Trust / NGO" },
];

const GST_TYPES = [
  { value: "regular", label: "Regular (Standard GST)" },
  { value: "composition", label: "Composition Scheme" },
  { value: "unregistered", label: "Unregistered" },
];

const COA_PRESETS = [
  { value: "services", label: "Services / Consulting", desc: "Software, CA, freelancers, agencies" },
  { value: "trading", label: "Trading / Retail", desc: "Buy and sell goods, shops, distributors" },
  { value: "manufacturing", label: "Manufacturing", desc: "Production, factories, MSME" },
  { value: "restaurant", label: "Restaurant / Food", desc: "Hotels, restaurants, food delivery" },
];

type Step = 1 | 2 | 3 | 4;

export default function BusinessSetup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", legal_name: "", business_type: "proprietorship",
    gstin: "", pan: "", tan: "",
    address: "", city: "", state: "Kerala", pincode: "",
    email: "", phone: "",
    gst_registration_type: "regular",
    coa_preset: "services",
    fy_start: "2024-04-01",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      setForm(f => ({ ...f, email: user.email ?? "" }));
    });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      const { data: biz, error: bizErr } = await supabase
        .from("fw_fin_businesses")
        .insert({
          owner_id: userId,
          name: form.name,
          legal_name: form.legal_name || form.name,
          business_type: form.business_type,
          gstin: form.gstin || null,
          pan: form.pan || null,
          tan: form.tan || null,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          email: form.email,
          phone: form.phone,
          gst_registration_type: form.gst_registration_type,
          currency: "INR",
          fiscal_year_start: "04-01",
          is_active: true,
        })
        .select("id")
        .single();

      if (bizErr) throw new Error(bizErr.message);

      // Create current financial year
      const fyStart = new Date(form.fy_start);
      const fyEnd = new Date(fyStart);
      fyEnd.setFullYear(fyEnd.getFullYear() + 1);
      fyEnd.setDate(fyEnd.getDate() - 1);
      const fyLabel = `${fyStart.getFullYear()}-${String(fyStart.getFullYear() + 1).slice(2)}`;

      await supabase.from("fw_fin_financial_years").insert({
        business_id: biz.id,
        label: fyLabel,
        start_date: form.fy_start,
        end_date: fyEnd.toISOString().split("T")[0],
        is_current: true,
        is_locked: false,
      });

      // Seed Chart of Accounts
      await seedCoA(biz.id, form.coa_preset);

      // Save active business to localStorage
      if (userId) localStorage.setItem(`fw_fin_biz_${userId}`, biz.id);

      router.push("/finance");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation")) {
        setError("__SCHEMA_MISSING__");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function seedCoA(bizId: string, preset: string) {
    const baseAccounts = [
      // Assets
      { code: "1000", name: "Assets", type: "asset", sub_type: null, is_group: true, is_system: true, sort_order: 1 },
      { code: "1100", name: "Current Assets", type: "asset", sub_type: "current_asset", is_group: true, is_system: true, sort_order: 2 },
      { code: "1101", name: "Cash in Hand", type: "asset", sub_type: "current_asset", is_system: true, sort_order: 3 },
      { code: "1102", name: "Bank Accounts", type: "asset", sub_type: "current_asset", is_system: true, sort_order: 4 },
      { code: "1103", name: "Accounts Receivable (Debtors)", type: "asset", sub_type: "current_asset", is_system: true, sort_order: 5 },
      { code: "1104", name: "GST Input Tax Credit", type: "asset", sub_type: "current_asset", is_system: true, sort_order: 6 },
      { code: "1105", name: "Advance to Suppliers", type: "asset", sub_type: "current_asset", sort_order: 7 },
      { code: "1106", name: "TDS Receivable", type: "asset", sub_type: "current_asset", sort_order: 8 },
      { code: "1200", name: "Fixed Assets", type: "asset", sub_type: "fixed_asset", is_group: true, is_system: true, sort_order: 10 },
      { code: "1201", name: "Furniture & Fixtures", type: "asset", sub_type: "fixed_asset", sort_order: 11 },
      { code: "1202", name: "Computer & Equipment", type: "asset", sub_type: "fixed_asset", sort_order: 12 },
      { code: "1203", name: "Office Equipment", type: "asset", sub_type: "fixed_asset", sort_order: 13 },
      { code: "1204", name: "Vehicle", type: "asset", sub_type: "fixed_asset", sort_order: 14 },
      // Liabilities
      { code: "2000", name: "Liabilities", type: "liability", sub_type: null, is_group: true, is_system: true, sort_order: 20 },
      { code: "2100", name: "Current Liabilities", type: "liability", sub_type: "current_liability", is_group: true, is_system: true, sort_order: 21 },
      { code: "2101", name: "Accounts Payable (Creditors)", type: "liability", sub_type: "current_liability", is_system: true, sort_order: 22 },
      { code: "2102", name: "GST Payable - CGST", type: "liability", sub_type: "current_liability", is_system: true, sort_order: 23 },
      { code: "2103", name: "GST Payable - SGST", type: "liability", sub_type: "current_liability", is_system: true, sort_order: 24 },
      { code: "2104", name: "GST Payable - IGST", type: "liability", sub_type: "current_liability", is_system: true, sort_order: 25 },
      { code: "2105", name: "TDS Payable", type: "liability", sub_type: "current_liability", sort_order: 26 },
      { code: "2106", name: "Salary Payable", type: "liability", sub_type: "current_liability", sort_order: 27 },
      { code: "2107", name: "Advance from Customers", type: "liability", sub_type: "current_liability", sort_order: 28 },
      // Equity / Capital
      { code: "3000", name: "Capital & Equity", type: "equity", sub_type: "capital", is_group: true, is_system: true, sort_order: 30 },
      { code: "3001", name: "Owner Capital", type: "equity", sub_type: "capital", is_system: true, sort_order: 31 },
      { code: "3002", name: "Retained Earnings", type: "equity", sub_type: "capital", is_system: true, sort_order: 32 },
      // Income
      { code: "4000", name: "Income", type: "income", sub_type: null, is_group: true, is_system: true, sort_order: 40 },
      { code: "4001", name: "Sales / Revenue", type: "income", sub_type: "revenue", is_system: true, sort_order: 41 },
      { code: "4002", name: "Other Income", type: "income", sub_type: "indirect_income", sort_order: 42 },
      { code: "4003", name: "Interest Received", type: "income", sub_type: "indirect_income", sort_order: 43 },
      // Expenses
      { code: "5000", name: "Expenses", type: "expense", sub_type: null, is_group: true, is_system: true, sort_order: 50 },
      { code: "5001", name: "Direct Expenses", type: "expense", sub_type: "direct_expense", is_group: true, sort_order: 51 },
      { code: "5100", name: "Indirect Expenses", type: "expense", sub_type: "indirect_expense", is_group: true, sort_order: 60 },
      { code: "5101", name: "Salary & Wages", type: "expense", sub_type: "indirect_expense", sort_order: 61 },
      { code: "5102", name: "Rent", type: "expense", sub_type: "indirect_expense", sort_order: 62 },
      { code: "5103", name: "Electricity & Utilities", type: "expense", sub_type: "indirect_expense", sort_order: 63 },
      { code: "5104", name: "Internet & Telephone", type: "expense", sub_type: "indirect_expense", sort_order: 64 },
      { code: "5105", name: "Bank Charges", type: "expense", sub_type: "indirect_expense", sort_order: 65 },
      { code: "5106", name: "Professional Fees", type: "expense", sub_type: "indirect_expense", sort_order: 66 },
      { code: "5107", name: "Office Supplies", type: "expense", sub_type: "indirect_expense", sort_order: 67 },
      { code: "5108", name: "Travel & Conveyance", type: "expense", sub_type: "indirect_expense", sort_order: 68 },
      { code: "5109", name: "Advertising & Marketing", type: "expense", sub_type: "indirect_expense", sort_order: 69 },
      { code: "5110", name: "Depreciation", type: "expense", sub_type: "indirect_expense", sort_order: 70 },
      { code: "5111", name: "Miscellaneous Expense", type: "expense", sub_type: "indirect_expense", sort_order: 71 },
    ];

    const presetExtras: Record<string, { code: string; name: string; type: string; sub_type: string; sort_order: number }[]> = {
      trading: [
        { code: "4004", name: "Sales Returns", type: "income", sub_type: "revenue", sort_order: 43 },
        { code: "5002", name: "Cost of Goods Sold", type: "expense", sub_type: "direct_expense", sort_order: 52 },
        { code: "5003", name: "Purchase of Stock", type: "expense", sub_type: "direct_expense", sort_order: 53 },
        { code: "5004", name: "Purchase Returns", type: "expense", sub_type: "direct_expense", sort_order: 54 },
        { code: "1107", name: "Stock in Hand", type: "asset", sub_type: "current_asset", sort_order: 9 },
      ],
      manufacturing: [
        { code: "5002", name: "Raw Materials Consumed", type: "expense", sub_type: "direct_expense", sort_order: 52 },
        { code: "5003", name: "Direct Labour", type: "expense", sub_type: "direct_expense", sort_order: 53 },
        { code: "5004", name: "Factory Overhead", type: "expense", sub_type: "direct_expense", sort_order: 54 },
        { code: "1107", name: "Raw Material Stock", type: "asset", sub_type: "current_asset", sort_order: 9 },
        { code: "1108", name: "WIP Stock", type: "asset", sub_type: "current_asset", sort_order: 9 },
        { code: "1109", name: "Finished Goods Stock", type: "asset", sub_type: "current_asset", sort_order: 9 },
      ],
      restaurant: [
        { code: "5002", name: "Food & Beverage Cost", type: "expense", sub_type: "direct_expense", sort_order: 52 },
        { code: "5003", name: "Kitchen Supplies", type: "expense", sub_type: "direct_expense", sort_order: 53 },
        { code: "4004", name: "Catering Income", type: "income", sub_type: "revenue", sort_order: 43 },
      ],
      services: [
        { code: "5002", name: "Sub-contractor Cost", type: "expense", sub_type: "direct_expense", sort_order: 52 },
        { code: "4004", name: "Consultancy Fees", type: "income", sub_type: "revenue", sort_order: 43 },
      ],
    };

    const allAccounts = [...baseAccounts, ...(presetExtras[preset] ?? [])];
    await supabase.from("fw_fin_chart_of_accounts").insert(
      allAccounts.map(a => ({ ...a, business_id: bizId }))
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.15)",
    color: "#EDE8DC", padding: "10px 14px", borderRadius: 8, fontSize: "0.9rem",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.5)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" };
  const fieldStyle: React.CSSProperties = { marginBottom: "1.25rem" };

  const steps: { num: Step; label: string }[] = [
    { num: 1, label: "Business Info" }, { num: 2, label: "Tax & GST" },
    { num: 3, label: "Accounts Setup" }, { num: 4, label: "Review" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 900, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <span>🛩️</span> FrePilot
        </Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Set Up Your Business</span>
      </nav>

      <div style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.4)", letterSpacing: "0.05em" }}>You Build, We Pilot — let's get your books ready</div>
        </div>
        {/* Step indicator */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2.5rem" }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: step >= s.num ? "#C9A84C" : "rgba(237,232,220,0.1)",
                color: step >= s.num ? "#070C1A" : "rgba(237,232,220,0.4)",
                fontSize: "0.75rem", fontWeight: 800, flexShrink: 0,
              }}>{s.num}</div>
              <div style={{ fontSize: "0.72rem", color: step >= s.num ? "#C9A84C" : "rgba(237,232,220,0.4)", whiteSpace: "nowrap" }}>{s.label}</div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: step > s.num ? "#C9A84C" : "rgba(237,232,220,0.1)" }} />}
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 16, padding: "2rem" }}>
          {step === 1 && (
            <>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>Business Information</h2>
              <div style={fieldStyle}>
                <label style={labelStyle}>Business / Trade Name *</label>
                <input style={inputStyle} placeholder="e.g. Acme Traders" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Legal Name (if different)</label>
                <input style={inputStyle} placeholder="Full registered name" value={form.legal_name} onChange={e => set("legal_name", e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Business Type</label>
                <select style={inputStyle} value={form.business_type} onChange={e => set("business_type", e.target.value)}>
                  {BIZ_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" placeholder="+91" value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} placeholder="Door No, Street" value={form.address} onChange={e => set("address", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={form.city} onChange={e => set("city", e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>State</label>
                  <select style={inputStyle} value={form.state} onChange={e => set("state", e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>PIN Code</label>
                  <input style={inputStyle} maxLength={6} value={form.pincode} onChange={e => set("pincode", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>Tax & GST Information</h2>
              <div style={fieldStyle}>
                <label style={labelStyle}>GST Registration Type</label>
                {GST_TYPES.map(g => (
                  <label key={g.value} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", marginBottom: "0.5rem", background: form.gst_registration_type === g.value ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${form.gst_registration_type === g.value ? "rgba(201,168,76,0.3)" : "rgba(237,232,220,0.08)"}`, borderRadius: 8, cursor: "pointer" }}>
                    <input type="radio" name="gst_type" value={g.value} checked={form.gst_registration_type === g.value} onChange={e => set("gst_registration_type", e.target.value)} style={{ accentColor: "#C9A84C" }} />
                    <span style={{ fontSize: "0.88rem" }}>{g.label}</span>
                  </label>
                ))}
              </div>
              {form.gst_registration_type !== "unregistered" && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>GSTIN</label>
                  <input style={inputStyle} placeholder="22AAAAA0000A1Z5" maxLength={15} value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>PAN</label>
                  <input style={inputStyle} placeholder="AAAAA0000A" maxLength={10} value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>TAN (if TDS deductor)</label>
                  <input style={inputStyle} placeholder="ABCD12345E" maxLength={10} value={form.tan} onChange={e => set("tan", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Current Financial Year</label>
                <select style={inputStyle} value={form.fy_start} onChange={e => set("fy_start", e.target.value)}>
                  <option value="2023-04-01">FY 2023-24 (Apr 2023 – Mar 2024)</option>
                  <option value="2024-04-01">FY 2024-25 (Apr 2024 – Mar 2025)</option>
                  <option value="2025-04-01">FY 2025-26 (Apr 2025 – Mar 2026)</option>
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem", fontWeight: 700 }}>Chart of Accounts</h2>
              <p style={{ color: "rgba(237,232,220,0.5)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>We'll pre-fill accounts for your industry. You can add more later.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {COA_PRESETS.map(p => (
                  <label key={p.value} style={{
                    padding: "1rem", background: form.coa_preset === p.value ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${form.coa_preset === p.value ? "rgba(201,168,76,0.35)" : "rgba(237,232,220,0.08)"}`,
                    borderRadius: 10, cursor: "pointer",
                  }}>
                    <input type="radio" name="coa_preset" value={p.value} checked={form.coa_preset === p.value} onChange={e => set("coa_preset", e.target.value)} style={{ display: "none" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: form.coa_preset === p.value ? "#C9A84C" : "#EDE8DC", marginBottom: "0.3rem" }}>{p.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)" }}>{p.desc}</div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: "1.5rem", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#C9A84C", fontWeight: 600, marginBottom: "0.3rem" }}>What's included</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.5)", lineHeight: 1.6 }}>
                  Assets (Cash, Bank, Debtors, GST ITC) · Liabilities (Creditors, GST Payable, TDS) · Capital · Income & Expenses with Indian accounting structure
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>Review & Create</h2>
              {[
                { label: "Business Name", value: form.name || "—" },
                { label: "Business Type", value: BIZ_TYPES.find(b => b.value === form.business_type)?.label ?? "—" },
                { label: "Location", value: [form.city, form.state].filter(Boolean).join(", ") || "—" },
                { label: "GST Type", value: GST_TYPES.find(g => g.value === form.gst_registration_type)?.label ?? "—" },
                { label: "GSTIN", value: form.gstin || "Not provided" },
                { label: "PAN", value: form.pan || "Not provided" },
                { label: "Financial Year", value: form.fy_start.startsWith("2024") ? "FY 2024-25" : form.fy_start.startsWith("2025") ? "FY 2025-26" : "FY 2023-24" },
                { label: "Accounts Preset", value: COA_PRESETS.find(c => c.value === form.coa_preset)?.label ?? "—" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid rgba(237,232,220,0.06)" }}>
                  <span style={{ fontSize: "0.82rem", color: "rgba(237,232,220,0.5)" }}>{row.label}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              {error === "__SCHEMA_MISSING__" && (
                <div style={{ marginTop: "1rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ fontWeight: 700, color: "#f87171", marginBottom: "0.5rem" }}>⚠️ Database tables not set up yet</div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.6)", lineHeight: 1.6, marginBottom: "0.85rem" }}>
                    The FreWork Finance tables don&apos;t exist in your Supabase project yet. You need to run the schema SQL once in your Supabase dashboard.
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.5)", marginBottom: "0.5rem", fontWeight: 600 }}>Steps:</div>
                  <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.55)", lineHeight: 2 }}>
                    <li>Open <strong style={{ color: "#C9A84C" }}>supabase.com</strong> → your project → <strong style={{ color: "#C9A84C" }}>SQL Editor</strong></li>
                    <li>Click <strong style={{ color: "#C9A84C" }}>New Query</strong></li>
                    <li>Download the schema SQL and paste it in:</li>
                  </ol>
                  <a href="/api/finance/setup-schema" target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "0.75rem", background: "#C9A84C", color: "#070C1A", padding: "7px 16px", borderRadius: 7, textDecoration: "none", fontWeight: 700, fontSize: "0.8rem" }}>
                    ⬇ Download schema.sql
                  </a>
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(237,232,220,0.35)" }}>After running the SQL, click <strong>Create Business</strong> again.</div>
                </div>
              )}
              {error && error !== "__SCHEMA_MISSING__" && (
                <div style={{ marginTop: "1rem", color: "#f87171", fontSize: "0.83rem", background: "rgba(248,113,113,0.1)", padding: "0.75rem", borderRadius: 6 }}>{error}</div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => (s - 1) as Step)} style={{ background: "rgba(237,232,220,0.08)", border: "none", color: "#EDE8DC", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: "0.9rem" }}>
              ← Back
            </button>
          ) : (
            <Link href="/finance" style={{ background: "rgba(237,232,220,0.05)", border: "none", color: "rgba(237,232,220,0.5)", padding: "10px 24px", borderRadius: 8, textDecoration: "none", fontSize: "0.9rem" }}>
              Cancel
            </Link>
          )}
          {step < 4 ? (
            <button
              onClick={() => { if (step === 1 && !form.name) { setError("Business name is required"); return; } setError(""); setStep(s => (s + 1) as Step); }}
              style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 28px", borderRadius: 8, cursor: saving ? "wait" : "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Creating…" : "Create Business →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
