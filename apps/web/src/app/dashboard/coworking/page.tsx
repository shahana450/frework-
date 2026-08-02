"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { CheckCircle, XCircle, Clock, Phone, Mail, MapPin, Building2, ArrowLeft, RefreshCw } from "lucide-react";

interface Space {
  id: string;
  created_at: string;
  space_name: string;
  city: string;
  address: string;
  pincode: string | null;
  space_types: string[];
  price_per_day: number | null;
  price_per_month: number | null;
  total_seats: number | null;
  amenities: string[];
  description: string | null;
  opening_hours: string | null;
  website: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_whatsapp: string;
  status: "pending" | "approved" | "rejected";
}

type Tab = "pending" | "approved" | "rejected";

export default function CoworkingAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      // allow only the owner email
      if (data.user.email !== "admin.frework@gmail.com") {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/coworking/admin/list?status=${tab}`);
    const data = await res.json();
    setSpaces(data.spaces || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const updateStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    setUpdating(id);
    await fetch("/api/coworking/approve", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setUpdating(null);
    load();
  };

  const counts = { pending: 0, approved: 0, rejected: 0 };
  // counts are loaded per-tab; show badge only on current tab
  const displayed = spaces.filter(s => s.status === tab);

  if (!isAdmin && !loading) return null;

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: "#8A9BB8" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span style={{ color: "#4A5A72" }}>/</span>
            <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>Coworking Admin</span>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: "#8A9BB8" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#EDE8DC" }}>Coworking Space Submissions</h1>
        <p className="text-sm mb-8" style={{ color: "#8A9BB8" }}>Review and approve space listings before they go live on frework.online/coworking</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(["pending", "approved", "rejected"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all"
              style={tab === t
                ? { background: t === "pending" ? "rgba(217,119,6,0.15)" : t === "approved" ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.12)",
                    color: t === "pending" ? "#F59E0B" : t === "approved" ? "#10B981" : "#F87171",
                    border: `1px solid ${t === "pending" ? "rgba(245,158,11,0.4)" : t === "approved" ? "rgba(16,185,129,0.4)" : "rgba(248,113,113,0.35)"}` }
                : { background: "transparent", color: "#4A5A72", border: "1px solid rgba(201,168,76,0.08)" }}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border" style={{ borderColor: "rgba(201,168,76,0.1)", background: "#0C1428" }}>
            <Building2 className="w-10 h-10 mx-auto mb-4" style={{ color: "#4A5A72" }} />
            <p className="font-bold text-sm" style={{ color: "#8A9BB8" }}>No {tab} submissions</p>
          </div>
        ) : (
          <div className="space-y-5">
            {displayed.map(space => (
              <div key={space.id} className="rounded-2xl border overflow-hidden"
                style={{ background: "#0C1428", borderColor: space.status === "pending" ? "rgba(245,158,11,0.2)" : space.status === "approved" ? "rgba(16,185,129,0.2)" : "rgba(248,113,113,0.15)" }}>
                <div className="h-[2px]" style={{
                  background: space.status === "pending"
                    ? "linear-gradient(90deg,#F59E0B,#D97706)"
                    : space.status === "approved"
                    ? "linear-gradient(90deg,#10B981,#059669)"
                    : "linear-gradient(90deg,#EF4444,#DC2626)"
                }} />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-base" style={{ color: "#EDE8DC" }}>{space.space_name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                          style={space.status === "pending"
                            ? { background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }
                            : space.status === "approved"
                            ? { background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }
                            : { background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                          {space.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#8A9BB8" }}>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{space.city} · {space.address}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(space.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {space.price_per_day && <p className="text-sm font-black" style={{ color: "#C9A84C" }}>₹{space.price_per_day}/day</p>}
                      {space.price_per_month && <p className="text-xs" style={{ color: "#4A5A72" }}>₹{space.price_per_month}/mo</p>}
                      {space.total_seats && <p className="text-xs mt-0.5" style={{ color: "#4A5A72" }}>{space.total_seats} seats</p>}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid md:grid-cols-2 gap-4 mb-4 text-xs" style={{ color: "#8A9BB8" }}>
                    <div className="space-y-1.5">
                      {space.space_types.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {space.space_types.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded-full" style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {space.description && <p className="leading-relaxed" style={{ color: "#8A9BB8" }}>{space.description}</p>}
                      {space.opening_hours && <p>🕐 {space.opening_hours}</p>}
                      {space.website && <a href={space.website} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#60A5FA" }}>{space.website}</a>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5"><span className="font-semibold" style={{ color: "#EDE8DC" }}>{space.contact_name}</span></p>
                      <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{space.contact_email}</p>
                      <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{space.contact_phone}</p>
                      {space.contact_whatsapp && space.contact_whatsapp !== space.contact_phone && (
                        <p className="flex items-center gap-1.5">📱 {space.contact_whatsapp}</p>
                      )}
                    </div>
                  </div>

                  {space.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {space.amenities.map(a => (
                        <span key={a} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.08)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.15)" }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {space.status !== "approved" && (
                      <button onClick={() => updateStatus(space.id, "approved")}
                        disabled={updating === space.id}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.35)" }}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {updating === space.id ? "Updating..." : "Approve"}
                      </button>
                    )}
                    {space.status !== "rejected" && (
                      <button onClick={() => updateStatus(space.id, "rejected")}
                        disabled={updating === space.id}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                        <XCircle className="w-3.5 h-3.5" />
                        {updating === space.id ? "Updating..." : "Reject"}
                      </button>
                    )}
                    {space.status !== "pending" && (
                      <button onClick={() => updateStatus(space.id, "pending")}
                        disabled={updating === space.id}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ background: "transparent", color: "#4A5A72", border: "1px solid rgba(74,90,114,0.3)" }}>
                        <Clock className="w-3.5 h-3.5" /> Reset to Pending
                      </button>
                    )}
                    <a href={`https://wa.me/${space.contact_whatsapp.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(space.contact_name)}%2C%20I%27m%20from%20FreWork.%20Your%20listing%20for%20${encodeURIComponent(space.space_name)}%20has%20been%20reviewed.`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black transition-all hover:opacity-90"
                      style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp Owner
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
