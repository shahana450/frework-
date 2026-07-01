"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { GraduationCap, ArrowLeft, CheckCircle, MapPin, Phone, Mail, IndianRupee } from "lucide-react";

const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","English","Hindi","Social Studies","Computer Science","Accountancy","Economics","Business Studies","Music","Dance","Yoga","Art","Sports Coaching","IELTS/TOEFL","JEE Coaching","NEET Coaching","MBA Entrance","Other"];
const MODES = ["Home Tuition","Online Classes","At My Location","Group Classes","School/College Level"];

export default function TeacherSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selSubjects, setSelSubjects] = useState<string[]>([]);
  const [selModes, setSelModes] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", qualification: "", city: "", experience_years: "", hourly_rate: "", bio: "", contact_email: "", contact_phone: "", boards: "", languages: "" });

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
      category: "Teacher",
      skills: selSubjects,
      hourly_rate: form.hourly_rate ? parseInt(form.hourly_rate) : null,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      extra: { modes: selModes, boards: form.boards, languages: form.languages },
      status: "pending",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-emerald-400" /></div>
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Teacher Profile Submitted!</h2>
        <p className="text-white/40 text-sm mb-8">Your profile will go live within 24 hours after review.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center"><GraduationCap className="w-6 h-6 text-emerald-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Register as Teacher / Tutor</h1>
            <p className="text-white/35 text-sm">Offer classes, tutoring and coaching to students</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card color="emerald">
            <div className="grid grid-cols-2 gap-3">
              <F label="Full Name *" value={form.name} onChange={set("name")} required />
              <F label="Qualification *" value={form.qualification} onChange={set("qualification")} placeholder="B.Ed, M.Sc, PhD…" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai" required icon={MapPin} />
              <F label="Years of Experience" value={form.experience_years} onChange={set("experience_years")} placeholder="e.g. 8" type="number" />
            </div>
            <F label="Languages you teach in" value={form.languages} onChange={set("languages")} placeholder="English, Hindi, Marathi…" />
            <F label="Boards / Curriculum" value={form.boards} onChange={set("boards")} placeholder="CBSE, ICSE, State Board, IB…" />
            <TA label="About You *" value={form.bio} onChange={set("bio")} placeholder="Your background, teaching style, achievements…" required />
          </Card>

          <Card color="emerald">
            <p className="label">Subjects you teach *</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => (
                <button key={s} type="button" onClick={() => setSelSubjects(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selSubjects.includes(s) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/4 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card color="emerald">
            <p className="label">Teaching modes</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map(m => (
                <button key={m} type="button" onClick={() => setSelModes(p => p.includes(m) ? p.filter(x=>x!==m) : [...p,m])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selModes.includes(m) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/4 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {m}
                </button>
              ))}
            </div>
          </Card>

          <Card color="emerald">
            <F label="Hourly Rate / Session Fee (₹) *" value={form.hourly_rate} onChange={set("hourly_rate")} placeholder="e.g. 500" type="number" required icon={IndianRupee} />
            <div className="grid grid-cols-2 gap-3">
              <F label="Email *" value={form.contact_email} onChange={set("contact_email")} type="email" required icon={Mail} />
              <F label="Phone *" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" required icon={Phone} />
            </div>
          </Card>

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <GraduationCap className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Teacher Profile"}
          </button>
        </form>
      </div>
      <style>{`.label{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}.input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;font-size:13px;color:white;outline:none;transition:border-color 0.2s}.input::placeholder{color:rgba(255,255,255,0.2)}.input:focus{border-color:rgba(16,185,129,0.4)}`}</style>
    </div>
  );
}
function Card({ children, color="blue" }: { children: React.ReactNode; color?: string }) {
  return <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">{children}</div>;
}
function F({ label, value, onChange, placeholder="", type="text", required=false, icon:Icon }: any) {
  return <div><label className="label">{label}</label><div className="relative">{Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}<input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${Icon?"pl-9":""}`} /></div></div>;
}
function TA({ label, value, onChange, placeholder="", required=false }: any) {
  return <div><label className="label">{label}</label><textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={4} className="input resize-none" /></div>;
}
