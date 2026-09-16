"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type IRNData = {
  SellerGSTIN: string;
  BuyerGSTIN: string;
  DocNo: string;
  DocDate: string;
  TaxableValue: number;
  CGST: number;
  SGST: number;
  IGST: number;
  TotalTax: number;
  GrandTotal: number;
  HSN: string;
  ItemDesc: string;
  Qty: number;
  UQC: string;
  UnitPrice: number;
  SupplyType: "B2B" | "B2C" | "EXPWP" | "EXPWOP";
  TransactionType: "Regular" | "Bill of Supply" | "Credit Note" | "Debit Note";
  EWBRequired: boolean;
  EWBValue: number;
};

const BLANK: IRNData = {
  SellerGSTIN: "", BuyerGSTIN: "", DocNo: "", DocDate: new Date().toISOString().slice(0, 10),
  TaxableValue: 0, CGST: 0, SGST: 0, IGST: 0, TotalTax: 0, GrandTotal: 0,
  HSN: "", ItemDesc: "", Qty: 1, UQC: "NOS", UnitPrice: 0,
  SupplyType: "B2B", TransactionType: "Regular", EWBRequired: false, EWBValue: 0,
};

const UQC_OPTIONS = ["NOS","KGS","MTR","LTR","SQM","CBM","TON","PKT","BOX","SET","PAC","BAG"];
const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28];

function calcTax(data: IRNData, rate: number, intraState: boolean) {
  const taxable = data.Qty * data.UnitPrice;
  const totalTax = Math.round(taxable * rate) / 100;
  const half = Math.round(totalTax / 2 * 100) / 100;
  return {
    TaxableValue: taxable,
    CGST: intraState ? half : 0,
    SGST: intraState ? (totalTax - half) : 0,
    IGST: intraState ? 0 : totalTax,
    TotalTax: totalTax,
    GrandTotal: taxable + totalTax,
  };
}

