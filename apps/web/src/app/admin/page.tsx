"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, Smartphone, Globe, Download, Search, RefreshCw, Trash2, Shield, FileText, CheckCircle, XCircle, Crown, Phone, Tag, Briefcase, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface FwUser {
  id: string;
  name?: string;
  email: string;
  mobile?: string;
  method: "google" | "email";
  created_at: string;
}

interface FwEnquiry {
  id: string;
  name: string;
  email?: string;
  mobile: string;
  service?: string;
  message?: string;
  created_at: string;
}

interface Listing {
  id: string;
  kind: "workspace" | "freelancer" | "service" | "startup";
  name: string;
  city?: string;
  status: string;
  created_at: string;
  user_id: string;
}

interface FwLead {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  service?: string;
  source?: string;
  utm_campaign?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface FwSubscription {
  id: string;
  user_id: string;
  plan: string;
  billing: string;
  amount: number;
  status: string;
  started_at: string;
  fw_users?: { name?: string; email?: string };
}

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

const SR_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  docs_received: { label: "Docs Received", color: "#F59E0B", bg: "bg-amber-50 text-amber-700"  },
  under_review:  { label: "Under Review",  color: "#3B82F6", bg: "bg-blue-50 text-blue-700"    },
  approved:      { label: "Approved",      color: "#10B981", bg: "bg-green-50 text-green-700"  },
  in_progress:   { label: "In Progress",   color: "#8B5CF6", bg: "bg-violet-50 text-violet-700"},
  completed:     { label: "Completed",     color: "#059669", bg: "bg-emerald-50 text-emerald-700"},
  rejected:      { label: "Rejected",      color: "#EF4444", bg: "bg-red-50 text-red-600"      },
};

const SR_STEPS = ["docs_received", "under_review", "approved", "in_progress", "completed"];

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS ?? "";

