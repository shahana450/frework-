"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Users, ArrowLeft, CheckCircle, MapPin, Phone, Mail, Globe, IndianRupee } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";

const CATEGORIES = ["Software & Tech","Design & Creative","Marketing & SEO","Finance & Accounting","Legal","Content & Writing","Video & Media","AI / ML","Consulting","Other"];

export default function FreelancerSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", title: "", category: "", city: "", bio: "",
    skills: "", hourly_rate: "", contact_email: "", contact_phone: "",
    linkedin: "", portfolio: "", experience_years: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      const u = session.user;
      setForm(f => ({ ...f, name: u.user_metadata?.full_name ?? "", contact_email: u.email ?? "" }));
    });
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_freelancers").insert({
      user_id: userId, ...form,
      hourly_rate: form.hourly_rate ? parseInt(form.hourly_rate) : null,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      photos: photoUrls,
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
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Profile Submitted!</h2>
        <p className="text-white/40 text-sm mb-8">Your freelancer profile will be reviewed and go live within 24 hours.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Back to Dashboard</Link>
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
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Create Freelancer Profile</h1>
            <p className="text-white/35 text-sm">Get discovered by clients looking for your skills</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <Row><Field label="Full Name *" value={form.name} onChange={set("name")} required /><Field label="Professional Title *" value={form.title} onChange={set("title")} placeholder="e.g. Full-Stack Developer" required /></Row>
            <Row>
              <div><label className="label">Category *</label><select value={form.category} onChange={set("category")} className="input" required><option value="">Select</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              <Field label="City" value={form.city} onChange={set("city")} placeholder="Mumbai" icon={MapPin} />
            </Row>
            <Field label="Years of Experience" value={form.experience_years} onChange={set("experience_years")} placeholder="e.g. 5" type="number" />
            <Textarea label="Bio / About *" value={form.bio} onChange={set("bio")} placeholder="Tell clients about your expertise, background and what makes you unique…" required />
          </Card>
          <Card>
            <Field label="Skills (comma-separated) *" value={form.skills} onChange={set("skills")} placeholder="React, Node.js, Figma, GST, etc." required />
            <Field label="Hourly Rate (₹)" value={form.hourly_rate} onChange={set("hourly_rate")} placeholder="e.g. 1500" type="number" icon={IndianRupee} />
          </Card>
          <Card>
            <Row><Field label="Email *" value={form.contact_email} onChange={set("contact_email")} type="email" required icon={Mail} /><Field label="Phone" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" icon={Phone} /></Row>
            <Row><Field label="LinkedIn" value={form.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/yourname" icon={Globe} /><Field label="Portfolio / Website" value={form.portfolio} onChange={set("portfolio")} placeholder="yourportfolio.com" icon={Globe} /></Row>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-white/60 mb-1">Profile / Work Photos</p>
            <p className="text-xs text-white/30 mb-3">Upload your profile picture or portfolio work samples</p>
            {userId && (
              <PhotoUpload userId={userId} folder="freelancers" maxPhotos={6} onUrlsChange={setPhotoUrls} accentColor="blue" />
            )}
          </Card>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Users className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Freelancer Profile"}
          </button>
        </form>
      </div>
      <FormStyles />
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">{children}</div>; }
function Row({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Field({ label, value, onChange, placeholder = "", type = "text", required = false, icon: Icon }: any) { return <div><label className="label">{label}</label><div className="relative">{Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}<input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${Icon ? "pl-9" : ""}`} /></div></div>; }
function Textarea({ label, value, onChange, placeholder = "", required = false }: any) { return <div><label className="label">{label}</label><textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={4} className="input resize-none" /></div>; }
function FormStyles() { return <style>{`.label{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}.input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;font-size:13px;color:white;outline:none;transition:border-color 0.2s}.input::placeholder{color:rgba(255,255,255,0.2)}.input:focus{border-color:rgba(59,130,246,0.4)}`}</style>; }
