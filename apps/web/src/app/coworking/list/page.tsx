"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function FreWorkLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw_bg_list" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2044"/>
          <stop offset="100%" stopColor="#1E40AF"/>
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="9" fill="url(#fw_bg_list)"/>
      <g stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="11"/>
        <line x1="19" y1="19" x2="26.5" y2="24"/>
        <line x1="19" y1="19" x2="11.5" y2="24"/>
      </g>
      <circle cx="19" cy="19" r="3" fill="white"/>
      <circle cx="19" cy="11" r="2" fill="rgba(255,255,255,0.9)"/>
      <circle cx="26.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
      <circle cx="11.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
    </svg>
  );
}

const CITIES = ["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Surat", "Other"];
const SPACE_TYPES = ["Hot Desk", "Private Cabin", "Meeting Room", "Event Space", "Virtual Office", "Dedicated Desk"];
const AMENITIES = ["High-Speed WiFi", "Coffee & Tea", "Parking", "Printer & Scanner", "Air Conditioning", "24/7 Access", "CCTV Security", "Reception Staff", "Cafeteria", "Lounge Area", "Power Backup", "Phone Booth"];

export default function ListCoworkingPage() {
  const router = useRouter();
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
    const files = Array.from(e.target.files || []).slice(0, 2);
    setVideos(files);
  };

  const toggle = (key: "space_types" | "amenities", val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));
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
      const res = await fetch("/api/coworking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const inp = "w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10";
  const inpStyle = { background: "#101D35", borderColor: "rgba(201,168,76,0.15)", color: "#EDE8DC" };

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,12,26,0.95)" }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FreWorkLogo size={32} />
            <span className="font-bold" style={{ color: "#EDE8DC" }}>FreWork</span>
          </Link>
          <Link href="/coworking" className="text-xs font-semibold" style={{ color: "rgba(201,168,76,0.7)" }}>← Back</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Hero */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.25em] uppercase border mb-5 inline-block"
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

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Section 1: Space Info */}
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

          {/* Section 2: Space Types */}
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

          {/* Section 3: Pricing */}
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

          {/* Section 4: Amenities */}
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

          {/* Section 5: Contact */}
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

          {/* Section 6: Photos & Videos */}
          <div className="rounded-2xl border p-6" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <h2 className="text-sm font-black tracking-[0.15em] uppercase mb-1" style={{ color: "#C9A84C" }}>6. Photos & Videos</h2>
            <p className="text-xs mb-5" style={{ color: "#4A5A72" }}>Good photos get 3× more enquiries. Upload up to 8 photos and 2 videos.</p>

            {/* Photos */}
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

            {/* Videos */}
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

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl border text-sm font-semibold" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#F87171" }}>
              {error}
            </div>
          )}

          {/* Submit */}
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
