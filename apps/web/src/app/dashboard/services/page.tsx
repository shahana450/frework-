"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import {
  Upload, FileText, MessageSquare, CheckCircle, Clock,
  AlertCircle, Package, XCircle, ChevronRight, Plus,
  Phone, Mail, ArrowRight, RefreshCw, LogOut,
} from "lucide-react";

/* ── Types ── */
interface ServiceRequest {
  id: string;
  created_at: string;
  service_key: string;
  service_name: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  package_granted: string | null;
  package_granted_at: string | null;
}

/* ── Status config ── */
const STATUS_STEPS = [
  { key: "docs_received", label: "Docs Received",  icon: Upload },
  { key: "under_review",  label: "Under Review",   icon: AlertCircle },
  { key: "approved",      label: "Approved",       icon: CheckCircle },
  { key: "in_progress",   label: "In Progress",    icon: Package },
  { key: "completed",     label: "Completed",      icon: CheckCircle },
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  docs_received: { label: "Docs Received", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  under_review:  { label: "Under Review",  color: "#60A5FA", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)"  },
  approved:      { label: "Approved",      color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
  in_progress:   { label: "In Progress",   color: "#A78BFA", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  completed:     { label: "Completed",     color: "#34D399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)"  },
  rejected:      { label: "Rejected",      color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
};

const SERVICE_COLORS: Record<string, string> = {
  "gst-registration":   "#059669",
  "gst-filing":         "#2563EB",
  "accounting":         "#D97706",
  "income-tax":         "#7C3AED",
  "company-registration": "#DC2626",
  "gst-audit":          "#0891B2",
  "roc-compliance":     "#6366F1",
};

const TABS = ["My Services", "Upload Docs", "Queries"] as const;
type Tab = typeof TABS[number];

/* ── FAQ / queries content ── */
const FAQS = [
  { q: "How long does GST Registration take?", a: "Typically 3–5 working days after document submission. You'll receive your GSTIN via email." },
  { q: "Can I track my filing status?", a: "Yes — once your CA files your return, the status updates to 'Completed' here and you receive confirmation by email." },
  { q: "What happens after I upload documents?", a: "Our CA reviews within 24 hours, may request additional docs if needed, then processes your service and updates the status." },
  { q: "How do I get my balance sheet or P&L?", a: "Once accounting is done (status: Completed), your CA will share the reports via WhatsApp or email." },
  { q: "Is my data secure?", a: "All documents are stored in encrypted private storage and accessed only by our CA team." },
];

export default function ServicesDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("My Services");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [querySent, setQuerySent] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("fw_service_requests")
      .select("id, created_at, service_key, service_name, status, notes, admin_notes, package_granted, package_granted_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const u = data.user;
      setUserId(u.id);
      setUserEmail(u.email ?? "");
      setUserName(u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "there");
      load(u.id);
    });
  }, [router, load]);

  /* ── Status step index ── */
  const stepIndex = (status: string) => STATUS_STEPS.findIndex(s => s.key === status);

  /* ── Send WhatsApp query ── */
  const sendQuery = () => {
    if (!queryText.trim()) return;
    const msg = encodeURIComponent(`Hi FreWork CA Team,\n\nI have a query:\n\n${queryText}\n\n— ${userName} (${userEmail})`);
    window.open(`https://wa.me/918590874681?text=${msg}`, "_blank");
    setQuerySent(true);
    setQueryText("");
  };

  /* ── Switch purpose ── */
  const switchPurpose = () => {
    if (userId) localStorage.removeItem(`fw_purpose_${userId}`);
    router.push("/dashboard");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>

      {/* ── Header ── */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><FreWorkLogo size={28} /></Link>
            <div>
              <p className="text-xs font-black" style={{ color: "#EDE8DC" }}>My Services</p>
              <p className="text-[10px]" style={{ color: "#4A5A72" }}>{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={switchPurpose}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: "rgba(201,168,76,0.2)", color: "#8A9BB8", background: "transparent" }}>
              Switch
            </button>
            <button onClick={signOut}
              className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: "rgba(248,113,113,0.2)", color: "#F87171", background: "transparent" }}>
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Welcome ── */}
        <div className="mb-8 rounded-2xl p-6 border" style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.1),rgba(37,99,235,0.07))", borderColor: "rgba(201,168,76,0.2)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#8A9BB8" }}>Welcome back,</p>
              <h1 className="text-xl font-black" style={{ color: "#EDE8DC" }}>{userName} 👋</h1>
              <p className="text-xs mt-1" style={{ color: "#8A9BB8" }}>Your CA team handles everything — upload docs and relax.</p>
            </div>
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: "#C9A84C" }}>{requests.length}</p>
                <p className="text-[10px]" style={{ color: "#4A5A72" }}>Requests</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: "#34D399" }}>{requests.filter(r => r.status === "completed").length}</p>
                <p className="text-[10px]" style={{ color: "#4A5A72" }}>Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: "#60A5FA" }}>{requests.filter(r => !["completed","rejected"].includes(r.status)).length}</p>
                <p className="text-[10px]" style={{ color: "#4A5A72" }}>Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b mb-8" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3 text-sm font-bold transition-all relative"
              style={{ color: tab === t ? "#C9A84C" : "#4A5A72" }}>
              {t}
              {tab === t && (
                <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-t" style={{ background: "#C9A84C" }} />
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
            TAB: My Services
        ══════════════════════════════ */}
        {tab === "My Services" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-base" style={{ color: "#EDE8DC" }}>Service Requests</h2>
              <div className="flex gap-2">
                <button onClick={() => userId && load(userId)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-70"
                  style={{ borderColor: "rgba(201,168,76,0.15)", color: "#8A9BB8" }}>
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
                <button onClick={() => setTab("Upload Docs")}
                  className="flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-lg transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                  <Plus className="w-3 h-3" /> New Request
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
              </div>
            ) : requests.length === 0 ? (
              /* Empty state */
              <div className="text-center py-16 rounded-2xl border" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                <p className="text-4xl mb-4">📂</p>
                <p className="font-black text-base mb-2" style={{ color: "#EDE8DC" }}>No service requests yet</p>
                <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: "#8A9BB8" }}>
                  Upload your documents and our CA team will handle GST, ITR, accounting and more.
                </p>
                <button onClick={() => setTab("Upload Docs")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                  <Upload className="w-4 h-4" /> Upload Documents
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map(req => {
                  const st = STATUS_CFG[req.status] ?? STATUS_CFG.docs_received;
                  const svcColor = SERVICE_COLORS[req.service_key] ?? "#C9A84C";
                  const curStep = stepIndex(req.status);
                  const isOpen = expanded === req.id;
                  const date = new Date(req.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

                  return (
                    <div key={req.id} className="rounded-2xl border overflow-hidden"
                      style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                      {/* colour top bar */}
                      <div className="h-[3px]" style={{ background: svcColor }} />

                      {/* Summary row */}
                      <button className="w-full p-5 text-left" onClick={() => setExpanded(isOpen ? null : req.id)}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-black text-sm" style={{ color: "#EDE8DC" }}>{req.service_name}</span>
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                {st.label}
                              </span>
                              {req.package_granted && (
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                                  ✅ Package Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "#4A5A72" }}>Submitted {date}</p>
                          </div>
                          <span className="text-xs font-bold flex-shrink-0 mt-1" style={{ color: "#4A5A72" }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {/* Expanded: status timeline + details */}
                      {isOpen && (
                        <div className="border-t px-5 pb-6 pt-5 space-y-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>

                          {/* Progress timeline */}
                          {req.status !== "rejected" && (
                            <div>
                              <p className="text-[11px] font-black tracking-widest uppercase mb-4" style={{ color: "#4A5A72" }}>Progress</p>
                              <div className="relative">
                                {/* Connector line */}
                                <div className="absolute top-4 left-4 right-4 h-[2px]" style={{ background: "rgba(255,255,255,0.06)" }} />
                                <div className="absolute top-4 left-4 h-[2px] transition-all duration-700"
                                  style={{ background: "#C9A84C", width: `${Math.max(0, curStep) * (100 / (STATUS_STEPS.length - 1))}%`, right: "auto" }} />
                                <div className="relative flex justify-between">
                                  {STATUS_STEPS.map((step, i) => {
                                    const done = i <= curStep;
                                    const active = i === curStep;
                                    const StepIcon = step.icon;
                                    return (
                                      <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 transition-all"
                                          style={{
                                            background: done ? "#C9A84C" : "#0C1428",
                                            borderColor: done ? "#C9A84C" : "rgba(255,255,255,0.1)",
                                            boxShadow: active ? "0 0 16px rgba(201,168,76,0.6)" : "none",
                                          }}>
                                          <StepIcon className="w-3.5 h-3.5" style={{ color: done ? "#070C1A" : "#4A5A72" }} />
                                        </div>
                                        <p className="text-[9px] font-bold text-center leading-tight"
                                          style={{ color: done ? "#C9A84C" : "#4A5A72" }}>
                                          {step.label}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {req.status === "rejected" && (
                            <div className="p-4 rounded-xl border text-sm" style={{ background: "rgba(248,113,113,0.06)", borderColor: "rgba(248,113,113,0.2)", color: "#F87171" }}>
                              ❌ This request was not accepted. Please contact our team for details.
                            </div>
                          )}

                          {/* Admin message */}
                          {req.admin_notes && (
                            <div className="p-4 rounded-xl border" style={{ background: "rgba(201,168,76,0.06)", borderColor: "rgba(201,168,76,0.15)" }}>
                              <p className="text-[11px] font-black tracking-widest uppercase mb-1" style={{ color: "#C9A84C" }}>Message from CA</p>
                              <p className="text-sm leading-relaxed" style={{ color: "#EDE8DC" }}>{req.admin_notes}</p>
                            </div>
                          )}

                          {/* User notes */}
                          {req.notes && (
                            <div className="text-xs italic px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "#8A9BB8" }}>
                              Your note: "{req.notes}"
                            </div>
                          )}

                          {/* Package active */}
                          {req.package_granted && req.package_granted_at && (
                            <div className="p-4 rounded-xl border flex items-center gap-3"
                              style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#10B981" }} />
                              <div>
                                <p className="font-black text-sm" style={{ color: "#10B981" }}>Service Package Active</p>
                                <p className="text-xs" style={{ color: "#4A5A72" }}>
                                  Granted on {new Date(req.package_granted_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Contact CA */}
                          <div className="flex gap-3">
                            <a href={`https://wa.me/918590874681?text=Hi%20FreWork%20CA%2C%20I%20have%20a%20query%20about%20my%20${encodeURIComponent(req.service_name)}%20request%20(ID%3A%20${req.id.slice(0,8)})%20`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                              style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Chat with CA
                            </a>
                            <a href={`mailto:admin.frework@gmail.com?subject=Query: ${req.service_name}&body=Hi CA Team,%0A%0AMy request ID: ${req.id}%0AService: ${req.service_name}%0A%0AQuery: `}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                              style={{ background: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>
                              <Mail className="w-3.5 h-3.5" /> Email CA
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* New request CTA */}
                <button onClick={() => setTab("Upload Docs")}
                  className="w-full py-4 rounded-2xl border-2 border-dashed text-sm font-bold transition-all hover:opacity-80 flex items-center justify-center gap-2"
                  style={{ borderColor: "rgba(201,168,76,0.2)", color: "#8A9BB8" }}>
                  <Plus className="w-4 h-4" /> Add Another Service Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: Upload Docs
        ══════════════════════════════ */}
        {tab === "Upload Docs" && (
          <div>
            <div className="mb-6">
              <h2 className="font-black text-base mb-1" style={{ color: "#EDE8DC" }}>Upload Documents</h2>
              <p className="text-sm" style={{ color: "#8A9BB8" }}>Select a service and upload the required documents. Our CA will process within 24 hours.</p>
            </div>

            {/* Service cards to pick */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {[
                { key: "gst-registration",    label: "GST Registration",        price: "₹999",          icon: "🏛️", color: "#059669" },
                { key: "gst-filing",          label: "GST Filing",              price: "₹499/filing",   icon: "📋", color: "#2563EB" },
                { key: "accounting",          label: "Accounting & Bookkeeping", price: "₹1,499/month",  icon: "📊", color: "#D97706" },
                { key: "income-tax",          label: "Income Tax (ITR)",         price: "₹799",          icon: "💰", color: "#7C3AED" },
                { key: "company-registration",label: "Company Registration",     price: "₹999",          icon: "🏢", color: "#DC2626" },
                { key: "gst-audit",           label: "GST Audit",                price: "₹4,999",        icon: "🔍", color: "#0891B2" },
              ].map(svc => (
                <Link key={svc.key} href={`/dashboard/docs-upload?service=${svc.key}`}
                  className="flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02]"
                  style={{ background: "#0C1428", borderColor: `${svc.color}25` }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${svc.color}18`, border: `1.5px solid ${svc.color}30` }}>
                    {svc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm" style={{ color: "#EDE8DC" }}>{svc.label}</p>
                    <p className="text-xs font-bold" style={{ color: svc.color }}>{svc.price}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#4A5A72" }} />
                </Link>
              ))}
            </div>

            <p className="text-xs text-center" style={{ color: "#4A5A72" }}>
              Not sure which service you need?{" "}
              <button onClick={() => setTab("Queries")} className="underline hover:opacity-80" style={{ color: "#C9A84C" }}>
                Ask our CA →
              </button>
            </p>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: Queries
        ══════════════════════════════ */}
        {tab === "Queries" && (
          <div className="space-y-8">

            {/* Chat with CA */}
            <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
              <h2 className="font-black text-base mb-1" style={{ color: "#EDE8DC" }}>Ask Our CA Team</h2>
              <p className="text-sm mb-5" style={{ color: "#8A9BB8" }}>We typically respond within 2 hours on WhatsApp.</p>

              <textarea
                value={queryText}
                onChange={e => { setQueryText(e.target.value); setQuerySent(false); }}
                placeholder="Type your query here... e.g. 'Do I need GST registration if my turnover is ₹30L?' or 'What documents do I need for ITR filing?'"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none mb-4"
                style={{ background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC", resize: "none" }}
              />

              {querySent ? (
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "#10B981" }}>
                  <CheckCircle className="w-4 h-4" /> Query sent! We'll respond on WhatsApp shortly.
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button onClick={sendQuery}
                    disabled={!queryText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "rgba(37,211,102,0.15)", color: "#25D366", border: "1px solid rgba(37,211,102,0.3)" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Send via WhatsApp
                  </button>
                  <a href="mailto:admin.frework@gmail.com?subject=CA Query&body=Hi FreWork CA Team,"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>
                    <Mail className="w-4 h-4" /> Send via Email
                  </a>
                </div>
              )}
            </div>

            {/* Direct contact */}
            <div className="grid sm:grid-cols-2 gap-4">
              <a href="https://wa.me/918590874681" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 rounded-2xl border transition-all hover:scale-[1.02]"
                style={{ background: "#0C1428", borderColor: "rgba(37,211,102,0.2)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)" }}>
                  <Phone className="w-5 h-5" style={{ color: "#25D366" }} />
                </div>
                <div>
                  <p className="font-black text-sm" style={{ color: "#EDE8DC" }}>WhatsApp</p>
                  <p className="text-xs" style={{ color: "#25D366" }}>+91 85908 74681</p>
                  <p className="text-[11px]" style={{ color: "#4A5A72" }}>Mon–Sat, 9 AM–7 PM</p>
                </div>
              </a>
              <a href="mailto:admin.frework@gmail.com"
                className="flex items-center gap-4 p-5 rounded-2xl border transition-all hover:scale-[1.02]"
                style={{ background: "#0C1428", borderColor: "rgba(96,165,250,0.2)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}>
                  <Mail className="w-5 h-5" style={{ color: "#60A5FA" }} />
                </div>
                <div>
                  <p className="font-black text-sm" style={{ color: "#EDE8DC" }}>Email</p>
                  <p className="text-xs" style={{ color: "#60A5FA" }}>admin.frework@gmail.com</p>
                  <p className="text-[11px]" style={{ color: "#4A5A72" }}>Reply within 4 hours</p>
                </div>
              </a>
            </div>

            {/* FAQs */}
            <div>
              <h3 className="font-black text-sm mb-4" style={{ color: "#8A9BB8" }}>Frequently Asked Questions</h3>
              <div className="space-y-3">
                {FAQS.map((faq, i) => (
                  <details key={i} className="rounded-xl border group"
                    style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                    <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-bold list-none"
                      style={{ color: "#EDE8DC" }}>
                      {faq.q}
                      <ChevronRight className="w-4 h-4 flex-shrink-0 ml-2 transition-transform group-open:rotate-90" style={{ color: "#4A5A72" }} />
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "#8A9BB8" }}>{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
