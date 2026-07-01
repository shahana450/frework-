"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Wrench, ArrowLeft, CheckCircle, MapPin, Phone, Mail, IndianRupee } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";

const TRADES = ["Electrician","Plumber","Carpenter","Painter","Housekeeping / Maid","Cook / Chef","Tailor","Driver","Security Guard","AC Technician","Welder","Mason / Construction","Gardener","Pest Control","Water Purifier Technician","CCTV Installation","Home Renovation","Moving & Packing","Other"];
const AVAILABILITY = ["Weekdays","Weekends","Full Time","Part Time","On-call / Emergency"];

export default function SkilledSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selTrades, setSelTrades] = useState<string[]>([]);
  const [selAvail, setSelAvail] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", city: "", area: "", experience_years: "", hourly_rate: "", bio: "", contact_email: "", contact_phone: "", daily_rate: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setForm(f => ({ ...f, name: session.user.user_metadata?.full_name ?? "", contact_email: session.user.email ?? "" }));
    });
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_freelancers").insert({
      user_id: userId, ...form,
      category: "Skilled Worker",
      title: selTrades[0] ?? "Skilled Worker",
      skills: selTrades,
      hourly_rate: form.hourly_rate ? parseInt(form.hourly_rate) : null,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      extra: { availability: selAvail, daily_rate: form.daily_rate, area: form.area },
      photos: photoUrls,
      status: "pending",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-amber-400" /></div>
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Profile Submitted!</h2>
        <p className="text-white/40 text-sm mb-8">Your profile will go live within 24 hours after review.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center"><Wrench className="w-6 h-6 text-amber-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Register as Skilled Worker</h1>
            <p className="text-white/35 text-sm">Get hired for electrician, plumbing, cooking & more</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <F label="Full Name *" value={form.name} onChange={set("name")} required />
              <F label="Experience (years)" value={form.experience_years} onChange={set("experience_years")} placeholder="e.g. 10" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai" required icon={MapPin} />
              <F label="Area / Locality" value={form.area} onChange={set("area")} placeholder="Andheri, Bandra…" />
            </div>
            <TA label="About Your Work *" value={form.bio} onChange={set("bio")} placeholder="What services do you offer? Any specialisations or certifications?" required />
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
            <p className="label">Your Trade / Service * (select all that apply)</p>
            <div className="flex flex-wrap gap-2">
              {TRADES.map(t => (
                <button key={t} type="button" onClick={() => setSelTrades(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selTrades.includes(t) ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/4 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
            <p className="label">Availability</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY.map(a => (
                <button key={a} type="button" onClick={() => setSelAvail(p => p.includes(a) ? p.filter(x=>x!==a) : [...p,a])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selAvail.includes(a) ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/4 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <F label="Hourly Rate (₹)" value={form.hourly_rate} onChange={set("hourly_rate")} placeholder="e.g. 300" type="number" icon={IndianRupee} />
              <F label="Daily Rate (₹)" value={form.daily_rate} onChange={set("daily_rate")} placeholder="e.g. 1500" type="number" icon={IndianRupee} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Phone *" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" required icon={Phone} />
              <F label="Email" value={form.contact_email} onChange={set("contact_email")} type="email" icon={Mail} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
            <p className="text-sm font-semibold text-white/60">Work Photos</p>
            <p className="text-xs text-white/30">Show examples of your work — before/after, tools, certificates</p>
            {userId && (
              <PhotoUpload userId={userId} folder="skilled" maxPhotos={8} onUrlsChange={setPhotoUrls} accentColor="amber" />
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Wrench className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Skilled Worker Profile"}
          </button>
        </form>
      </div>
      <style>{`.label{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}.input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;font-size:13px;color:white;outline:none;transition:border-color 0.2s}.input::placeholder{color:rgba(255,255,255,0.2)}.input:focus{border-color:rgba(245,158,11,0.4)}`}</style>
    </div>
  );
}
function F({ label, value, onChange, placeholder="", type="text", required=false, icon:Icon }: any) {
  return <div><label className="label">{label}</label><div className="relative">{Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}<input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${Icon?"pl-9":""}`} /></div></div>;
}
function TA({ label, value, onChange, placeholder="", required=false }: any) {
  return <div><label className="label">{label}</label><textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={4} className="input resize-none" /></div>;
}
