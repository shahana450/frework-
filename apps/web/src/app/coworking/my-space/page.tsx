"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: string;
  space_name: string;
  city: string;
  address: string;
  status: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_email: string;
  space_types: string[];
  amenities: string[];
  price_per_day: string;
  price_per_month: string;
  total_seats: string;
  description: string;
  created_at: string;
}

interface Enquiry {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  replied: boolean;
}

const STATUS_COLOR: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending:  { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  label: "⏳ Under Review" },
  approved: { color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  label: "✅ Live" },
  rejected: { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", label: "❌ Not Approved" },
};

export default function MySpaceDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "enquiries" | "edit">("overview");
  const [editForm, setEditForm] = useState<Partial<Listing>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace("/login?next=/coworking/my-space"); return; }
      const u = session.user;
      setUser({
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User",
        email: u.email ?? "",
      });
      const { data: ls } = await supabase
        .from("coworking_spaces")
        .select("*")
        .eq("owner_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ls) { router.replace("/coworking/list"); return; }
      setListing(ls);
      setEditForm(ls);

      // Fetch enquiries for this space
      const { data: enqs } = await supabase
        .from("coworking_enquiries")
        .select("*")
        .eq("space_id", ls.id)
        .order("created_at", { ascending: false });
      setEnquiries(enqs ?? []);
      setLoading(false);
    });
  }, [router]);

  const saveEdit = async () => {
    if (!listing) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase
      .from("coworking_spaces")
      .update({
        space_name: editForm.space_name,
        city: editForm.city,
        address: editForm.address,
        description: editForm.description,
        price_per_day: editForm.price_per_day,
        price_per_month: editForm.price_per_month,
        total_seats: editForm.total_seats,
        contact_phone: editForm.contact_phone,
        contact_whatsapp: editForm.contact_whatsapp,
        contact_email: editForm.contact_email,
      })
      .eq("id", listing.id);
    setSaving(false);
    if (error) { setSaveMsg("Failed to save. Try again."); return; }
    setListing(prev => prev ? { ...prev, ...editForm } : prev);
    setSaveMsg("Saved successfully!");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const markReplied = async (id: string) => {
    await supabase.from("coworking_enquiries").update({ replied: true }).eq("id", id);
    setEnquiries(e => e.map(q => q.id === id ? { ...q, replied: true } : q));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
      </div>
    );
  }

  const inp = "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all";
  const inpStyle = { background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC" };
  const st = listing ? STATUS_COLOR[listing.status] ?? STATUS_COLOR.pending : STATUS_COLOR.pending;
  const pendingEnquiries = enquiries.filter(e => !e.replied).length;

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FreWorkLogo size={28} />
            <span className="font-bold text-sm" style={{ color: "#EDE8DC" }}>FreWork</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: "#8A9BB8" }}>{user.name}</span>
              </div>
            )}
            <Link href="/coworking" className="text-xs font-semibold" style={{ color: "rgba(201,168,76,0.5)" }}>← Browse</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Space title + status */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-black tracking-[0.2em] uppercase mb-1" style={{ color: "#4A5A72" }}>My Space</p>
            <h1 className="text-2xl font-black" style={{ color: "#EDE8DC" }}>{listing?.space_name}</h1>
            <p className="text-sm mt-1" style={{ color: "#8A9BB8" }}>{listing?.city} · {listing?.address}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded-xl text-sm font-black"
              style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              {st.label}
            </span>
            {listing?.status === "approved" && (
              <Link href={`/coworking/${listing.id}`}
                className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
                style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C" }}>
                View Live →
              </Link>
            )}
          </div>
        </div>

        {listing?.status === "pending" && (
          <div className="rounded-2xl border p-4 mb-6 text-sm" style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>
            Your listing is under review. Our team will contact you on WhatsApp within 24 hours.
          </div>
        )}
        {listing?.status === "rejected" && (
          <div className="rounded-2xl border p-4 mb-6 text-sm" style={{ background: "rgba(248,113,113,0.07)", borderColor: "rgba(248,113,113,0.2)", color: "#F87171" }}>
            Your listing was not approved. Please edit and resubmit, or WhatsApp us at +91 85908 74681 for help.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl border mb-8" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
          {([
            { key: "overview", label: "Overview" },
            { key: "enquiries", label: `Enquiries${pendingEnquiries > 0 ? ` (${pendingEnquiries})` : ""}` },
            { key: "edit", label: "Edit Listing" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={activeTab === t.key
                ? { background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }
                : { color: "#4A5A72" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && listing && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Enquiries", value: enquiries.length, icon: "📩", color: "#C9A84C" },
                { label: "New / Unread", value: pendingEnquiries, icon: "🔔", color: "#F59E0B" },
                { label: "Replied", value: enquiries.filter(e => e.replied).length, icon: "✅", color: "#10B981" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border p-5" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                  <p className="text-xl mb-1">{s.icon}</p>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: "#4A5A72" }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
              <h3 className="text-xs font-black tracking-widest uppercase mb-4" style={{ color: "#C9A84C" }}>Listing Details</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                {[
                  ["Space Types", listing.space_types?.join(", ") || "—"],
                  ["Price / Day", listing.price_per_day ? `₹${listing.price_per_day}` : "—"],
                  ["Price / Month", listing.price_per_month ? `₹${listing.price_per_month}` : "—"],
                  ["Total Seats", listing.total_seats || "—"],
                  ["Phone", listing.contact_phone || "—"],
                  ["WhatsApp", listing.contact_whatsapp || listing.contact_phone || "—"],
                  ["Amenities", listing.amenities?.join(", ") || "—"],
                  ["Listed On", new Date(listing.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs mb-0.5" style={{ color: "#4A5A72" }}>{label}</p>
                    <p className="font-semibold" style={{ color: "#EDE8DC" }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {pendingEnquiries > 0 && (
              <div className="rounded-2xl border p-5 flex items-center justify-between"
                style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }}>
                <div>
                  <p className="font-black text-sm" style={{ color: "#F59E0B" }}>🔔 {pendingEnquiries} new enquir{pendingEnquiries === 1 ? "y" : "ies"} waiting</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8A9BB8" }}>Reply via WhatsApp or email to convert them into bookings</p>
                </div>
                <button onClick={() => setActiveTab("enquiries")}
                  className="px-4 py-2 rounded-xl text-xs font-black"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
                  View →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ENQUIRIES TAB */}
        {activeTab === "enquiries" && (
          <div>
            {enquiries.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                <p className="text-4xl mb-3">📭</p>
                <p className="font-bold text-sm" style={{ color: "#8A9BB8" }}>No enquiries yet</p>
                <p className="text-xs mt-1" style={{ color: "#4A5A72" }}>Once your space goes live, customer enquiries will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enquiries.map(enq => (
                  <div key={enq.id} className="rounded-2xl border overflow-hidden"
                    style={{ background: "#0C1428", borderColor: enq.replied ? "rgba(201,168,76,0.08)" : "rgba(245,158,11,0.25)" }}>
                    {!enq.replied && <div className="h-[2px]" style={{ background: "linear-gradient(90deg,#F59E0B,transparent)" }} />}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-black text-sm" style={{ color: "#EDE8DC" }}>{enq.name}</span>
                            {!enq.replied && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-xs mb-3" style={{ color: "#8A9BB8" }}>
                            {enq.email} · {enq.phone} · {new Date(enq.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>"{enq.message}"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t flex-wrap"
                        style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <a href={`https://wa.me/${enq.phone.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(enq.name)}%2C%20thank%20you%20for%20your%20enquiry%20about%20${encodeURIComponent(listing?.space_name ?? "our coworking space")}%20on%20FreWork!%20`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-90"
                          style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Reply on WhatsApp
                        </a>
                        <a href={`mailto:${enq.email}?subject=Re: Your enquiry about ${listing?.space_name}&body=Hi ${enq.name},%0A%0AThank you for your interest in ${listing?.space_name}.%0A%0A`}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-90"
                          style={{ background: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>
                          ✉ Reply by Email
                        </a>
                        {!enq.replied && (
                          <button onClick={() => markReplied(enq.id)}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-90 ml-auto"
                            style={{ background: "rgba(16,185,129,0.08)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
                            ✓ Mark Replied
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EDIT TAB */}
        {activeTab === "edit" && (
          <div className="space-y-5">
            <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
              <h3 className="text-xs font-black tracking-widest uppercase mb-5" style={{ color: "#C9A84C" }}>Edit Your Listing</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Space Name</label>
                  <input className={inp} style={inpStyle} value={editForm.space_name ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, space_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>City</label>
                    <input className={inp} style={inpStyle} value={editForm.city ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Price / Day (₹)</label>
                    <input className={inp} style={inpStyle} type="number" value={editForm.price_per_day ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, price_per_day: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Address</label>
                  <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={2} value={editForm.address ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Description</label>
                  <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={3} value={editForm.description ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Price / Month (₹)</label>
                    <input className={inp} style={inpStyle} type="number" value={editForm.price_per_month ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, price_per_month: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Total Seats</label>
                    <input className={inp} style={inpStyle} type="number" value={editForm.total_seats ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, total_seats: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Phone</label>
                    <input className={inp} style={inpStyle} type="tel" value={editForm.contact_phone ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>WhatsApp</label>
                    <input className={inp} style={inpStyle} type="tel" value={editForm.contact_whatsapp ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, contact_whatsapp: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Email</label>
                  <input className={inp} style={inpStyle} type="email" value={editForm.contact_email ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
                </div>
              </div>

              {saveMsg && (
                <div className="mt-4 px-4 py-3 rounded-xl text-sm font-semibold"
                  style={saveMsg.includes("success")
                    ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }
                    : { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171" }}>
                  {saveMsg}
                </div>
              )}

              <button onClick={saveEdit} disabled={saving}
                className="mt-5 w-full py-3.5 rounded-xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <p className="text-xs text-center mt-3" style={{ color: "#4A5A72" }}>
                Major changes (space type, amenities) require re-approval. Contact us on WhatsApp.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
