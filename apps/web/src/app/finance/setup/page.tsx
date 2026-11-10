"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LogoPicker from "@/components/LogoPicker";
import { COUNTRIES } from "@/lib/tax";
import { stepError, canCreate } from "@/lib/setupSteps";
import { askInApp } from "@/lib/apiAuthClient";
import { setActiveBusiness } from "@/lib/activeBusiness";

// Current Indian financial year start (April), e.g. "2026-04-01"
function indianFyStart(d = new Date()) { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; }
// The financial year that contains today, for a year starting in month `m` (1–12)
function fyStartFor(m: number, d = new Date()) { const y = d.getMonth() + 1 >= m ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(m).padStart(2, "0")}-01`; }
function fyLabel(start: string) { const y = +start.slice(0, 4); return start.slice(5, 7) === "01" ? `FY ${y}` : `FY ${y}-${String(y + 1).slice(2)}`; }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
  const [reviewSince, setReviewSince] = useState(0);   // when the Review step opened (guards a double-click)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", legal_name: "", business_type: "proprietorship",
    gstin: "", pan: "", tan: "",
    gst_username: "", gst_trade_name: "",
    address: "", city: "", state: "Kerala", pincode: "",
    email: "", phone: "",
    gst_registration_type: "",
    coa_preset: "services",
    fy_start: indianFyStart(),
    country: "IN",
    logo_url: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      setForm(f => ({ ...f, email: user.email ?? "" }));
    });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // GSTIN first: fill everything the number and the public GST record can tell us
  const [gstLook, setGstLook] = useState<{ busy: boolean; msg: string; ok: boolean; filled: string[] }>({ busy: false, msg: "", ok: true, filled: [] });
  async function lookupGstin(raw: string) {
    const g = raw.toUpperCase().replace(/\s+/g, "");
    setForm(f => ({ ...f, gstin: g }));
    if (g.length < 15) { setGstLook({ busy: false, msg: "", ok: true, filled: [] }); return; }
    setGstLook({ busy: true, msg: "Reading the GST record…", ok: true, filled: [] });
    const r = await fetch(`/api/finance/gstin-lookup?gstin=${g}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setGstLook({ busy: false, msg: d.error ?? "Couldn't read that GSTIN.", ok: false, filled: [] }); return; }
    const filled: string[] = [];
    const patch: Record<string, string> = { gstin: g, country: "IN" };
    const put = (k: string, v: string | undefined, label: string) => { if (v && String(v).trim()) { patch[k] = String(v).trim(); filled.push(label); } };
    put("state", STATES.includes(d.state) ? d.state : undefined, "state");
    put("pan", d.pan, "PAN");
    put("business_type", d.businessType, "business type");
    put("name", d.tradeName || d.legalName, "business name");
    if (d.legalName && d.tradeName && d.legalName !== d.tradeName) put("legal_name", d.legalName, "legal name");
    put("gst_trade_name", d.tradeName, "trade name");
    put("address", d.address, "address");
    put("city", d.city, "city");
    put("pincode", d.pincode, "PIN code");
    put("gst_registration_type", d.registrationType ?? "regular", "GST type");
    setForm(f => ({ ...f, ...patch }));
    const inactive = d.status && !/active/i.test(d.status) ? ` ⚠ The GST record says this registration is "${d.status}".` : "";
    setGstLook({ busy: false, ok: true, filled, msg: `${d.note ? d.note + " " : ""}${inactive}${d.reason ? ` (${String(d.reason).slice(0, 140)})` : ""}` });
  }
  const isIN = form.country === "IN";
  const country = COUNTRIES.find(c => c.code === form.country) ?? COUNTRIES[0];
  const baseFy = isIN ? indianFyStart() : fyStartFor(+form.fy_start.slice(5, 7) || 1);

  async function handleSubmit() {
    if (!userId) { setError("Your session has expired. Please sign in again, then press Create Business."); return; }
    // Plan limit: Starter keeps 1 business, Basic 2, Pro 5, CA Practice 15 — over it, offer the plan that fits
    const lim = await fetch("/api/finance/plan-limit").then(r => r.ok ? r.json() : null).catch(() => null) as { can_add: boolean; limit: number | null; used: number; plan_label: string; upgrade_to: { id: string; name: string; price: number; yearly: number; businesses: number | null } | null } | null;
    if (lim && !lim.can_add) {
      const up = lim.upgrade_to;
      const head = lim.plan_label === "No plan" ? "Choose a plan to add another business" : `Your ${lim.plan_label} plan keeps ${lim.limit} business${lim.limit === 1 ? "" : "es"}`;
      const body = lim.plan_label === "No plan"
        ? "Your first business is free to set up. To add more, start the free trial or choose a plan."
        : `You have ${lim.used}. ${up ? `Upgrade to ${up.name} — up to ${up.businesses ?? "unlimited"} businesses for ₹${up.price.toLocaleString("en-IN")}/month (or ₹${up.yearly.toLocaleString("en-IN")}/year) + GST.` : "Write to us for a plan sized to your practice."}`;
      setError(`${head}. ${body}`);
      if (await askInApp(head, body, up ? `Upgrade to ${up.name}` : "See plans", "Not now")) router.push("/finance/pricing");
      return;
    }
    const gate = canCreate(step, form);
    if (!gate.ok) { setError(gate.error); setStep(gate.step as Step); return; }
    if (Date.now() - reviewSince < 800) return;          // a double-click on "Next" never creates the business
    // Already have a business with this GSTIN or name? Ask before creating a second copy.
    const { data: mine } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("owner_id", userId);
    const g = form.gstin.trim().toUpperCase();
    const twin = (mine ?? []).find(b => (g && b.gstin?.toUpperCase() === g) || b.name?.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (twin && !(await askInApp("This business may already exist", `You already have "${twin.name}"${twin.gstin ? ` (GSTIN ${twin.gstin})` : ""} with the same ${g && twin.gstin?.toUpperCase() === g ? "GSTIN" : "name"}. Create a separate business only if it really is one — to change its details, use Settings → Business Details.`, "Create separate business", "Go back"))) return;
    setSaving(true);
    setError("");
    try {
      // The id is made here and the row is not read back: reading a just-inserted business is checked against
      // membership before the row is visible, which the database refuses ("violates row-level security")
      const biz = { id: crypto.randomUUID() };
      const { error: bizErr } = await supabase
        .from("fw_fin_businesses")
        .insert({
          id: biz.id,
          owner_id: userId,
          name: form.name,
          legal_name: form.legal_name || form.name,
          business_type: form.business_type,
          gstin: form.gstin || null,
          pan: form.pan || null,
          tan: form.tan || null,
          gst_username: form.gst_username || null,
          gst_trade_name: form.gst_trade_name || null,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          email: form.email,
          phone: form.phone,
          gst_registration_type: isIN ? (form.gst_registration_type || "unregistered") : (form.gstin ? "regular" : "unregistered"),
          currency: country.currency,
          fiscal_year_start: form.fy_start.slice(5),
          country: country.code, timezone: country.timezone, locale: country.locale, tax_regime: isIN ? "IN_GST" : "NONE",
          is_active: true,
        });

      if (bizErr) throw new Error(bizErr.message);
      if (form.logo_url) await supabase.from("fw_fin_businesses").update({ logo_url: form.logo_url }).eq("id", biz.id);

      // Create current financial year
      const fyStart = new Date(form.fy_start);
      const fyEnd = new Date(fyStart);
      fyEnd.setFullYear(fyEnd.getFullYear() + 1);
      fyEnd.setDate(fyEnd.getDate() - 1);
      const fyName = fyLabel(form.fy_start).replace(/^FY /, "");

      await supabase.from("fw_fin_financial_years").insert({
        business_id: biz.id,
        label: fyName,
        start_date: form.fy_start,
        end_date: fyEnd.toISOString().split("T")[0],
        is_current: true,
        is_locked: false,
      });

      // Seed Chart of Accounts
      await seedCoA(biz.id, form.coa_preset);

      // Save as active business
      if (userId) setActiveBusiness(userId, biz.id);

      // If user already had businesses, go to selector; otherwise straight to finance
      const { count } = await supabase
        .from("fw_fin_businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);
      router.push((count ?? 0) > 1 ? "/finance/select-business" : "/finance/opening-balances?welcome=1");
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
    width: "100%", background: "#FFFFFF", border: "1px solid #E2DDD0",
    color: "#10241F", padding: "12px 14px", borderRadius: 10, fontSize: "0.95rem", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "0.45rem", fontSize: "0.86rem", color: "#10241F", fontWeight: 600 };
  const fieldStyle: React.CSSProperties = { marginBottom: "1.25rem" };

  const steps: { num: Step; label: string }[] = [
    { num: 1, label: "Business Info" }, { num: 2, label: "Tax & GST" },
    { num: 3, label: "Accounts Setup" }, { num: 4, label: "Review" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F6F4EE", color: "#10241F", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`.su-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}.su-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .su-main input:focus,.su-main select:focus,.su-main textarea:focus{border-color:#0B5E42 !important;box-shadow:0 0 0 3px rgba(11,94,66,.12)}
        @media(max-width:980px){.su-grid{grid-template-columns:minmax(0,1fr)}.su-side{order:2}}
        @media(max-width:720px){.su-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.su-tab-sub{display:none}}`}</style>
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE7DC", padding: "0 clamp(16px,4vw,48px)", height: 72, display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/finance" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/frebook-logo.png" alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 10, display: "block" }} />
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#12352D" }}>Fre<span style={{ color: "#B68A2E" }}>Book</span></span>
        </Link>
        <span style={{ width: 1, height: 22, background: "#E2DDD0" }} />
        <span style={{ fontSize: "0.92rem", color: "#4D5B56" }}>Business setup</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#8A6420", background: "#F7EED6", padding: "6px 12px", borderRadius: 999 }}>✓ Changes kept as you go</span>
        <Link href="/finance" style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0B5E42", textDecoration: "none" }}>Save &amp; exit</Link>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px clamp(16px,4vw,48px) 60px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.12em", color: "#9A7A2E" }}>STEP {step} OF 4 · ABOUT 2 MINUTES</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: "clamp(1.8rem,3.4vw,2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#10241F" }}>{["Tell us about your business", "Tax & GST", "Set up your accounts", "Check and create"][step - 1]}</h1>
        <p style={{ margin: "0 0 22px", fontSize: "1rem", color: "#4D5B56" }}>{["This shows on your invoices and sets up your books. You can change it later.", "Your GST registration, PAN and how you file returns.", "Your financial year, the kind of business and opening balances.", "One last look before FreBook creates your books."][step - 1]}</p>

        <nav aria-label="Setup steps" className="su-tabs" style={{ background: "#FFFFFF", border: "1px solid #ECE7DC", borderRadius: 16, padding: 8, marginBottom: 24 }}>
          {([[1, "Business info", "Name, type, contact"], [2, "Tax & GST", "GSTIN, PAN, returns"], [3, "Accounts setup", "Year, balances, sync"], [4, "Review", "Check and create"]] as [Step, string, string][]).map(([n, t, sub]) => {
            const on = step === n, done = step > n;
            return (
              <button key={n} type="button" onClick={() => { if (n < step) setStep(n); }} aria-current={on ? "step" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "none", background: on ? "#EEF6F0" : "transparent", cursor: n < step ? "pointer" : "default", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.88rem", background: on ? "#12352D" : done ? "#0B7A55" : "#FFFFFF", color: on || done ? "#FFFFFF" : "#4D5B56", border: on || done ? "none" : "1px solid #E2DDD0" }}>{done ? "✓" : n}</span>
                <span style={{ minWidth: 0 }}><span style={{ display: "block", fontWeight: 700, fontSize: "0.92rem", color: "#10241F" }}>{t}</span><span className="su-tab-sub" style={{ display: "block", fontSize: "0.78rem", color: "#5E6B66" }}>{sub}</span></span>
              </button>
            );
          })}
        </nav>

        <div className="su-grid">
        <div className="su-main" style={{ background: "#FFFFFF", border: "1px solid #ECE7DC", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "clamp(20px,3vw,32px)" }}>
          {step === 1 && (
            <>
              {isIN && (
                <div style={{ background: "#EEF6F0", border: "1px solid #CFE4D6", borderRadius: 16, padding: "18px 20px", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9, background: "#8A6420", color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 17 }}>⚡</span>
                    <div><div style={{ fontWeight: 800, fontSize: "1rem", color: "#10241F" }}>Have a GSTIN? Start here</div>
                      <div style={{ fontSize: "0.8rem", color: "#4D5B56" }}>We&apos;ll fill in your name, PAN, state, business type and address from it.</div></div>
                  </div>
                  <input aria-label="GSTIN" value={form.gstin} maxLength={15} onChange={e => lookupGstin(e.target.value)} placeholder="E.G. 32ABCDE1234F1Z5"
                    style={{ ...inputStyle, height: 48, fontSize: "1rem", letterSpacing: "0.12em", fontFamily: "'IBM Plex Mono',ui-monospace,monospace", textTransform: "uppercase", borderColor: !gstLook.ok ? "#C2321F" : gstLook.filled.length ? "#0B7A55" : undefined }} />
                  <div role="status" style={{ fontSize: "0.8rem", marginTop: 8, color: !gstLook.ok ? "#C2321F" : "#2E5A45" }}>
                    {gstLook.busy ? "Reading the GST record…" : !gstLook.ok ? gstLook.msg : gstLook.filled.length ? `✓ Filled from GSTIN: ${gstLook.filled.join(", ")}. Check them below.${gstLook.msg ? " " + gstLook.msg : ""}` : "Optional — you can add it in the next step."}
                  </div>
                </div>
              )}
              <div style={fieldStyle}>
                <label style={labelStyle}>Country *</label>
                <select style={inputStyle} value={form.country} onChange={e => {
                  const cc = e.target.value;
                  // India keeps its April year and state list; other countries default to a January year and free-text region
                  setForm(f => ({ ...f, country: cc, state: cc === "IN" ? "Kerala" : "", fy_start: cc === "IN" ? indianFyStart() : fyStartFor(1), gst_registration_type: cc === "IN" ? f.gst_registration_type : "" }));
                }}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {!isIN && <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", marginTop: 4 }}>Books will be kept in {COUNTRIES.find(c => c.code === form.country)?.currency}, with {COUNTRIES.find(c => c.code === form.country)?.name}&apos;s filing reminders. You can change this later in Region &amp; Currency.</div>}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Logo (optional)</label>
                <LogoPicker value={form.logo_url || null} onChange={v => set("logo_url", v ?? "")} />
              </div>
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
                <div role="radiogroup" aria-label="Business type" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {BIZ_TYPES.map(b => {
                    const on = form.business_type === b.value;
                    return (
                      <button key={b.value} type="button" role="radio" aria-checked={on} onClick={() => set("business_type", b.value)}
                        style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${on ? "#0B5E42" : "rgba(20,26,58,0.13)"}`, background: on ? "#EEF6F0" : "#FFFFFF", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#10241F" }}>{b.label}</span>
                        {on && <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", background: "#0B5E42", color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 11, flexShrink: 0 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" placeholder={({ IN: "+91", AE: "+971", SA: "+966", QA: "+974", OM: "+968", BH: "+973", KW: "+965", GB: "+44", US: "+1", SG: "+65" } as Record<string, string>)[form.country] ?? "+"} value={form.phone} onChange={e => set("phone", e.target.value)} />
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
                  <label style={labelStyle}>{isIN ? "State" : "State / Emirate / Region"}</label>
                  {isIN
                    ? <select style={inputStyle} value={form.state} onChange={e => set("state", e.target.value)}>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    : <input style={inputStyle} placeholder={form.country === "AE" ? "e.g. Dubai" : form.country === "US" ? "e.g. California" : "Region"} value={form.state} onChange={e => set("state", e.target.value)} />}
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>{isIN ? "PIN Code" : "Postal Code"}</label>
                  <input style={inputStyle} maxLength={isIN ? 6 : 12} value={form.pincode} onChange={e => set("pincode", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>{isIN ? "Tax & GST Information" : "Tax Information"}</h2>
              {!isIN && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>{({ AE: "TRN (VAT registration number)", SA: "VAT number", OM: "VAT number", BH: "VAT account number", GB: "VAT registration number", US: "EIN (employer ID)", SG: "GST registration / UEN", QA: "Tax card number (TIN)", KW: "Tax / civil ID number" } as Record<string, string>)[form.country] ?? "Tax registration number"} (optional)</label>
                  <input style={inputStyle} value={form.gstin} onChange={e => set("gstin", e.target.value.trim())} placeholder="Leave blank if not registered" />
                  <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", marginTop: 4 }}>Shown on your invoices. Filing reminders for VAT/GST appear when this is filled in.</div>
                </div>
              )}
              {isIN && <>
              <div style={fieldStyle}>
                <label style={labelStyle}>GST Registration Type</label>
                {GST_TYPES.map(g => (
                  <label key={g.value} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", marginBottom: "0.5rem", background: form.gst_registration_type === g.value ? "rgba(35,42,99,0.1)" : "#FFFFFF", border: `1px solid ${form.gst_registration_type === g.value ? "rgba(35,42,99,0.3)" : "rgba(20,26,58,0.11)"}`, borderRadius: 8, cursor: "pointer" }}>
                    <input type="radio" name="gst_type" value={g.value} checked={form.gst_registration_type === g.value} onChange={e => set("gst_registration_type", e.target.value)} style={{ accentColor: "#232A63" }} />
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
              <div style={{ marginTop: "0.5rem", marginBottom: "1.25rem", background: "rgba(35,42,99,0.04)", border: "1px solid rgba(35,42,99,0.15)", borderRadius: 10, padding: "1rem 1.1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#232A63", fontWeight: 700, marginBottom: "0.6rem" }}>🌐 GST Portal Credentials (Optional)</div>
                <div style={{ fontSize: "0.74rem", color: "rgba(20,26,58,0.70)", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                  Add your GST portal username to enable auto-fetch of GSTR-2A/2B data in GST Reconciliation. <strong style={{ color: "rgba(20,26,58,0.85)" }}>We never store your password.</strong> OTP is used at the time of download.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>GST Portal Username</label>
                    <input style={inputStyle} placeholder="e.g. 22AAAAA0000A1Z5 or mobile" value={form.gst_username} onChange={e => set("gst_username", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Trade Name (as in GST portal)</label>
                    <input style={inputStyle} placeholder="Registered trade name" value={form.gst_trade_name} onChange={e => set("gst_trade_name", e.target.value)} />
                  </div>
                </div>
              </div>
              </>}
              {!isIN && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Financial year starts in</label>
                  <select style={inputStyle} value={+form.fy_start.slice(5, 7)} onChange={e => set("fy_start", fyStartFor(+e.target.value))}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              )}
              <div style={fieldStyle}>
                <label style={labelStyle}>Current Financial Year</label>
                <select style={inputStyle} value={form.fy_start} onChange={e => set("fy_start", e.target.value)}>
                  {[-2, -1, 0].map(k => {
                    const cur = baseFy, y = +cur.slice(0, 4) + k, start = `${y}${cur.slice(4)}`;
                    const end = new Date(Date.UTC(y + 1, +cur.slice(5, 7) - 1, 0)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
                    const from = new Date(Date.UTC(y, +cur.slice(5, 7) - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
                    return <option key={start} value={start}>{fyLabel(start)} ({from} – {end})</option>;
                  })}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem", fontWeight: 700 }}>Chart of Accounts</h2>
              <p style={{ color: "rgba(20,26,58,0.75)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>We'll pre-fill accounts for your industry. You can add more later.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {COA_PRESETS.map(p => (
                  <label key={p.value} style={{
                    padding: "1rem", background: form.coa_preset === p.value ? "rgba(35,42,99,0.1)" : "#FFFFFF",
                    border: `1px solid ${form.coa_preset === p.value ? "rgba(35,42,99,0.35)" : "rgba(20,26,58,0.11)"}`,
                    borderRadius: 10, cursor: "pointer",
                  }}>
                    <input type="radio" name="coa_preset" value={p.value} checked={form.coa_preset === p.value} onChange={e => set("coa_preset", e.target.value)} style={{ display: "none" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: form.coa_preset === p.value ? "#232A63" : "#141A3A", marginBottom: "0.3rem" }}>{p.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)" }}>{p.desc}</div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: "1.5rem", background: "rgba(35,42,99,0.05)", border: "1px solid rgba(35,42,99,0.15)", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#232A63", fontWeight: 600, marginBottom: "0.3rem" }}>What's included</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.75)", lineHeight: 1.6 }}>
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
                ...(isIN ? [
                  { label: "GST Type", value: GST_TYPES.find(g => g.value === form.gst_registration_type)?.label ?? "—" },
                  { label: "GSTIN", value: form.gstin || "Not provided" },
                  { label: "PAN", value: form.pan || "Not provided" },
                ] : [{ label: "Tax number", value: form.gstin || "Not registered" }, { label: "Currency", value: country.currency }]),
                { label: "Country", value: country.name },
                { label: "Financial Year", value: fyLabel(form.fy_start) },
                { label: "Accounts Preset", value: COA_PRESETS.find(c => c.value === form.coa_preset)?.label ?? "—" },
                ...(form.gst_username ? [{ label: "GST Portal Username", value: form.gst_username }] : []),
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
                  <span style={{ fontSize: "0.82rem", color: "rgba(20,26,58,0.75)" }}>{row.label}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              {error === "__SCHEMA_MISSING__" && (
                <div style={{ marginTop: "1rem", background: "rgba(194,50,31,0.08)", border: "1px solid rgba(194,50,31,0.25)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ fontWeight: 700, color: "#C2321F", marginBottom: "0.5rem" }}>⚠️ Database tables not set up yet</div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(20,26,58,0.85)", lineHeight: 1.6, marginBottom: "0.85rem" }}>
                    The FreWork Finance tables don&apos;t exist in your Supabase project yet. You need to run the schema SQL once in your Supabase dashboard.
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.75)", marginBottom: "0.5rem", fontWeight: 600 }}>Steps:</div>
                  <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.78rem", color: "rgba(20,26,58,0.80)", lineHeight: 2 }}>
                    <li>Open <strong style={{ color: "#232A63" }}>supabase.com</strong> → your project → <strong style={{ color: "#232A63" }}>SQL Editor</strong></li>
                    <li>Click <strong style={{ color: "#232A63" }}>New Query</strong></li>
                    <li>Download the schema SQL and paste it in:</li>
                  </ol>
                  <a href="/api/finance/setup-schema" target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "0.75rem", background: "#232A63", color: "#F5F6FA", padding: "7px 16px", borderRadius: 7, textDecoration: "none", fontWeight: 700, fontSize: "0.8rem" }}>
                    ⬇ Download schema.sql
                  </a>
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(20,26,58,0.60)" }}>After running the SQL, click <strong>Create Business</strong> again.</div>
                </div>
              )}
              {error && error !== "__SCHEMA_MISSING__" && (
                <div style={{ marginTop: "1rem", color: "#C2321F", fontSize: "0.83rem", background: "rgba(194,50,31,0.1)", padding: "0.75rem", borderRadius: 6 }}>{error}</div>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px clamp(20px,3vw,32px)", background: "#FAF8F3", borderTop: "1px solid #ECE7DC" }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => (s - 1) as Step)} style={{ background: "#FFFFFF", border: "1px solid #E2DDD0", color: "#10241F", height: 48, padding: "0 22px", borderRadius: 12, cursor: "pointer", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit" }}>← Back</button>
          ) : (
            <Link href="/finance" style={{ color: "#5E6B66", fontSize: "0.92rem", textDecoration: "none" }}>Cancel</Link>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: "0.85rem", color: "#5E6B66" }}>* Required</span>
            {step < 4 ? (
              <button onClick={() => { const e = stepError(step, form); if (e) { setError(e); return; } setError(""); if (step === 3) setReviewSince(Date.now()); setStep(s => (s + 1) as Step); }}
                style={{ background: "#12352D", border: "none", color: "#FFFFFF", height: 50, padding: "0 24px", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: "1rem", fontFamily: "inherit" }}>
                Continue to {["Tax & GST", "Accounts setup", "Review"][step - 1]} →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} style={{ background: "#12352D", border: "none", color: "#FFFFFF", height: 50, padding: "0 24px", borderRadius: 12, cursor: saving ? "wait" : "pointer", fontWeight: 800, fontSize: "1rem", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>
                {saving ? "Creating…" : "Create business →"}
              </button>
            )}
          </span>
        </div>
        {error && step < 4 && <div role="alert" style={{ padding: "0 clamp(20px,3vw,32px) 16px", background: "#FAF8F3", color: "#C2321F", fontSize: "0.88rem" }}>{error}</div>}
        </div>

        <aside className="su-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const typeLabel = BIZ_TYPES.find(b => b.value === form.business_type)?.label ?? "";
            const checks: [string, boolean][] = [["Business name", !!form.name.trim()], ["Business type", !!form.business_type], ["State", !!form.state], ["Email & mobile", !!form.email.trim() && !!form.phone.trim()], ["Address", !!form.address.trim()], ["PAN / GSTIN", !!(form.pan.trim() || form.gstin.trim())]];
            const pct = Math.round((checks.filter(c => c[1]).length / checks.length) * 100);
            return (<>
              <section style={{ background: "#FFFFFF", border: "1px solid #ECE7DC", borderRadius: 18, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.1em", color: "#4D5B56", marginBottom: 12 }}>LIVE INVOICE PREVIEW<span style={{ color: "#B68A2E", letterSpacing: 0 }}>● Updating</span></div>
                <div style={{ border: "1px solid #ECE7DC", borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {form.logo_url ? <img src={form.logo_url} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10 }} /> : <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, background: "#12352D", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 800 }}>{(form.name.trim() || "FB").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#10241F", lineHeight: 1.25 }}>{form.name.trim() || "Your business name"}</div>
                      <div style={{ fontSize: "0.78rem", color: "#5E6B66" }}>{typeLabel}</div>
                    </div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", color: "#0B5E42", border: "1px solid #CFE4D6", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>{form.gstin ? "TAX INVOICE" : "INVOICE"}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#4D5B56", margin: "12px 0" }}>{[form.address, form.city, form.state, form.pincode].filter(x => x?.trim()).join(", ") || "Your registered address appears here"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[["GSTIN", form.gstin || "—"], ["Place of supply", isIN ? form.state || "—" : form.state || "—"]].map(([k, v]) => <div key={k} style={{ background: "#F6F4EE", borderRadius: 8, padding: "7px 9px" }}><div style={{ fontSize: "0.72rem", color: "#5E6B66" }}>{k}</div><div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#10241F", wordBreak: "break-all" }}>{v}</div></div>)}
                  </div>
                  <div aria-hidden="true" style={{ marginTop: 14, borderTop: "1px dashed #E2DDD0", paddingTop: 10, display: "grid", gap: 6 }}>
                    <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ width: "60%", height: 6, borderRadius: 4, background: "#EEEAE0" }} /><span style={{ width: "18%", height: 6, borderRadius: 4, background: "#EEEAE0" }} /></span>
                    <span style={{ display: "flex", justifyContent: "flex-end" }}><span style={{ width: "28%", height: 8, borderRadius: 4, background: "#E8D5A0" }} /></span>
                  </div>
                </div>
              </section>
              <section style={{ background: "#FFFFFF", border: "1px solid #ECE7DC", borderRadius: 18, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ fontSize: "1rem", color: "#10241F" }}>Setup progress</b><b style={{ fontSize: "1.4rem", color: "#B68A2E" }}>{pct}%</b></div>
                <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "#EEEAE0", margin: "10px 0 14px", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#C9A24A", transition: "width .3s" }} /></div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 9 }}>
                  {checks.map(([t, ok]) => <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", color: ok ? "#10241F" : "#5E6B66", fontWeight: ok ? 600 : 400 }}><span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, background: ok ? "#8A6420" : "transparent", color: "#FFFFFF", border: ok ? "none" : "1.5px solid #CFC8B8" }}>{ok ? "✓" : ""}</span>{t}</li>)}
                </ul>
              </section>
              <section style={{ background: "#12352D", borderRadius: 18, padding: 20, color: "#F4EFE4" }}>
                <b style={{ fontSize: "1rem", color: "#FFFFFF" }}>Stuck on something?</b>
                <p style={{ margin: "6px 0 14px", fontSize: "0.88rem", lineHeight: 1.5, color: "#C9D3CE" }}>Type your GSTIN in the green box — FreBook fills the rest. Questions? Ask FreBook once your books are created.</p>
                <Link href="/finance/help" style={{ display: "block", textAlign: "center", background: "#D9B56F", color: "#12352D", fontWeight: 800, borderRadius: 12, padding: "12px 0", textDecoration: "none" }}>Open help</Link>
              </section>
            </>);
          })()}
        </aside>
        </div>
      </div>
    </div>
  );
}
