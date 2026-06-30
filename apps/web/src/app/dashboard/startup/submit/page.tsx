"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Rocket, CheckCircle2, Loader2 } from "lucide-react";

const SECTORS = ["AgriTech", "FinTech", "HealthTech", "EdTech", "LegalTech", "SaaS", "D2C", "CleanTech", "Other"];
const STAGES = ["Idea", "Pre-seed", "Seed", "Pre-Series A", "Series A+"];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function SubmitStartupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    sector: SECTORS[0],
    stage: STAGES[0],
    city: "",
    founded_year: "",
    team_size: "",
    website: "",
    linkedin: "",
    video_url: "",
    deck_url: "",
    funding_ask: "",
    equity_offered: "",
    revenue: "",
    users_count: "",
    contact_email: "",
    looking_for: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setForm(f => ({ ...f, contact_email: session.user.email ?? "" }));
    });
  }, [router]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.tagline || !form.sector) { setError("Name, tagline and sector are required."); return; }
    setLoading(true); setError("");

    const slug = slugify(form.name) + "-" + Math.random().toString(36).slice(2, 6);
    const { error: err } = await supabase.from("fw_startups").insert({
      user_id: userId,
      slug,
      ...form,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      team_size: form.team_size ? parseInt(form.team_size) : null,
      status: "pending",
    });

    if (err) { setError("Something went wrong. Please try again."); setLoading(false); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Startup submitted!
          </h2>
          <p className="text-white/45 mb-8 leading-relaxed">
            We'll review your listing and it'll go live within 24 hours. You'll get an email once it's approved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/startups" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors">
              Browse Launchpad
            </Link>
            <Link href="/dashboard" className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm transition-colors">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060C18]">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#070D1A]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/35 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white text-sm">List your startup</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Tell us about your startup
          </h1>
          <p className="text-white/40 text-sm">Free to list. Goes live within 24 hours after review.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basics */}
          <section className="rounded-2xl border border-white/6 bg-[#070D1A] p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Basics</h2>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Startup name *</label>
              <input value={form.name} onChange={set("name")} placeholder="e.g. GreenCart" required
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">One-line tagline *</label>
              <input value={form.tagline} onChange={set("tagline")} placeholder="What you do, for whom, and why it matters" required
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Full description</label>
              <textarea value={form.description} onChange={set("description")} rows={5}
                placeholder="Problem you're solving, your solution, business model, team background…"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Sector *</label>
                <select value={form.sector} onChange={set("sector")} className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white text-sm focus:outline-none focus:border-blue-500/50">
                  {SECTORS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Stage *</label>
                <select value={form.stage} onChange={set("stage")} className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white text-sm focus:outline-none focus:border-blue-500/50">
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">City</label>
                <input value={form.city} onChange={set("city")} placeholder="Mumbai"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Founded year</label>
                <input value={form.founded_year} onChange={set("founded_year")} placeholder="2024" type="number"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Team size</label>
                <input value={form.team_size} onChange={set("team_size")} placeholder="3" type="number"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>
          </section>

          {/* Media */}
          <section className="rounded-2xl border border-white/6 bg-[#070D1A] p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Media</h2>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Founder video URL</label>
              <input value={form.video_url} onChange={set("video_url")} placeholder="YouTube or Vimeo link — 90-second pitch"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Pitch deck URL</label>
              <input value={form.deck_url} onChange={set("deck_url")} placeholder="Google Drive, Docsend or any public link"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </section>

          {/* Fundraising */}
          <section className="rounded-2xl border border-white/6 bg-[#070D1A] p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Fundraising</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Amount seeking</label>
                <input value={form.funding_ask} onChange={set("funding_ask")} placeholder="e.g. ₹50L or $200K"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Equity offered</label>
                <input value={form.equity_offered} onChange={set("equity_offered")} placeholder="e.g. 10%"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Revenue / MRR</label>
                <input value={form.revenue} onChange={set("revenue")} placeholder="e.g. ₹2L MRR or Pre-revenue"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Users / Customers</label>
                <input value={form.users_count} onChange={set("users_count")} placeholder="e.g. 500 users"
                  className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Looking for</label>
              <input value={form.looking_for} onChange={set("looking_for")} placeholder="e.g. Angel investor, co-founder (tech), early B2B customers"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </section>

          {/* Links */}
          <section className="rounded-2xl border border-white/6 bg-[#070D1A] p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Links & contact</h2>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Website</label>
              <input value={form.website} onChange={set("website")} placeholder="https://yoursite.com"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">LinkedIn</label>
              <input value={form.linkedin} onChange={set("linkedin")} placeholder="LinkedIn company page URL"
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Contact email *</label>
              <input value={form.contact_email} onChange={set("contact_email")} placeholder="founder@startup.com" type="email" required
                className="w-full px-4 py-3 rounded-xl bg-[#060C18] border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </section>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-4">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {loading ? "Submitting…" : "Submit startup"}
            </button>
            <p className="text-xs text-white/25">Free listing · Live within 24 hours</p>
          </div>
        </form>
      </main>
    </div>
  );
}