export default function AdminPage() {
  const [users, setUsers] = useState<FwUser[]>([]);
  const [enquiries, setEnquiries] = useState<FwEnquiry[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [subscriptions, setSubscriptions] = useState<FwSubscription[]>([]);
  const [leads, setLeads] = useState<FwLead[]>([]);
  const [tab, setTab] = useState<"leads" | "users" | "enquiries" | "approvals" | "subscriptions" | "services">("leads");
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [srEdits, setSrEdits] = useState<Record<string, { status: string; admin_notes: string; package_granted: string }>>({});
  const [srSaving, setSrSaving] = useState<string | null>(null);
  const [srExpanded, setSrExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passErr, setPassErr] = useState(false);
  const [filter, setFilter] = useState<"all" | "google" | "email">("all");
  const [approvalFilter, setApprovalFilter] = useState<"pending" | "active" | "rejected">("pending");
  const [loadErr, setLoadErr] = useState("");

  const load = async () => {
    setLoadErr("");
    try {
      const { data: u, error: ue } = await supabase.from("fw_users").select("*").order("created_at", { ascending: false });
      if (ue) throw ue;
      setUsers(u || []);
      const { data: e, error: ee } = await supabase.from("fw_enquiries").select("*").order("created_at", { ascending: false });
      if (ee) throw ee;
      setEnquiries(e || []);

      // Load all listing types
      const [ws, fl, sv, st] = await Promise.all([
        supabase.from("fw_workspaces").select("id,name,city,status,created_at,user_id").order("created_at", { ascending: false }),
        supabase.from("fw_freelancers").select("id,name,city,status,created_at,user_id").order("created_at", { ascending: false }),
        supabase.from("fw_services").select("id,provider_name,status,created_at,user_id").order("created_at", { ascending: false }),
        supabase.from("fw_startups").select("id,company_name,city,status,created_at,user_id").order("created_at", { ascending: false }),
      ]);
      const combined: Listing[] = [
        ...(ws.data ?? []).map((r: {id:string;name:string;city?:string;status:string;created_at:string;user_id:string}) => ({ ...r, kind: "workspace" as const })),
        ...(fl.data ?? []).map((r: {id:string;name:string;city?:string;status:string;created_at:string;user_id:string}) => ({ ...r, kind: "freelancer" as const })),
        ...(sv.data ?? []).map((r: {id:string;provider_name:string;status:string;created_at:string;user_id:string}) => ({ id:r.id, name:r.provider_name, city:undefined, status:r.status, created_at:r.created_at, user_id:r.user_id, kind: "service" as const })),
        ...(st.data ?? []).map((r: {id:string;company_name:string;city?:string;status:string;created_at:string;user_id:string}) => ({ id:r.id, name:r.company_name, city:r.city, status:r.status, created_at:r.created_at, user_id:r.user_id, kind: "startup" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setListings(combined);

      const { data: subs } = await supabase.from("fw_subscriptions").select("*, fw_users(name, email)").order("started_at", { ascending: false });
      setSubscriptions(subs ?? []);

      const { data: leadsData } = await supabase.from("fw_leads").select("*").order("created_at", { ascending: false });
      setLeads(leadsData ?? []);

      const { data: srData } = await supabase.from("fw_service_requests").select("*").order("created_at", { ascending: false }).limit(500);
      const srRows = srData ?? [];
      setServiceRequests(srRows);
      const srMap: typeof srEdits = {};
      srRows.forEach((r: ServiceRequest) => { srMap[r.id] = { status: r.status, admin_notes: r.admin_notes ?? "", package_granted: r.package_granted ?? "" }; });
      setSrEdits(srMap);
    } catch (err: unknown) {
      setLoadErr(err instanceof Error ? err.message : "Failed to load data. Check Supabase env vars.");
    }
  };

  const approveListing = async (listing: Listing) => {
    await supabase.from(`fw_${listing.kind}s`).update({ status: "active" }).eq("id", listing.id);
    setListings(l => l.map(x => x.id === listing.id ? { ...x, status: "active" } : x));
  };

  const updateLeadStatus = async (id: string, status: string) => {
    await supabase.from("fw_leads").update({ status }).eq("id", id);
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x));
  };

  const saveSR = async (req: ServiceRequest) => {
    setSrSaving(req.id);
    const e = srEdits[req.id];
    await supabase.from("fw_service_requests").update({
      status: e.status,
      admin_notes: e.admin_notes,
      package_granted: e.package_granted || null,
      package_granted_at: e.package_granted && !req.package_granted ? new Date().toISOString() : req.package_granted_at,
    }).eq("id", req.id);
    setSrSaving(null);
    load();
  };

  const exportLeadsCSV = () => {
    const header = "Name,Mobile,Email,Service,Source,Campaign,Status,Date";
    const rows = leads.map(l => `"${l.name}","${l.mobile}","${l.email||""}","${l.service||""}","${l.source||""}","${l.utm_campaign||""}","${l.status}","${l.created_at}"`).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "frework_leads.csv"; a.click();
  };

  const rejectListing = async (listing: Listing) => {
    await supabase.from(`fw_${listing.kind}s`).update({ status: "rejected" }).eq("id", listing.id);
    setListings(l => l.map(x => x.id === listing.id ? { ...x, status: "rejected" } : x));
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === ADMIN_PASS) { setAuthed(true); setPassErr(false); }
    else { setPassErr(true); }
  };

  const deleteUser = async (id: string) => {
    await supabase.from("fw_users").delete().eq("id", id);
    setUsers(u => u.filter(x => x.id !== id));
  };

  const exportCSV = () => {
    const header = "ID,Name,Email,Mobile,Method,Joined";
    const rows = users.map(u => `${u.id},${u.name || ""},${u.email},${u.mobile || ""},${u.method},${u.created_at}`).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "frework_users.csv"; a.click();
  };

  const filtered = users.filter(u => {
    const matchFilter = filter === "all" || u.method === filter;
    const matchSearch = !search || [u.name, u.email, u.mobile].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const googleCount = users.filter(u => u.method === "google").length;
  const emailCount = users.filter(u => u.method === "email").length;
  const mobileCount = users.filter(u => u.mobile).length;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1">FreWork User Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Admin Password</label>
              <input type="password" value={pass} onChange={e => { setPass(e.target.value); setPassErr(false); }} placeholder="Enter admin password" className={`w-full border-2 rounded-2xl px-4 py-3 bg-white dark:bg-gray-900 outline-none text-sm dark:text-white transition-all ${passErr ? "border-red-400 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-violet-500"}`} />
              {passErr && <p className="text-red-500 text-xs mt-1">Incorrect password</p>}
            </div>
            <Button type="submit" className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold">
              Access Dashboard
            </Button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-6">
            <Link href="/" className="text-violet-600 hover:underline">← Back to site</Link>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="9" fill="#7C3AED"/><circle cx="18" cy="11" r="2.5" fill="white"/><circle cx="11" cy="23" r="2.5" fill="white"/><circle cx="25" cy="23" r="2.5" fill="white"/><line x1="18" y1="13.5" x2="11" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="18" y1="13.5" x2="25" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="23" x2="25" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-lg leading-none">FreWork Admin</h1>
              <p className="text-xs text-gray-400">User Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={load} variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200 dark:border-gray-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button onClick={exportCSV} size="sm" className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-2">← Site</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error */}
        {loadErr && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 rounded-2xl px-5 py-4 text-sm mb-6">{loadErr}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: users.length, icon: Users, bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600" },
            { label: "Google Sign-ups", value: googleCount, icon: Globe, bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600" },
            { label: "Email Sign-ups", value: emailCount, icon: UserCheck, bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600" },
            { label: "Enquiries", value: enquiries.length, icon: Smartphone, bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600" },
          ].map(({ label, value, icon: Icon, bg, text }: { label: string; value: number; icon: React.ElementType; bg: string; text: string }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${text}`} />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            ["leads", "Leads 🎯", leads.length, Phone],
            ["users", "Users", users.length, Users],
            ["enquiries", "Enquiries", enquiries.length, FileText],
            ["approvals", "Approvals", listings.filter(l => l.status === "pending").length, CheckCircle],
            ["subscriptions", "Subscriptions", subscriptions.length, Crown],
            ["services", "Services", serviceRequests.length, Briefcase],
          ] as const).map(([t, label, count, Icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${tab === t ? "bg-violet-600 text-white shadow" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-violet-300"}`}>
              <Icon className="w-4 h-4" />
              {label} <span className={`text-xs rounded-full px-2 py-0.5 ${tab === t ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Table panel */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Search + filter bar */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm dark:text-white outline-none focus:border-violet-400 transition-all" />
            </div>
            {tab === "users" && (
              <div className="flex gap-2">
                {(["all", "google", "email"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${filter === f ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                    {f === "all" ? `All (${users.length})` : f === "google" ? `Google (${googleCount})` : `Email (${emailCount})`}
                  </button>
                ))}
              </div>
            )}
            {tab === "approvals" && (
              <div className="flex gap-2">
                {(["pending", "active", "rejected"] as const).map(f => (
                  <button key={f} onClick={() => setApprovalFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${approvalFilter === f ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}>
                    {f} ({listings.filter(l => l.status === f).length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leads tab */}
          {tab === "leads" && (() => {
            const newLeads = leads.filter(l => l.status === "new").length;
            const statusColors: Record<string, string> = {
              new: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
              contacted: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
              qualified: "bg-violet-50 text-violet-700",
              converted: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
              lost: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
            };
            const filtered3 = leads.filter(l => !search || [l.name, l.mobile, l.email, l.service, l.utm_campaign].some(v => v?.toLowerCase().includes(search.toLowerCase())));
            return (
              <>
                {newLeads > 0 && (
                  <div className="mx-5 mt-4 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm font-medium">
                    🎯 <strong>{newLeads} new leads</strong> from Meta / Instagram ads — assign status below
                    <button onClick={exportLeadsCSV} className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                )}
                {filtered3.length === 0 ? (
                  <div className="py-20 text-center">
                    <Phone className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No leads yet. Share your ad landing page: <strong>frework.online/lp</strong></p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-gray-50 dark:bg-gray-800/50">{["Name & Contact", "Service Interest", "Source / Campaign", "Status", "Date", "Update"].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filtered3.map((lead, i) => (
                          <motion.tr key={lead.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="px-5 py-4">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{lead.name}</p>
                              <a href={`tel:+91${lead.mobile}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" /> +91 {lead.mobile}
                              </a>
                              {lead.email && <p className="text-[11px] text-gray-400 mt-0.5">{lead.email}</p>}
                            </td>
                            <td className="px-5 py-4">
                              {lead.service ? (
                                <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                  <Tag className="w-3 h-3" /> {lead.service}
                                </span>
                              ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 capitalize font-medium">{lead.source || "website"}</span>
                              {lead.utm_campaign && <p className="text-[10px] text-gray-400 mt-1">{lead.utm_campaign}</p>}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="px-5 py-4">
                              <select value={lead.status} onChange={e => updateLeadStatus(lead.id, e.target.value)}
                                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer outline-none">
                                {["new","contacted","qualified","converted","lost"].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                              </select>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 flex items-center justify-between">
                      <span>{filtered3.length} leads · {leads.filter(l => l.status === "converted").length} converted · {leads.filter(l => l.status === "new").length} new</span>
                      <button onClick={exportLeadsCSV} className="flex items-center gap-1.5 text-violet-600 hover:text-violet-700 font-medium">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Users tab */}
          {tab === "users" && (
            filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{users.length === 0 ? "No users yet." : "No users match your search."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50">{["User", "Email", "Mobile", "Method", "Joined", ""].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((user, i) => (
                      <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(user.name || user.email || "?")[0].toUpperCase()}</div>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{user.name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {user.mobile ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />+91 {user.mobile}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.method === "google" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400"}`}>
                            {user.method === "google" ? "🔵 Google" : "✉️ Email"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400">{new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="px-5 py-4">
                          <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">Showing {filtered.length} of {users.length} users</div>
              </div>
            )
          )}

          {/* Enquiries tab */}
          {tab === "enquiries" && (() => {
            const enqFiltered = enquiries.filter(e => !search || [e.name, e.email, e.mobile, e.service].some(v => v?.toLowerCase().includes(search.toLowerCase())));
            return enqFiltered.length === 0 ? (
              <div className="py-20 text-center">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{enquiries.length === 0 ? "No enquiries yet." : "No enquiries match."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50">{["Name", "Mobile", "Email", "Service", "Message", "Date"].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {enqFiltered.map((enq, i) => (
                      <motion.tr key={enq.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-sm text-gray-900 dark:text-white">{enq.name}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">+91 {enq.mobile}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{enq.email || "—"}</td>
                        <td className="px-5 py-4">
                          {enq.service ? <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">{enq.service}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 max-w-xs truncate">{enq.message || "—"}</td>
                        <td className="px-5 py-4 text-sm text-gray-400">{new Date(enq.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">Showing {enqFiltered.length} enquiries</div>
              </div>
            );
          })()}

          {/* Approvals tab */}
          {tab === "approvals" && (() => {
            const filtered2 = listings.filter(l => l.status === approvalFilter && (!search || l.name?.toLowerCase().includes(search.toLowerCase())));
            const kindColor: Record<string, string> = { workspace: "bg-blue-50 text-blue-700", freelancer: "bg-violet-50 text-violet-700", service: "bg-amber-50 text-amber-700", startup: "bg-purple-50 text-purple-700" };
            return filtered2.length === 0 ? (
              <div className="py-20 text-center">
                <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No {approvalFilter} listings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50">{["Name", "Type", "City", "Submitted", "Status", "Actions"].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered2.map((item, i) => (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-sm text-gray-900 dark:text-white">{item.name}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${kindColor[item.kind] ?? "bg-gray-100 text-gray-600"}`}>{item.kind}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500">{item.city || "—"}</td>
                        <td className="px-5 py-4 text-sm text-gray-400">{new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${item.status === "active" ? "bg-green-50 text-green-700" : item.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{item.status}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {item.status !== "active" && (
                              <button onClick={() => approveListing(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                            )}
                            {item.status !== "rejected" && (
                              <button onClick={() => rejectListing(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors">
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">Showing {filtered2.length} listings</div>
              </div>
            );
          })()}

          {/* Services tab */}
          {tab === "services" && (() => {
            const srFiltered = serviceRequests.filter(r =>
              !search || [r.user_email, r.user_phone, r.service_name].some(v => v?.toLowerCase().includes(search.toLowerCase()))
            );
            // Group by user
            const byUser: Record<string, ServiceRequest[]> = {};
            srFiltered.forEach(r => {
              const k = r.user_email || r.user_id;
              if (!byUser[k]) byUser[k] = [];
              byUser[k].push(r);
            });
            const newCount = serviceRequests.filter(r => r.status === "docs_received").length;
            return srFiltered.length === 0 ? (
              <div className="py-20 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No service requests yet.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {newCount > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 text-amber-700 text-sm font-medium mb-2">
                    📂 <strong>{newCount} new</strong> service requests waiting for review
                  </div>
                )}
                {Object.entries(byUser).map(([email, reqs]) => {
                  const phone = reqs[0]?.user_phone;
                  const isOpen = srExpanded === email;
                  const active = reqs.filter(r => !["completed","rejected"].includes(r.status)).length;
                  const done = reqs.filter(r => r.status === "completed").length;
                  return (
                    <div key={email} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                      {/* User header */}
                      <button className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                        onClick={() => setSrExpanded(isOpen ? null : email)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {email[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{email}</p>
                            {phone && <p className="text-xs text-gray-400">+91 {phone}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex gap-1.5">
                            {reqs.map(r => {
                              const st = SR_STATUS_CFG[r.status];
                              return (
                                <span key={r.id} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st?.bg ?? "bg-gray-100 text-gray-600"}`}>
                                  {r.service_name.split(" ")[0]}
                                </span>
                              );
                            })}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <span className="font-semibold text-gray-900 dark:text-white">{reqs.length} service{reqs.length > 1 ? "s" : ""}</span>
                            {active > 0 && <span className="text-amber-600 ml-2">{active} active</span>}
                            {done > 0 && <span className="text-green-600 ml-2">{done} done</span>}
                          </div>
                          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                            {phone && (
                              <a href={`https://wa.me/${phone.replace(/\D/g,"")}?text=Hi%2C%20FreWork%20CA%20Team%20here.`}
                                target="_blank" rel="noopener noreferrer"
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-50 hover:bg-green-100 transition-colors">
                                <svg viewBox="0 0 24 24" fill="#16a34a" className="w-3.5 h-3.5">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </a>
                            )}
                            <a href={`mailto:${email}`}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition-colors">
                              <Mail className="w-3.5 h-3.5 text-blue-600" />
                            </a>
                          </div>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>

                      {/* Service rows for this user */}
                      {isOpen && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {reqs.map(req => {
                            const st = SR_STATUS_CFG[req.status] ?? SR_STATUS_CFG.docs_received;
                            const edit = srEdits[req.id] ?? { status: req.status, admin_notes: "", package_granted: "" };
                            const curStep = SR_STEPS.indexOf(req.status);
                            const date = new Date(req.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                            return (
                              <div key={req.id} className="px-5 py-4 bg-white dark:bg-gray-900">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{req.service_name}</span>
                                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.bg}`}>{st.label}</span>
                                      {req.package_granted && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">✅ Package Active</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400">{date}</p>
                                    {req.notes && <p className="text-xs text-gray-400 italic mt-1">"{req.notes}"</p>}
                                  </div>
                                </div>

                                {/* Progress dots */}
                                {req.status !== "rejected" && (
                                  <div className="flex items-center gap-1.5 mb-4">
                                    {SR_STEPS.map((s, i) => (
                                      <div key={s} className="flex items-center gap-1.5">
                                        <div title={SR_STATUS_CFG[s]?.label}
                                          className="w-2.5 h-2.5 rounded-full transition-all"
                                          style={{
                                            background: i <= curStep ? "#7C3AED" : "#E5E7EB",
                                            boxShadow: i === curStep ? "0 0 6px rgba(124,58,237,0.6)" : "none",
                                            transform: i === curStep ? "scale(1.3)" : "scale(1)",
                                          }} />
                                        {i < SR_STEPS.length - 1 && (
                                          <div className="w-6 h-[1.5px]" style={{ background: i < curStep ? "#7C3AED" : "#E5E7EB" }} />
                                        )}
                                      </div>
                                    ))}
                                    <span className="ml-2 text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                                  </div>
                                )}

                                {/* Inline controls */}
                                <div className="grid sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</label>
                                    <select value={edit.status}
                                      onChange={e => setSrEdits(prev => ({ ...prev, [req.id]: { ...prev[req.id], status: e.target.value } }))}
                                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                                      {Object.entries(SR_STATUS_CFG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Grant Package</label>
                                    <select value={edit.package_granted}
                                      onChange={e => setSrEdits(prev => ({ ...prev, [req.id]: { ...prev[req.id], package_granted: e.target.value } }))}
                                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                                      <option value="">— None —</option>
                                      {["gst-registration","gst-filing","accounting","income-tax","company-registration","gst-audit","roc-compliance"].map(k => (
                                        <option key={k} value={k}>{k.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Note to User</label>
                                    <input value={edit.admin_notes}
                                      onChange={e => setSrEdits(prev => ({ ...prev, [req.id]: { ...prev[req.id], admin_notes: e.target.value } }))}
                                      placeholder="Visible in user tracker..."
                                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none" />
                                  </div>
                                </div>

                                <div className="flex gap-2 mt-3">
                                  <button onClick={() => saveSR(req)} disabled={srSaving === req.id}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                                    <CheckCircle className="w-3.5 h-3.5" /> {srSaving === req.id ? "Saving…" : "Save & Update"}
                                  </button>
                                  {req.user_phone && (
                                    <a href={`https://wa.me/${req.user_phone.replace(/\D/g,"")}?text=Hi%2C%20your%20${encodeURIComponent(req.service_name)}%20is%20now%20*${encodeURIComponent(SR_STATUS_CFG[edit.status]?.label ?? edit.status)}*${edit.admin_notes ? ".%20" + encodeURIComponent(edit.admin_notes) : "."}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors">
                                      WhatsApp
                                    </a>
                                  )}
                                  <a href={`mailto:${req.user_email}?subject=Update: ${req.service_name}&body=Status: ${SR_STATUS_CFG[edit.status]?.label ?? edit.status}%0A%0A${edit.admin_notes}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors">
                                    Email
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="text-xs text-gray-400 px-1 pt-1">
                  {srFiltered.length} requests · {serviceRequests.filter(r => r.status === "completed").length} completed · {serviceRequests.filter(r => r.status === "docs_received").length} new
                </div>
              </div>
            );
          })()}

          {/* Subscriptions tab */}
          {tab === "subscriptions" && (
            subscriptions.length === 0 ? (
              <div className="py-20 text-center">
                <Crown className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No subscriptions yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50">{["User", "Plan", "Billing", "Amount", "Status", "Since"].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {subscriptions.filter(s => !search || s.fw_users?.email?.toLowerCase().includes(search.toLowerCase()) || s.plan.includes(search)).map((sub, i) => (
                      <motion.tr key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sub.fw_users?.name || "—"}</p>
                          <p className="text-xs text-gray-400">{sub.fw_users?.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-amber-50 text-amber-700">{sub.plan}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 capitalize">{sub.billing}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900 dark:text-white">₹{sub.amount?.toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sub.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{sub.status}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400">{new Date(sub.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                  Total revenue: ₹{subscriptions.reduce((sum, s) => sum + (s.amount ?? 0), 0).toLocaleString("en-IN")}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
