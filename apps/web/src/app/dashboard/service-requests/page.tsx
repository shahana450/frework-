"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import { RefreshCw, Search, Phone, Mail, FileText, CheckCircle, Clock, XCircle, AlertCircle, Package, ExternalLink } from "lucide-react";

const ADMIN_EMAILS = ["admin.frework@gmail.com", "auditmanagercswa@gmail.com"];

const PACKAGES = [
  { key: "gst-registration",   label: "GST Registration",       price: "₹999",        color: "#059669" },
  { key: "gst-filing",         label: "GST Filing",             price: "₹499/filing",  color: "#2563EB" },
  { key: "accounting",         label: "Accounting & Bookkeeping",price: "₹1,499/mo",   color: "#D97706" },
  { key: "income-tax",         label: "Income Tax (ITR)",        price: "₹799",        color: "#7C3AED" },
  { key: "company-registration",label: "Company Registration",   price: "₹999",        color: "#DC2626" },
  { key: "gst-audit",          label: "GST Audit",               price: "₹4,999",      color: "#0891B2" },
  { key: "roc-compliance",     label: "ROC Compliance",          price: "₹1,999",      color: "#6366F1" },
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  docs_received: { label: "Docs Received",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  icon: Clock },
  under_review:  { label: "Under Review",   color: "#60A5FA", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  icon: AlertCircle },
  approved:      { label: "Approved",       color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  icon: CheckCircle },
  in_progress:   { label: "In Progress",    color: "#A78BFA", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)", icon: Package },
  completed:     { label: "Completed",      color: "#34D399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: CheckCircle },
  rejected:      { label: "Rejected",       color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", icon: XCircle },
};

interface ServiceRequest {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  user_phone: string;
  service_key: string;
  service_name: string;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  package_granted: string | null;
  package_granted_at: string | null;
}

export default function ServiceRequestsAdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // per-request editable state
  const [edits, setEdits] = useState<Record<string, { status: string; package_granted: string; admin_notes: string }>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      if (!ADMIN_EMAILS.includes(data.user.email ?? "")) { router.push("/dashboard"); return; }
      setIsAdmin(true);
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fw_service_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = data ?? [];
    setRequests(rows);
    // Seed edits map with current values
    const map: typeof edits = {};
    rows.forEach(r => {
      map[r.id] = { status: r.status, package_granted: r.package_granted ?? "", admin_notes: r.admin_notes ?? "" };
    });
    setEdits(map);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const setEdit = (id: string, key: string, val: string) =>
    setEdits(e => ({ ...e, [id]: { ...e[id], [key]: val } }));

  const saveRequest = async (req: ServiceRequest) => {
    setSaving(req.id);
    const edit = edits[req.id];
    await supabase.from("fw_service_requests").update({
      status: edit.status,
      admin_notes: edit.admin_notes,
      package_granted: edit.package_granted || null,
      package_granted_at: edit.package_granted && !req.package_granted ? new Date().toISOString() : req.package_granted_at,
    }).eq("id", req.id);
    setSaving(null);
    load();
  };

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search || r.user_email?.toLowerCase().includes(q) || r.user_phone?.includes(q) || r.service_name?.toLowerCase().includes(q) || r.id.includes(q);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: requests.length,
    docs_received: requests.filter(r => r.status === "docs_received").length,
    under_review: requests.filter(r => r.status === "under_review").length,
    approved: requests.filter(r => r.status === "approved").length,
    in_progress: requests.filter(r => r.status === "in_progress").length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  if (!isAdmin && !loading) return null;

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard"><FreWorkLogo size={28} /></Link>
            <span style={{ color: "#4A5A72" }}>/</span>
            <Link href="/dashboard" className="text-xs font-semibold" style={{ color: "#8A9BB8" }}>Admin</Link>
            <span style={{ color: "#4A5A72" }}>/</span>
            <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Service Requests</span>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: "#8A9BB8" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#EDE8DC" }}>Service Requests</h1>
        <p className="text-sm mb-8" style={{ color: "#8A9BB8" }}>Review uploaded documents and grant service packages to users.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {[
            { key: "all",          label: "Total",       color: "#C9A84C" },
            { key: "docs_received",label: "New",         color: "#F59E0B" },
            { key: "under_review", label: "Reviewing",   color: "#60A5FA" },
            { key: "approved",     label: "Approved",    color: "#10B981" },
            { key: "in_progress",  label: "In Progress", color: "#A78BFA" },
            { key: "completed",    label: "Completed",   color: "#34D399" },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className="rounded-2xl border p-3 text-center transition-all hover:opacity-90"
              style={{
                background: filterStatus === s.key ? `${s.color}18` : "#0C1428",
                borderColor: filterStatus === s.key ? `${s.color}50` : "rgba(201,168,76,0.1)",
              }}>
              <p className="text-lg font-black" style={{ color: s.color }}>{counts[s.key as keyof typeof counts] ?? 0}</p>
              <p className="text-[10px] font-bold" style={{ color: "#4A5A72" }}>{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-6"
          style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.12)" }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#4A5A72" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, phone, service..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#EDE8DC" }} />
        </div>

        {/* Requests list */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <p className="text-3xl mb-3">📭</p>
            <p className="font-bold text-sm" style={{ color: "#8A9BB8" }}>No requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => {
              const st = STATUS_CFG[req.status] ?? STATUS_CFG.docs_received;
              const StIcon = st.icon;
              const edit = edits[req.id] ?? { status: req.status, package_granted: "", admin_notes: "" };
              const pkg = PACKAGES.find(p => p.key === req.package_granted);
              const isOpen = expanded === req.id;
              const date = new Date(req.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

              return (
                <div key={req.id} className="rounded-2xl border overflow-hidden transition-all"
                  style={{ background: "#0C1428", borderColor: req.status === "docs_received" ? "rgba(245,158,11,0.3)" : "rgba(201,168,76,0.1)" }}>
                  <div className="h-[2px]" style={{ background: `linear-gradient(90deg,${st.color},transparent)` }} />

                  {/* Summary row — click to expand */}
                  <button className="w-full p-5 text-left" onClick={() => setExpanded(isOpen ? null : req.id)}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-sm" style={{ color: "#EDE8DC" }}>{req.user_email}</span>
                          <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            <StIcon className="w-2.5 h-2.5" />{st.label}
                          </span>
                          {req.package_granted && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                              ✅ Package Granted
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold mb-1" style={{ color: "#F59E0B" }}>{req.service_name}</p>
                        <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#4A5A72" }}>
                          {req.user_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{req.user_phone}</span>}
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{req.user_email}</span>
                          <span>{date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {pkg && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                            style={{ background: `${pkg.color}15`, color: pkg.color, border: `1px solid ${pkg.color}30` }}>
                            {pkg.label}
                          </span>
                        )}
                        <span className="text-xs font-bold" style={{ color: "#4A5A72" }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="border-t px-5 pb-6 pt-5 space-y-5" style={{ borderColor: "rgba(255,255,255,0.05)" }}>

                      {/* User notes */}
                      {req.notes && (
                        <div className="p-3 rounded-xl text-xs italic" style={{ background: "rgba(255,255,255,0.03)", color: "#8A9BB8", border: "1px solid rgba(255,255,255,0.06)" }}>
                          User note: "{req.notes}"
                        </div>
                      )}

                      {/* Uploaded docs link */}
                      <div className="flex items-center gap-2 p-3 rounded-xl border"
                        style={{ background: "rgba(201,168,76,0.05)", borderColor: "rgba(201,168,76,0.15)" }}>
                        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#C9A84C" }} />
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>Uploaded Documents</p>
                          <p className="text-[11px]" style={{ color: "#4A5A72" }}>View files in Supabase Storage → fw-documents → service-docs/{req.id}</p>
                        </div>
                        <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/fw-documents/service-docs/${req.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                          style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}>
                          <ExternalLink className="w-3 h-3" /> Open
                        </a>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Status */}
                        <div>
                          <label className="block text-xs font-black tracking-widest uppercase mb-2" style={{ color: "#8A9BB8" }}>Update Status</label>
                          <select value={edit.status}
                            onChange={e => setEdit(req.id, "status", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                            style={{ background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC", appearance: "none" }}>
                            {Object.entries(STATUS_CFG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grant Package */}
                        <div>
                          <label className="block text-xs font-black tracking-widest uppercase mb-2" style={{ color: "#8A9BB8" }}>Grant Service Package</label>
                          <select value={edit.package_granted}
                            onChange={e => setEdit(req.id, "package_granted", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                            style={{ background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC", appearance: "none" }}>
                            <option value="">— No package granted —</option>
                            {PACKAGES.map(p => (
                              <option key={p.key} value={p.key}>{p.label} ({p.price})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Admin notes */}
                      <div>
                        <label className="block text-xs font-black tracking-widest uppercase mb-2" style={{ color: "#8A9BB8" }}>Admin Notes (internal)</label>
                        <textarea value={edit.admin_notes}
                          onChange={e => setEdit(req.id, "admin_notes", e.target.value)}
                          rows={2} placeholder="Notes for internal reference..."
                          className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                          style={{ background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC", resize: "none" }} />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button onClick={() => saveRequest(req)} disabled={saving === req.id}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                          {saving === req.id ? "Saving..." : "✓ Save Changes"}
                        </button>

                        {req.user_phone && (
                          <a href={`https://wa.me/${req.user_phone.replace(/\D/g, "")}?text=Hi%2C%20your%20${encodeURIComponent(req.service_name)}%20request%20has%20been%20received%20by%20FreWork.%20Our%20CA%20will%20contact%20you%20shortly.`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                            style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp User
                          </a>
                        )}

                        <a href={`mailto:${req.user_email}?subject=Your ${req.service_name} Request - FreWork&body=Hi,%0A%0AYour request for ${req.service_name} has been received. Our CA will contact you shortly.%0A%0ARegards,%0AFreWork Team`}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                          style={{ background: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>
                          ✉ Email User
                        </a>
                      </div>

                      {req.package_granted && req.package_granted_at && (
                        <p className="text-xs" style={{ color: "#10B981" }}>
                          ✅ Package "{PACKAGES.find(p => p.key === req.package_granted)?.label}" granted on {new Date(req.package_granted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
