"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import { supabase } from "@/lib/supabase";

const CITIES = ["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Surat", "Other"];
const SPACE_TYPES = ["Hot Desk", "Private Cabin", "Meeting Room", "Event Space", "Virtual Office", "Dedicated Desk"];
const AMENITIES = ["High-Speed WiFi", "Coffee & Tea", "Parking", "Printer & Scanner", "Air Conditioning", "24/7 Access", "CCTV Security", "Reception Staff", "Cafeteria", "Lounge Area", "Power Backup", "Phone Booth"];

export default function ListCoworkingPage() {
  const router = useRouter();

  // --- ALL hooks at the top ---
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [existingListing, setExistingListing] = useState<{ id: string; space_name: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    space_name: "", city: "", address: "", pincode: "",
    space_types: [] as string[],
    price_per_day: "", price_per_month: "", total_seats: "",
    amenities: [] as string[],
    description: "", opening_hours: "", website: "",
    contact_name: "", contact_email: "", contact_phone: "", contact_whatsapp: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace("/login?next=/coworking/list");
        return;
      }
      const u = session.user;
      setUser({
        id: u.id,
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User",
        email: u.email ?? "",
      });
      // Check if they already have a listing
      const { data } = await supabase
        .from("coworking_spaces")
        .select("id, space_name, status")
        .eq("owner_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExistingListing(data);
      setAuthChecked(true);
    });
  }, [router]);

  // --- Handlers ---
  const toggle = (key: "space_types" | "amenities", val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    setPhotos(files);
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removePhoto = (i: number) => {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleVideos = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideos(Array.from(e.target.files || []).slice(0, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.space_name || !form.city || !form.address || !form.contact_name || !form.contact_email || !form.contact_phone) {
      setError("Please fill all required fields marked with *");
      return;
    }
    if (form.space_types.length === 0) {
      setError("Please select at least one space type");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/coworking/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      router.push("/coworking/list/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  // --- Conditional renders AFTER all hooks ---
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
      </div>
    );
  }

  const inp = "w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10";
  const inpStyle = { background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC" };

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FreWorkLogo size={30} />
            <span className="font-bold text-sm" style={{ color: "#EDE8DC" }}>FreWork</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: "#8A9BB8" }}>{user.name}</span>
              </div>
            )}
            {existingListing && (
              <Link href="/coworking/my-space"
                className="text-xs font-black px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
                style={{ borderColor: "rgba(201,168,76,0.3)", color: "#C9A84C", background: "rgba(201,168,76,0.07)" }}>
                My Dashboard →
              </Link>
            )}
            <Link href="/coworking" className="text-xs font-semibold" style={{ color: "rgba(201,168,76,0.6)" }}>← Back</Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.25em] uppercase border mb-5"
            style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.07)" }}>
            Free Listing · No Commission
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#EDE8DC" }}>
            List Your Coworking Space
          </h1>
          <p className="text-sm" style={{ color: "#8A9BB8" }}>
            Submit your space details. Our team reviews every listing before it goes live — usually within 24 hours.
          </p>
        </div>

        {existingListing && (
          <Link href="/coworking/my-space"
            className="flex items-center justify-between gap-4 p-5 rounded-2xl border mb-2 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(110deg,rgba(201,168,76,0.1),rgba(201,168,76,0.04))", borderColor: "rgba(201,168,76,0.3)" }}>
            <div className="flex items-center gap-4">
              <span className="text-2xl">🏛️</span>
              <div>
                <p className="text-sm font-black" style={{ color: "#E8C97A" }}>You already have a listing: {existingListing.space_name}</p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BB8" }}>
                  Status: <span className="font-bold" style={{ color: existingListing.status === "approved" ? "#10B981" : existingListing.status === "rejected" ? "#F87171" : "#F59E0B" }}>
                    {existingListing.status.charAt(0).toUpperCase() + existingListing.status.slice(1)}
                  </span> · Go to your dashboard to manage enquiries and edit details
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-4 py-2 rounded-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff" }}>
              Open Dashboard →
            </span>
          </Link>
        )}

        {/* Help with registration CTA */}
        <div className="rounded-2xl border overflow-hidden mb-8"
          style={{ background: "linear-gradient(110deg,#0C1830,#0A1420)", borderColor: "rgba(37,99,235,0.25)" }}>
          <div className="h-[2px]" style={{ background: "linear-gradient(90deg,#2563EB,#7C3AED,transparent)" }} />
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "#60A5FA" }}>Before You List</p>
              <p className="text-sm font-black mb-1" style={{ color: "#EDE8DC" }}>Need help getting your coworking space legally ready?</p>
              <p className="text-xs leading-relaxed" style={{ color: "#8A9BB8" }}>
                GST Registration · Trade License · Company Registration · Fire NOC guidance — FreWork CAs handle everything end-to-end.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20want%20to%20list%20my%20coworking%20space%20and%20need%20help%20with%20GST%20registration%20and%20legal%20compliance."
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", boxShadow: "0 2px 12px rgba(37,211,102,0.3)" }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Free Advice
              </a>
              <Link href="/services/compliance"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all hover:opacity-90"
                style={{ background: "rgba(37,99,235,0.15)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.3)" }}>
                View Services →
              </Link>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* 1. Space Details */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-5" style={{ color: "#C9A84C" }}>1. Space Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Space Name *</label>
                <input className={inp} style={inpStyle} placeholder="e.g. The Hive Coworking, Mumbai"
                  value={form.space_name} onChange={e => setForm(f => ({ ...f, space_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>City *</label>
                  <select className={inp} style={inpStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
                    <option value="">Select city</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Pincode</label>
                  <input className={inp} style={inpStyle} placeholder="400001"
                    value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Full Address *</label>
                <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={2}
                  placeholder="Building name, street, area, city"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Description</label>
                <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={3}
                  placeholder="Tell people what makes your space unique..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Opening Hours</label>
                  <input className={inp} style={inpStyle} placeholder="e.g. 8am – 10pm, Mon–Sat"
                    value={form.opening_hours} onChange={e => setForm(f => ({ ...f, opening_hours: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Website (optional)</label>
                  <input className={inp} style={inpStyle} placeholder="https://yourspace.com"
                    value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Space Types */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-5" style={{ color: "#C9A84C" }}>2. Space Types *</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SPACE_TYPES.map(type => {
                const active = form.space_types.includes(type);
                return (
                  <button key={type} type="button" onClick={() => toggle("space_types", type)}
                    className="px-4 py-3 rounded-xl border text-sm font-semibold text-left transition-all"
                    style={active
                      ? { background: "rgba(201,168,76,0.12)", borderColor: "rgba(201,168,76,0.5)", color: "#C9A84C" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(201,168,76,0.1)", color: "#8A9BB8" }}>
                    {active ? "✓ " : ""}{type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Pricing */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-5" style={{ color: "#C9A84C" }}>3. Pricing & Capacity</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Price / Day (₹)</label>
                <input className={inp} style={inpStyle} type="number" placeholder="500"
                  value={form.price_per_day} onChange={e => setForm(f => ({ ...f, price_per_day: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Price / Month (₹)</label>
                <input className={inp} style={inpStyle} type="number" placeholder="8000"
                  value={form.price_per_month} onChange={e => setForm(f => ({ ...f, price_per_month: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Total Seats</label>
                <input className={inp} style={inpStyle} type="number" placeholder="50"
                  value={form.total_seats} onChange={e => setForm(f => ({ ...f, total_seats: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* 4. Amenities */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-5" style={{ color: "#C9A84C" }}>4. Amenities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMENITIES.map(am => {
                const active = form.amenities.includes(am);
                return (
                  <button key={am} type="button" onClick={() => toggle("amenities", am)}
                    className="px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all flex items-center gap-2"
                    style={active
                      ? { background: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.4)", color: "#60A5FA" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(201,168,76,0.08)", color: "#8A9BB8" }}>
                    <span className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border text-[9px]"
                      style={active ? { background: "#3B82F6", borderColor: "#3B82F6", color: "#fff" } : { borderColor: "rgba(148,163,184,0.3)" }}>
                      {active ? "✓" : ""}
                    </span>
                    {am}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Contact */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-5" style={{ color: "#C9A84C" }}>5. Your Contact Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Your Name *</label>
                  <input className={inp} style={inpStyle} placeholder="Rahul Sharma"
                    value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Email *</label>
                  <input className={inp} style={inpStyle} type="email" placeholder="rahul@thehive.in"
                    value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>Phone *</label>
                  <input className={inp} style={inpStyle} type="tel" placeholder="+91 98765 43210"
                    value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "#8A9BB8" }}>WhatsApp Number</label>
                  <input className={inp} style={inpStyle} type="tel" placeholder="+91 98765 43210 (if different)"
                    value={form.contact_whatsapp} onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* 6. Photos & Videos */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-1" style={{ color: "#C9A84C" }}>6. Photos & Videos</h2>
            <p className="text-xs mb-5" style={{ color: "#4A5A72" }}>Good photos get 3× more enquiries. Upload up to 8 photos and 2 videos.</p>
            <div className="mb-5">
              <label className="block text-xs font-bold mb-2" style={{ color: "#8A9BB8" }}>Photos (up to 8)</label>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
              {photoPreviews.length === 0 ? (
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-all hover:opacity-80"
                  style={{ borderColor: "rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.03)" }}>
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>Click to upload photos</span>
                  <span className="text-[10px]" style={{ color: "#4A5A72" }}>JPG, PNG, WEBP · Max 8 photos</span>
                </button>
              ) : (
                <div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                          style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>✕</button>
                      </div>
                    ))}
                    {photoPreviews.length < 8 && (
                      <button type="button" onClick={() => photoRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-2xl transition-all hover:opacity-70"
                        style={{ borderColor: "rgba(201,168,76,0.2)" }}>+</button>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: "#4A5A72" }}>{photoPreviews.length} photo{photoPreviews.length !== 1 ? "s" : ""} selected</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: "#8A9BB8" }}>Videos (up to 2)</label>
              <input ref={videoRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideos} />
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed transition-all hover:opacity-80"
                style={{ borderColor: "rgba(201,168,76,0.15)", background: "rgba(201,168,76,0.03)" }}>
                <span className="text-xl">🎥</span>
                <div className="text-left">
                  <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>
                    {videos.length > 0 ? `${videos.length} video${videos.length > 1 ? "s" : ""} selected` : "Click to upload videos"}
                  </p>
                  <p className="text-[10px]" style={{ color: "#4A5A72" }}>MP4, MOV · Max 2 videos · Tour or walkthrough</p>
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl border text-sm font-semibold" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#F87171" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl text-sm font-black tracking-wide transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#fff", boxShadow: "0 4px 24px rgba(201,168,76,0.35)" }}>
            {loading ? "Submitting..." : "Submit My Space for Review →"}
          </button>

          <p className="text-center text-xs" style={{ color: "#4A5A72" }}>
            Free to list. No commission. Our team will review within 24 hours and contact you on WhatsApp.
          </p>
        </form>
      </div>
    </div>
  );
}
