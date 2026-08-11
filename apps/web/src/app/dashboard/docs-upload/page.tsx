"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import { supabase } from "@/lib/supabase";
import { Upload, X, FileText, CheckCircle, ChevronDown } from "lucide-react";

const SERVICES = {
  "gst-registration": {
    label: "GST Registration",
    color: "#059669",
    icon: "🏛️",
    price: "₹999",
    desc: "Get your GSTIN in 3–5 working days",
    docs: [
      { id: "pan", label: "PAN Card / Incorporation Certificate", required: true, hint: "Owner / Director PAN or Company Incorporation Certificate" },
      { id: "aadhaar", label: "Aadhaar Card", required: true, hint: "Owner / Authorised Signatory" },
      { id: "photo", label: "Passport Size Photo", required: true, hint: "Owner / Director" },
      { id: "bank", label: "Cancelled Cheque / Bank Statement", required: false, hint: "Business bank account (optional)" },
      { id: "address_proof", label: "Business Address Proof", required: true, hint: "Electricity bill / Rent agreement / NOC" },
      { id: "building_tax", label: "Building Tax Copy / Ownership Certificate", required: true, hint: "Property tax receipt or ownership document for business premises" },
      { id: "moa", label: "MOA / Partnership Deed", required: false, hint: "If company / partnership (optional for proprietorship)" },
    ],
  },
  "gst-filing": {
    label: "GST Filing",
    color: "#2563EB",
    icon: "📋",
    price: "₹499/filing",
    desc: "GSTR-1, GSTR-3B, Annual Return",
    docs: [
      { id: "gstin", label: "GSTIN Certificate", required: true, hint: "Your existing GST certificate" },
      { id: "sales", label: "Sales Register / Invoices", required: true, hint: "All sales invoices for the period" },
      { id: "purchase", label: "Purchase Register / Bills", required: true, hint: "All purchase bills for the period" },
      { id: "bank_stmt", label: "Bank Statement", required: true, hint: "For the filing period" },
      { id: "prev_return", label: "Previous Return (optional)", required: false, hint: "Last filed GSTR-3B for reference" },
    ],
  },
  "accounting": {
    label: "Accounting & Bookkeeping",
    color: "#D97706",
    icon: "📊",
    price: "₹1,499/month",
    desc: "Monthly books, P&L, Balance Sheet",
    docs: [
      { id: "bank_stmt", label: "Bank Statements", required: true, hint: "All business bank accounts — last 3 months" },
      { id: "invoices", label: "Sales Invoices / Bills", required: true, hint: "All customer invoices" },
      { id: "expenses", label: "Expense Bills / Receipts", required: true, hint: "All business expenses" },
      { id: "prev_books", label: "Previous Books / Trial Balance", required: false, hint: "Tally / Excel — if available" },
      { id: "payroll", label: "Payroll Details", required: false, hint: "Salary slips or payroll register" },
    ],
  },
  "income-tax": {
    label: "Income Tax Return (ITR)",
    color: "#7C3AED",
    icon: "💰",
    price: "₹799",
    desc: "ITR-1 to ITR-6 for all business types",
    docs: [
      { id: "pan", label: "PAN Card", required: true, hint: "Assessee PAN" },
      { id: "form16", label: "Form 16 / Salary Certificate", required: false, hint: "From employer — if salaried" },
      { id: "bank_stmt", label: "Bank Statements", required: true, hint: "All accounts — full financial year" },
      { id: "p26as", label: "Form 26AS / AIS", required: true, hint: "Download from income tax portal" },
      { id: "investments", label: "Investment Proofs (80C etc.)", required: false, hint: "LIC, PPF, ELSS, housing loan etc." },
      { id: "business_income", label: "Business Income Details", required: false, hint: "P&L / turnover — if business income" },
    ],
  },
  "company-registration": {
    label: "Company Registration",
    color: "#DC2626",
    icon: "🏢",
    price: "₹999",
    desc: "Pvt Ltd, LLP, OPC, Proprietorship",
    docs: [
      { id: "pan", label: "PAN Card (all directors)", required: true, hint: "PAN of each director / partner" },
      { id: "aadhaar", label: "Aadhaar Card (all directors)", required: true, hint: "Aadhaar of each director / partner" },
      { id: "photo", label: "Passport Photos (all directors)", required: true, hint: "Recent passport size" },
      { id: "address_proof_dir", label: "Address Proof (directors)", required: true, hint: "Electricity bill / bank statement" },
      { id: "office_proof", label: "Office Address Proof", required: true, hint: "Rent agreement / ownership deed / NOC" },
      { id: "noc", label: "NOC from Property Owner", required: false, hint: "If rented office space" },
    ],
  },
};

