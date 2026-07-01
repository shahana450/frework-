"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Building2, ArrowLeft, CheckCircle, Camera, MapPin, Phone, Mail, Globe, IndianRupee } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";

const AMENITIES = ["High-speed WiFi","Meeting Rooms","24/7 Access","Parking","Cafeteria","AC","Power Backup","CCTV","Reception","Printing"];
const TYPES = ["Hot Desk","Dedicated Desk","Private Cabin","Team Suite","Virtual Office","Event Space"];

export default function WorkspaceSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", type: "", address: "", city: "", state: "", pincode: "",
    price_per_day: "", price_per_month: "", capacity: "", description: "",
    contact_email: "", contact_phone: "", website: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleAmenity = (a: string) =>
    setSelected(s => s.includes(a) ? s.filter(x => x !== a) : [...s, a]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_workspaces").insert({
      user_id: userId, ...form,
      amenities: selected,
      photos: photoUrls,
      price_per_day: form.price_per_day ? parseInt(form.price_per_day) : null,
      price_per_month: form.price_per_month ? parseInt(form.price_per_month) : null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      status: "pending",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Workspace Submitted!</h2>
        <p className="text-white/40 text-sm mb-8">Our team will review and approve your listing within 24 hours.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Add Workspace / Office</h1>
            <p className="text-white/35 text-sm">List your coworking space or office for rent</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basics */}
          <Section title="Basic Details" icon={Building2} color="blue">
            <Field label="Workspace Name *" value={form.name} onChange={set("name")} placeholder="e.g. The Hive Coworking, BKC Mumbai" required />
            <div>
              <label className="label">Type *</label>
              <select value={form.type} onChange={set("type")} className="input" required>
                <option value="">Select type</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Field label="Capacity (seats)" value={form.capacity} onChange={set("capacity")} placeholder="e.g. 20" type="number" />
            <Textarea label="Description *" value={form.description} onChange={set("description")} placeholder="Describe your workspace — amenities, vibe, location advantages…" required />
          </Section>

          {/* Location */}
          <Section title="Location" icon={MapPin} color="emerald">
            <Field label="Full Address *" value={form.address} onChange={set("address")} placeholder="Floor, Building, Street" required />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai" required />
              <Field label="State" value={form.state} onChange={set("state")} placeholder="Maharashtra" />
              <Field label="Pincode" value={form.pincode} onChange={set("pincode")} placeholder="400001" />
            </div>
          </Section>

          {/* Pricing */}
          <Section title="Pricing" icon={IndianRupee} color="gold">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price / Day (₹)" value={form.price_per_day} onChange={set("price_per_day")} placeholder="e.g. 500" type="number" />
              <Field label="Price / Month (₹)" value={form.price_per_month} onChange={set("price_per_month")} placeholder="e.g. 8000" type="number" />
            </div>
          </Section>

          {/* Amenities */}
          <Section title="Amenities" icon={CheckCircle} color="purple">
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected.includes(a) ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-white/4 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {a}
                </button>
              ))}
            </div>
          </Section>

          {/* Photos */}
          <Section title="Photos" icon={Camera} color="blue">
            {userId && (
              <PhotoUpload
                userId={userId}
                folder="workspaces"
                maxPhotos={10}
                onUrlsChange={setPhotoUrls}
                accentColor="blue"
              />
            )}
          </Section>

          {/* Contact */}
          <Section title="Contact Details" icon={Phone} color="emerald">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *" value={form.contact_email} onChange={set("contact_email")} placeholder="you@example.com" type="email" required icon={Mail} />
              <Field label="Phone" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" icon={Phone} />
            </div>
            <Field label="Website" value={form.website} onChange={set("website")} placeholder="https://yourspace.com" icon={Globe} />
          </Section>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Building2 className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Workspace Listing"}
          </button>
        </form>
      </div>
      <FormStyles />
    </div>
  );
}

function Section({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  const cls = color === "blue" ? "bg-blue-500/15 border-blue-500/20 text-blue-400" : color === "emerald" ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" : color === "gold" ? "bg-[#C9A84C]/15 border-[#C9A84C]/20 text-[#C9A84C]" : "bg-purple-500/15 border-purple-500/20 text-purple-400";
  return (
    <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${cls}`}><Icon className="w-4 h-4" /></div>
        <h3 className="font-semibold text-white text-sm">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
          className={`input ${Icon ? "pl-9" : ""}`} />
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, required = false, rows = 4 }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows} className="input resize-none" />
    </div>
  );
}

function FormStyles() {
  return (
    <style>{`
      .label { display: block; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
      .input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px; font-size: 13px; color: white; outline: none; transition: border-color 0.2s; }
      .input::placeholder { color: rgba(255,255,255,0.2); }
      .input:focus { border-color: rgba(59,130,246,0.4); }
    `}</style>
  );
}
