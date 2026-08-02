"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: "linear-gradient(135deg,#0F2044,#1E40AF)" }}>F</div>
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
