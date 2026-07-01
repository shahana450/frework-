"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { TrendingUp, ArrowLeft, CheckCircle, Phone, Mail, Globe, IndianRupee } from "lucide-react";
import { Suspense } from "react";

const SERVICE_TYPES = ["CA/CS & Compliance","GST Filing & Advisory","Income Tax & Audit","Company Registration","DPR & Business Plan","Pitch Deck & Presentation","Business Restructuring","M&A Advisory","Corporate Training","MSME Advisory","Other"];

function ServiceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ provider_name: "", qualification: "", service_type: params.get("type") ?? "", description: "", price_from: "", price_to: "", delivery_days: "", contact_email: "", contact_phone: "", website: "", linkedin: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setForm(f => ({ ...f, provider_name: session.user.user_metadata?.full_name ?? "", contact_email: session.user.email ?? "" }));
    });
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    await supabase.from("fw_services").insert({
      user_id: userId, ...form,
      price_from: form.price_from ? parseInt(form.price_from) : null,
      price_to: form.price_to ? parseInt(form.price_to) : null,
      delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
      status: "pending",
    });
    setLoading(false);
    setSuccess(true);
  };

  if (success) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-[#C9A84C]" /></div>
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>Service Listed!</h2>
        <p className="text-white/40 text-sm mb-8">Your service will be reviewed and go live within 24 hours.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[#0B1120] font-semibold text-sm transition-colors" style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-[#C9A84C]" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Offer a GROW Service</h1>
            <p className="text-white/35 text-sm">CA/CS, tax, compliance, training or consulting service</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <F label="Your Name / Firm *" value={form.provider_name} onChange={set("provider_name")} required />
              <F label="Qualifications" value={form.qualification} onChange={set("qualification")} placeholder="CA, CS, MBA, B.Com…" />
            </div>
            <Sel label="Service Type *" value={form.service_type} onChange={set("service_type")} options={SERVICE_TYPES} required />
            <TA label="Service Description *" value={form.description} onChange={set("description")} placeholder="Describe exactly what you offer, your process, deliverables, and who it's for…" required />
          </Card>
          <Card>
            <div className="grid grid-cols-3 gap-3">
              <F label="Starting Price (₹)" value={form.price_from} onChange={set("price_from")} placeholder="e.g. 999" type="number" icon={IndianRupee} />
              <F label="Max Price (₹)" value={form.price_to} onChange={set("price_to")} placeholder="e.g. 9999" type="number" icon={IndianRupee} />
              <F label="Delivery (days)" value={form.delivery_days} onChange={set("delivery_days")} placeholder="e.g. 7" type="number" />
            </div>
          </Card>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <F label="Email *" value={form.contact_email} onChange={set("contact_email")} type="email" required icon={Mail} />
              <F label="Phone" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" icon={Phone} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Website" value={form.website} onChange={set("website")} placeholder="yourfirm.com" icon={Globe} />
              <F label="LinkedIn" value={form.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" icon={Globe} />
            </div>
          </Card>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-[#0B1120] disabled:opacity-50 transition-all flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
            {loading ? <span className="w-4 h-4 border-2 border-[#0B1120] border-t-transparent rounded-full animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {loading ? "Submitting…" : "List My Service — Free"}
          </button>
        </form>
      </div>
      <style>{`.label{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}.input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;font-size:13px;color:white;outline:none;transition:border-color 0.2s}.input::placeholder{color:rgba(255,255,255,0.2)}.input:focus{border-color:rgba(201,168,76,0.4)}`}</style>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">{children}</div>; }
function F({ label, value, onChange, placeholder="", type="text", required=false, icon:Icon }: any) { return <div><label className="label">{label}</label><div className="relative">{Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}<input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${Icon?"pl-9":""}`} /></div></div>; }
function Sel({ label, value, onChange, options, required=false }: any) { return <div><label className="label">{label}</label><select value={value} onChange={onChange} className="input" required={required}><option value="">Select</option>{options.map((o:string)=><option key={o}>{o}</option>)}</select></div>; }
function TA({ label, value, onChange, placeholder="", required=false }: any) { return <div><label className="label">{label}</label><textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={4} className="input resize-none" /></div>; }

export default function ServiceSubmitPage() {
  return <Suspense><ServiceForm /></Suspense>;
}