interface UploadedFile { name: string; size: number; file: File; docId: string; }
interface UserInfo { id: string; name: string; email: string; }

function DocsUploadInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialService = params.get("service") || "gst-registration";

  const [user, setUser] = useState(null as UserInfo | null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedService, setSelectedService] = useState(initialService);
  const [uploads, setUploads] = useState([] as UploadedFile[]);
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileRefs = useRef({} as Record<string, HTMLInputElement | null>);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace("/login?next=/dashboard/docs-upload"); return; }
      const u = session.user;
      setUser({ id: u.id, name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User", email: u.email ?? "" });
      setAuthChecked(true);
    });
  }, [router]);

  const service = (SERVICES as any)[selectedService] ?? SERVICES["gst-registration"];

  const handleFile = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("File too large — max 10 MB per file"); return; }
    setUploads(prev => [...prev.filter(u => u.docId !== docId), { name: f.name, size: f.size, file: f, docId }]);
    setError("");
  };

  const removeFile = (docId: string) => {
    setUploads(prev => prev.filter(u => u.docId !== docId));
    if (fileRefs.current[docId]) fileRefs.current[docId]!.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const missing = service.docs.filter((d: any) => d.required && !uploads.find(u => u.docId === d.id));
    if (missing.length > 0) { setError("Please upload: " + missing.map((d: any) => d.label).join(", ")); return; }
    if (!phone) { setError("Please enter your phone number"); return; }
    setSubmitting(true);
    try {
      // Insert service request record
      const { data: req, error: reqErr } = await supabase.from("fw_service_requests").insert({
        user_id: user!.id,
        user_email: user!.email,
        user_phone: phone,
        service_key: selectedService,
        service_name: service.label,
        notes,
        status: "docs_received",
      }).select("id").single();

      if (reqErr) {
        // Surface the real Supabase error so it's diagnosable
        throw new Error(reqErr.message || reqErr.code || "Database insert failed");
      }

      // Upload files — non-fatal: request is saved even if storage fails
      for (const upload of uploads) {
        const path = `service-docs/${req.id}/${upload.docId}-${upload.name}`;
        const { error: storageErr } = await supabase.storage
          .from("fw-documents")
          .upload(path, upload.file, { upsert: true });
        if (storageErr) {
          // Log but don't block submission — CA can follow up for missing files
          console.warn("Storage upload failed for", upload.docId, storageErr.message);
        }
      }

      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Show the real error so the user/admin can diagnose
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#070C1A" }}>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.3)" }}>
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-black mb-2" style={{ color: "#EDE8DC" }}>Documents Submitted!</h2>
        <p className="text-sm mb-2" style={{ color: "#8A9BB8" }}>Our CA will review your documents for <strong style={{ color: "#C9A84C" }}>{service.label}</strong> and call you within <strong style={{ color: "#C9A84C" }}>24 hours</strong>.</p>
        <p className="text-xs mb-8" style={{ color: "#4A5A72" }}>We will contact you on <strong style={{ color: "#EDE8DC" }}>{phone}</strong></p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="px-6 py-3 rounded-xl text-sm font-bold text-white text-center" style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)" }}>Back to Dashboard</Link>
          <a href={"https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20submitted%20documents%20for%20" + encodeURIComponent(service.label) + ".%20My%20number%20is%20" + phone + "."}
            target="_blank" rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl text-sm font-bold text-white text-center"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>WhatsApp Us</a>
        </div>
      </div>
    </div>
  );

  const inp = "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all";
  const inpStyle = { background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC" };

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2"><FreWorkLogo size={28} /><span className="font-bold text-sm" style={{ color: "#EDE8DC" }}>FreWork</span></Link>
          <div className="flex items-center gap-2">
            {user && <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>{user.name[0]?.toUpperCase()}</div>}
            <Link href="/dashboard" className="text-xs font-semibold" style={{ color: "rgba(201,168,76,0.6)" }}>← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "#4A5A72" }}>Document Upload</p>
          <h1 className="text-2xl font-black mb-1" style={{ color: "#EDE8DC" }}>Submit Documents</h1>
          <p className="text-sm" style={{ color: "#8A9BB8" }}>Upload your documents. Our CA will review and call you within 24 hours.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border p-5" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.12)" }}>
            <label className="block text-xs font-black tracking-widest uppercase mb-3" style={{ color: "#C9A84C" }}>Select Service *</label>
            <div className="relative">
              <select value={selectedService} onChange={e => { setSelectedService(e.target.value); setUploads([]); }}
                className={inp} style={{ ...inpStyle, appearance: "none", paddingRight: "2.5rem" }}>
                {Object.entries(SERVICES).map(([key, svc]) => (
                  <option key={key} value={key}>{svc.icon} {svc.label} — {svc.price}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#4A5A72" }} />
            </div>
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border"
              style={{ background: service.color + "0D", borderColor: service.color + "30" }}>
              <span className="text-2xl">{service.icon}</span>
              <div className="flex-1"><p className="text-sm font-black" style={{ color: service.color }}>{service.label}</p><p className="text-xs" style={{ color: "#8A9BB8" }}>{service.desc}</p></div>
              <span className="text-sm font-black" style={{ color: service.color }}>{service.price}</span>
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.12)" }}>
            <label className="block text-xs font-black tracking-widest uppercase mb-4" style={{ color: "#C9A84C" }}>Required Documents</label>
            <div className="space-y-3">
              {service.docs.map((doc: any) => {
                const uploaded = uploads.find(u => u.docId === doc.id);
                return (
                  <div key={doc.id} className="rounded-xl border transition-all"
                    style={{ background: uploaded ? "rgba(16,185,129,0.05)" : "#101D35", borderColor: uploaded ? "rgba(16,185,129,0.3)" : "rgba(201,168,76,0.1)" }}>
                    <div className="flex items-center gap-3 p-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: uploaded ? "rgba(16,185,129,0.12)" : "rgba(201,168,76,0.07)", border: "1px solid " + (uploaded ? "rgba(16,185,129,0.25)" : "rgba(201,168,76,0.15)") }}>
                        {uploaded ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4" style={{ color: "#C9A84C" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: "#EDE8DC" }}>{doc.label}</span>
                          {doc.required
                            ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#F87171" }}>REQUIRED</span>
                            : <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(148,163,184,0.1)", color: "#64748B" }}>OPTIONAL</span>}
                        </div>
                        {uploaded
                          ? <p className="text-xs mt-0.5 truncate" style={{ color: "#10B981" }}>✓ {uploaded.name} ({(uploaded.size / 1024).toFixed(0)} KB)</p>
                          : <p className="text-xs mt-0.5" style={{ color: "#4A5A72" }}>{doc.hint}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {uploaded ? (
                          <button type="button" onClick={() => removeFile(doc.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: "#F87171" }}><X className="w-4 h-4" /></button>
                        ) : (
                          <button type="button" onClick={() => fileRefs.current[doc.id]?.click()}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-80"
                            style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}>
                            <Upload className="w-3 h-3" /> Upload
                          </button>
                        )}
                        <input ref={el => { fileRefs.current[doc.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={e => handleFile(doc.id, e)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-3" style={{ color: "#4A5A72" }}>Accepted: PDF, JPG, PNG, Word · Max 10 MB per file</p>
          </div>

          <div className="rounded-2xl border p-5" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.12)" }}>
            <label className="block text-xs font-black tracking-widest uppercase mb-4" style={{ color: "#C9A84C" }}>Contact Details</label>
            <div className="space-y-3">
              <div><label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Email</label><input className={inp} style={{ ...inpStyle, opacity: 0.6 }} value={user?.email ?? ""} disabled /></div>
              <div><label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Phone / WhatsApp *</label><input className={inp} style={inpStyle} type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div><label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Notes (optional)</label><textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={3} placeholder="Any specific requirements or questions for our CA..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>

          {error && <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#F87171" }}>{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full py-4 rounded-2xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff", boxShadow: "0 4px 20px rgba(201,168,76,0.35)" }}>
            {submitting ? "Submitting..." : "Submit Documents for " + service.label}
          </button>
          <p className="text-xs text-center" style={{ color: "#4A5A72" }}>Our CA calls within 24 hours · Starting at {service.price}</p>
        </form>
      </div>
    </div>
  );
}

export default function DocsUploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} /></div>}>
      <DocsUploadInner />
    </Suspense>
  );
}
