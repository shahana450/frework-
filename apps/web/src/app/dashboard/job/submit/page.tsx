"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Briefcase, ArrowLeft, CheckCircle, MapPin, Mail, IndianRupee } from "lucide-react";

const JOB_TYPES = ["Full Time","Part Time","Contract","Freelance","Internship","Remote"];
const EXP_LEVELS = ["Fresher","1-3 years","3-5 years","5-10 years","10+ years"];

export default function JobSubmitPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ company_name: "", job_title: "", job_type: "", location: "", city: "", salary_min: "", salary_max: "", experience_level: "", description: "", requirements: "", contact_email: "", skills: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setForm(f => ({ ...f, contact_email: session.user.email ?? "" }));
    });
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_jobs").insert({
      user_id: userId, ...form,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      status: "active",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-orange-400" /></div>
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Job Posted!</h2>
        <p className="text-white/40 text-sm mb-8">Your job listing is now live on FreWork.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center"><Briefcase className="w-6 h-6 text-orange-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Post a Job</h1>
            <p className="text-white/35 text-sm">Find the right talent for your business</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <F label="Company Name *" value={form.company_name} onChange={set("company_name")} required />
              <F label="Job Title *" value={form.job_title} onChange={set("job_title")} placeholder="e.g. React Developer" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Job Type *" value={form.job_type} onChange={set("job_type")} options={JOB_TYPES} required />
              <Sel label="Experience Level" value={form.experience_level} onChange={set("experience_level")} options={EXP_LEVELS} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai" required icon={MapPin} />
              <F label="Location type" value={form.location} onChange={set("location")} placeholder="Remote / On-site / Hybrid" />
            </div>
          </Card>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <F label="Min Salary / Month (₹)" value={form.salary_min} onChange={set("salary_min")} placeholder="e.g. 30000" type="number" icon={IndianRupee} />
              <F label="Max Salary / Month (₹)" value={form.salary_max} onChange={set("salary_max")} placeholder="e.g. 80000" type="number" icon={IndianRupee} />
            </div>
            <F label="Required Skills (comma-separated)" value={form.skills} onChange={set("skills")} placeholder="React, Node.js, Figma…" />
          </Card>
          <Card>
            <TA label="Job Description *" value={form.description} onChange={set("description")} placeholder="Describe the role, responsibilities and what a typical day looks like…" required />
            <TA label="Requirements" value={form.requirements} onChange={set("requirements")} placeholder="Qualifications, experience, skills needed…" rows={3} />
          </Card>
          <Card>
            <F label="Contact Email *" value={form.contact_email} onChange={set("contact_email")} type="email" required icon={Mail} />
          </Card>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Briefcase className="w-4 h-4" />}
            {loading ? "Posting…" : "Post Job — Free"}
          </button>
        </form>
      </div>
      <style>{`.label{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}.input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;font-size:13px;color:white;outline:none;transition:border-color 0.2s}.input::placeholder{color:rgba(255,255,255,0.2)}.input:focus{border-color:rgba(249,115,22,0.4)}`}</style>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">{children}</div>; }
function F({ label, value, onChange, placeholder="", type="text", required=false, icon:Icon }: any) { return <div><label className="label">{label}</label><div className="relative">{Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}<input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${Icon?"pl-9":""}`} /></div></div>; }
function Sel({ label, value, onChange, options, required=false }: any) { return <div><label className="label">{label}</label><select value={value} onChange={onChange} className="input" required={required}><option value="">Select</option>{options.map((o:string)=><option key={o}>{o}</option>)}</select></div>; }
function TA({ label, value, onChange, placeholder="", required=false, rows=4 }: any) { return <div><label className="label">{label}</label><textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows} className="input resize-none" /></div>; }
