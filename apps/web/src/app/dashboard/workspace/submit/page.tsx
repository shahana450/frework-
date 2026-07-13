"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Building2, ArrowLeft, CheckCircle, MapPin, Phone,
  Mail, Globe, IndianRupee, ChevronRight, Plus,
} from "lucide-react";

const AMENITIES = [
  "High-Speed Wi-Fi","Meeting Rooms","24/7 Access","Parking","Cafeteria",
  "AC","Power Backup","CCTV","Reception","Printing/Scanner","Lounge Area",
  "Phone Booths","Standing Desks","Video Conf Setup","Lockers","Coffee & Tea",
  "Outdoor Terrace","Event Hall","Gym","Housekeeping","Creche","Security Guard",
  "Business Address","Mail Handling","Nap Room","Bike Parking",
];

const TYPES = [
  "Hot Desk","Dedicated Desk","Private Cabin","Team Suite",
  "Virtual Office","Meeting Room","Event Space","Training Room","Day Pass",
];

const CITIES = [
  "Mumbai","Delhi","Bangalore","Hyderabad","Pune","Chennai","Gurgaon",
  "Noida","Kolkata","Ahmedabad","Jaipur","Kochi","Chandigarh","Indore",
  "Surat","Lucknow","Bhopal","Nagpur","Coimbatore","Visakhapatnam",
];

export default function WorkspaceSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
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

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleAmenity = (a: string) =>
    setAmenities(s => s.includes(a) ? s.filter(x => x !== a) : [...s, a]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_workspaces").insert({
      user_id: userId,
      ...form,
      amenities,
      photos: [],
      price_per_day:   form.price_per_day   ? parseInt(form.price_per_day)   : null,
      price_per_month: form.price_per_month ? parseInt(form.price_per_month) : null,
      capacity:        form.capacity        ? parseInt(form.capacity)         : null,
      status: "pending",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Space Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Your listing is under review. We'll approve it within 24 hours and it will appear publicly on FreWork.
        </p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
          Back to Dashboard <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">List Your Coworking Space</h1>
              <p className="text-slate-500 text-sm">Free listing · Get enquiries from professionals across India</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic Details */}
          <Card title="Basic Details" icon={Building2} color="#2563EB">
            <Label>Space / Office Name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. The Hive Coworking, BKC Mumbai" required />

            <Label>Type *</Label>
            <select value={form.type} onChange={set("type")} className="field" required>
              <option value="">Select workspace type</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total Capacity (seats)</Label>
                <Input value={form.capacity} onChange={set("capacity")} placeholder="e.g. 50" type="number" />
              </div>
              <div>
                <Label>Contact Phone *</Label>
                <Input value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" required icon={Phone} />
              </div>
            </div>

            <Label>Description *</Label>
            <textarea value={form.description} onChange={set("description")}
              placeholder="Describe your space — location advantages, vibe, type of members you host, nearby transport..."
              required rows={4} className="field resize-none" />
          </Card>

          {/* Location */}
          <Card title="Location" icon={MapPin} color="#059669">
            <Label>Full Address *</Label>
            <Input value={form.address} onChange={set("address")} placeholder="Floor, Building name, Street" required />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City *</Label>
                <select value={form.city} onChange={set("city")} className="field" required>
                  <option value="">City</option>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={set("state")} placeholder="Maharashtra" />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={set("pincode")} placeholder="400001" />
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card title="Pricing" icon={IndianRupee} color="#D97706">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price per Day (₹)</Label>
                <Input value={form.price_per_day} onChange={set("price_per_day")} placeholder="e.g. 400" type="number" />
              </div>
              <div>
                <Label>Price per Month (₹)</Label>
                <Input value={form.price_per_month} onChange={set("price_per_month")} placeholder="e.g. 7000" type="number" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Leave blank if not applicable. You can negotiate directly with enquirers.</p>
          </Card>

          {/* Amenities */}
          <Card title={`Amenities ${amenities.length > 0 ? `(${amenities.length} selected)` : ""}`} icon={CheckCircle} color="#7C3AED">
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    amenities.includes(a)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}>
                  {amenities.includes(a) && <span className="mr-1">✓</span>}
                  {a}
                </button>
              ))}
            </div>
          </Card>

          {/* Contact & Online */}
          <Card title="Contact & Online Presence" icon={Mail} color="#0891B2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email *</Label>
                <Input value={form.contact_email} onChange={set("contact_email")} placeholder="you@example.com" type="email" required icon={Mail} />
              </div>
              <div>
                <Label>Website / Map Link</Label>
                <Input value={form.website} onChange={set("website")} placeholder="https://..." icon={Globe} />
              </div>
            </div>
          </Card>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-sm text-white transition-all hover:opacity-90 hover:scale-[1.01] flex items-center justify-center gap-2 shadow-md"
            style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)", boxShadow:"0 4px 16px rgba(18,70,200,0.3)" }}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Space for Review"}
          </button>
          <p className="text-center text-xs text-slate-400 pb-6">
            Free to list · Approved within 24 hours · Visible to thousands of professionals
          </p>
        </form>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + "15", border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">{children}</label>;
}

function Input({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ElementType }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
      <input {...props} className={`field ${Icon ? "pl-9" : ""}`} />
    </div>
  );
}

// eslint-disable-next-line react/no-unknown-property
const _styles = (
  <style jsx global>{`
    .field {
      width: 100%;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      color: #0F172A;
      outline: none;
      transition: border-color 0.2s;
    }
    .field::placeholder { color: #94A3B8; }
    .field:focus { border-color: #2563EB; background: #fff; }
  `}</style>
);