function mockIRN(data: IRNData): string {
  const seed = `${data.SellerGSTIN}${data.DocNo}${data.DocDate}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
  return Math.abs(hash).toString(16).padStart(8, "0").toUpperCase()
    + Math.random().toString(16).slice(2, 18).toUpperCase().padStart(16, "F")
    + Math.abs(hash ^ 0xDEADBEEF).toString(16).padStart(40, "0").toUpperCase().slice(0, 40);
}

export default function EInvoicePage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [d, setD] = useState<IRNData>(BLANK);
  const [gstRate, setGstRate] = useState(18);
  const [intraState, setIntraState] = useState(true);
  const [tab, setTab] = useState<"builder" | "json" | "irn">("builder");
  const [generatedIRN, setGeneratedIRN] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (saved) setBizId(saved);
    });
  }, []);

  const update = (field: keyof IRNData, value: string | number | boolean) => {
    setD(prev => {
      const next = { ...prev, [field]: value };
      const tax = calcTax(next, gstRate, intraState);
      return { ...next, ...tax };
    });
  };

  const recalc = (rate: number, intra: boolean) => {
    setGstRate(rate);
    setIntraState(intra);
    setD(prev => ({ ...prev, ...calcTax(prev, rate, intra) }));
  };

  const buildJSON = () => ({
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: d.SupplyType, RegRev: "N", EcmGstin: null },
    DocDtls: { Typ: d.TransactionType, No: d.DocNo, Dt: d.DocDate },
    SellerDtls: { Gstin: d.SellerGSTIN, LglNm: "Seller Name", Addr1: "Address Line 1", Loc: "City", Pin: 682001, Stcd: "32" },
    BuyerDtls: { Gstin: d.BuyerGSTIN, LglNm: "Buyer Name", Pos: intraState ? "32" : "29", Addr1: "Address", Loc: "City", Pin: 560001, Stcd: "29" },
    ItemList: [{
      SlNo: "1", PrdDesc: d.ItemDesc, IsServc: "N", HsnCd: d.HSN,
      Qty: d.Qty, Unit: d.UQC, UnitPrice: d.UnitPrice,
      TotAmt: d.TaxableValue, AssAmt: d.TaxableValue,
      GstRt: gstRate, IgstAmt: d.IGST, CgstAmt: d.CGST, SgstAmt: d.SGST,
      TotItemVal: d.GrandTotal,
    }],
    ValDtls: {
      AssVal: d.TaxableValue, CgstVal: d.CGST, SgstVal: d.SGST, IgstVal: d.IGST,
      TotInvVal: d.GrandTotal,
    },
    EwbDtls: d.EWBRequired ? { TransValue: d.EWBValue, Distance: 50 } : undefined,
  });

  const generateIRN = () => {
    if (!d.SellerGSTIN || !d.DocNo || !d.TaxableValue) {
      alert("Fill Seller GSTIN, Document No, and at least one item before generating.");
      return;
    }
    setGeneratedIRN(mockIRN(d));
    setTab("irn");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const S = {
    page: { minHeight: "100vh", background: "#0A0D14", color: "#E8EDF5", fontFamily: "Inter,system-ui,sans-serif" },
    nav: { borderBottom: "1px solid #1F2937", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 52 },
    main: { maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" },
    card: { background: "#111827", border: "1px solid #1F2937", borderRadius: 12, padding: "1.5rem", marginBottom: "1rem" },
    label: { fontSize: "0.72rem", color: "#6B7280", marginBottom: "0.3rem", display: "block", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
    input: { width: "100%", background: "#0A0D14", border: "1px solid #374151", color: "#E8EDF5", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" as const },
    tabBtn: (a: boolean) => ({ padding: "0.45rem 1rem", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit", background: a ? "#C9A84C" : "transparent", color: a ? "#0A0D14" : "#9CA3AF", fontWeight: a ? 700 : 400 }),
    btnPrimary: { padding: "0.55rem 1.3rem", borderRadius: 8, border: "none", background: "#C9A84C", color: "#0A0D14", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  };

  const jsonStr = JSON.stringify(buildJSON(), null, 2);
  const fmtR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "#374151" }}>›</span>
        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>E-Invoice (IRN)</span>
        <div style={{ flex: 1 }} />
        <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noopener" style={{ fontSize: "0.75rem", color: "#6B7280", textDecoration: "none" }}>IRP Portal ↗</a>
      </nav>

      <div style={S.main}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 0.25rem" }}>E-Invoice Builder</h1>
          <p style={{ color: "#6B7280", fontSize: "0.84rem", margin: 0 }}>Build IRN-compliant JSON for the GST Invoice Registration Portal (IRP). Mandatory for turnover &gt; ₹5 Cr.</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["builder", "json", "irn"] as const).map(t => (
            <button key={t} style={S.tabBtn(tab === t)} onClick={() => setTab(t)}>
              {t === "builder" ? "Invoice Builder" : t === "json" ? "IRP JSON" : "IRN Result"}
            </button>
          ))}
        </div>

        {/* ── BUILDER ── */}
        {tab === "builder" && (
          <>
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.9rem" }}>Transaction Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={S.label}>Supply Type</label>
                  <select style={{ ...S.input }} value={d.SupplyType} onChange={e => update("SupplyType", e.target.value)}>
                    {["B2B", "B2C", "EXPWP", "EXPWOP"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Transaction Type</label>
                  <select style={{ ...S.input }} value={d.TransactionType} onChange={e => update("TransactionType", e.target.value)}>
                    {["Regular", "Bill of Supply", "Credit Note", "Debit Note"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Supply</label>
                  <select style={{ ...S.input }} value={intraState ? "intra" : "inter"} onChange={e => recalc(gstRate, e.target.value === "intra")}>
                    <option value="intra">Intra-State (CGST+SGST)</option>
                    <option value="inter">Inter-State (IGST)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.9rem" }}>Seller & Buyer</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={S.label}>Seller GSTIN *</label>
                  <input style={S.input} value={d.SellerGSTIN} onChange={e => update("SellerGSTIN", e.target.value.toUpperCase())} placeholder="32XXXXX1234X1Z5" maxLength={15} />
                </div>
                <div>
                  <label style={S.label}>Buyer GSTIN</label>
                  <input style={S.input} value={d.BuyerGSTIN} onChange={e => update("BuyerGSTIN", e.target.value.toUpperCase())} placeholder="29XXXXX5678X1Z2" maxLength={15} />
                </div>
                <div>
                  <label style={S.label}>Document / Invoice No. *</label>
                  <input style={S.input} value={d.DocNo} onChange={e => update("DocNo", e.target.value.toUpperCase())} placeholder="INV-2026-001" />
                </div>
                <div>
                  <label style={S.label}>Document Date</label>
                  <input type="date" style={S.input} value={d.DocDate} onChange={e => update("DocDate", e.target.value)} />
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.9rem" }}>Line Item</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={S.label}>Item Description</label>
                  <input style={S.input} value={d.ItemDesc} onChange={e => update("ItemDesc", e.target.value)} placeholder="Software Services" />
                </div>
                <div>
                  <label style={S.label}>HSN/SAC Code</label>
                  <input style={S.input} value={d.HSN} onChange={e => update("HSN", e.target.value)} placeholder="998314" maxLength={8} />
                </div>
                <div>
                  <label style={S.label}>Qty</label>
                  <input type="number" style={S.input} value={d.Qty} min={0} onChange={e => { update("Qty", +e.target.value); }} />
                </div>
                <div>
                  <label style={S.label}>UQC</label>
                  <select style={{ ...S.input }} value={d.UQC} onChange={e => update("UQC", e.target.value)}>
                    {UQC_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Unit Price (₹)</label>
                  <input type="number" style={S.input} value={d.UnitPrice || ""} min={0} onChange={e => { update("UnitPrice", +e.target.value); }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={S.label}>GST Rate (%)</label>
                  <select style={{ ...S.input }} value={gstRate} onChange={e => recalc(+e.target.value, intraState)}>
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>E-Way Bill Required?</label>
                  <select style={{ ...S.input }} value={d.EWBRequired ? "yes" : "no"} onChange={e => update("EWBRequired", e.target.value === "yes")}>
                    <option value="no">No (below ₹50,000 or exempt)</option>
                    <option value="yes">Yes (value &gt; ₹50,000)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tax summary */}
            <div style={{ ...S.card, background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.2)" }}>
              <div style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.9rem", color: "#C9A84C" }}>Tax Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", fontSize: "0.85rem" }}>
                {[
                  { label: "Taxable Value", value: fmtR(d.TaxableValue) },
                  { label: intraState ? "CGST" : "IGST", value: fmtR(intraState ? d.CGST : d.IGST) },
                  { label: intraState ? "SGST" : "—", value: intraState ? fmtR(d.SGST) : "—" },
                  { label: "Total Tax", value: fmtR(d.TotalTax) },
                  { label: "Grand Total", value: fmtR(d.GrandTotal), highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label}>
                    <div style={{ color: "#6B7280", fontSize: "0.72rem", marginBottom: "0.25rem" }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: highlight ? "#C9A84C" : "#E8EDF5", fontVariantNumeric: "tabular-nums" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button style={S.btnPrimary} onClick={generateIRN}>Generate IRN →</button>
              <button onClick={() => setTab("json")} style={{ ...S.btnPrimary, background: "#1F2937", color: "#E8EDF5" }}>View JSON</button>
            </div>
          </>
        )}

        {/* ── JSON VIEW ── */}
        {tab === "json" && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontWeight: 600 }}>IRP-ready JSON Payload</div>
                <div style={{ fontSize: "0.78rem", color: "#6B7280" }}>Send this to the Invoice Registration Portal (IRP) or your GSP.</div>
              </div>
              <button style={S.btnPrimary} onClick={() => copy(jsonStr)}>
                {copied ? "Copied!" : "Copy JSON"}
              </button>
            </div>
            <pre style={{ background: "#0A0D14", border: "1px solid #374151", borderRadius: 8, padding: "1rem", overflowX: "auto", fontSize: "0.75rem", color: "#34D399", lineHeight: 1.6, margin: 0 }}>
              {jsonStr}
            </pre>
          </div>
        )}

        {/* ── IRN RESULT ── */}
        {tab === "irn" && (
          generatedIRN ? (
            <div>
              <div style={{ ...S.card, background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✓</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#34D399" }}>IRN Generated Successfully</div>
                    <div style={{ fontSize: "0.78rem", color: "#6B7280" }}>Note: This is a demo IRN. Connect to NIC/GSTN IRP for production use.</div>
                  </div>
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={S.label}>Invoice Reference Number (IRN)</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <code style={{ flex: 1, background: "#0A0D14", border: "1px solid #374151", borderRadius: 6, padding: "0.6rem 0.9rem", fontSize: "0.78rem", color: "#34D399", wordBreak: "break-all" }}>{generatedIRN}</code>
                    <button style={{ ...S.btnPrimary, flexShrink: 0 }} onClick={() => copy(generatedIRN)}>{copied ? "Copied!" : "Copy"}</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.82rem" }}>
                  {[
                    { k: "Seller GSTIN", v: d.SellerGSTIN || "—" },
                    { k: "Buyer GSTIN", v: d.BuyerGSTIN || "—" },
                    { k: "Doc No.", v: d.DocNo },
                    { k: "Doc Date", v: d.DocDate },
                    { k: "Taxable Value", v: fmtR(d.TaxableValue) },
                    { k: "Grand Total", v: fmtR(d.GrandTotal) },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #1F2937" }}>
                      <span style={{ color: "#6B7280" }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...S.card, fontSize: "0.8rem", color: "#6B7280" }}>
                <strong style={{ color: "#F59E0B" }}>Production Integration:</strong> To get real IRNs, you need to:
                <ol style={{ margin: "0.5rem 0 0 1rem", lineHeight: 2 }}>
                  <li>Register on <strong>einvoice1.gst.gov.in</strong> (NIC IRP)</li>
                  <li>Or use a GSP (GSTN Suvidha Provider) like ClearTax, Tally, Zoho</li>
                  <li>Send the JSON above to their API with your credentials</li>
                  <li>They return a signed IRN + QR code to print on the invoice</li>
                </ol>
              </div>
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: "center", padding: "3rem", color: "#6B7280" }}>
              Fill the invoice details and click <strong style={{ color: "#C9A84C" }}>Generate IRN</strong> first.
            </div>
          )
        )}
      </div>
    </div>
  );
}
