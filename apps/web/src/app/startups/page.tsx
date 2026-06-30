"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Rocket, Search, ArrowRight, Play, FileText, MapPin, ExternalLink, Mail } from "lucide-react";

const SECTORS = ["All", "AgriTech", "FinTech", "HealthTech", "EdTech", "LegalTech", "SaaS", "D2C", "CleanTech", "Other"];
const STAGES = ["All stages", "Idea", "Pre-seed", "Seed", "Pre-Series A", "Series A+"];

interface Startup {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  sector: string;
  stage: string;
  city: string;
  funding_ask: string;
  video_url: string;
  deck_url: string;
  team_size: number;
  logo_url: string;
  status: string;
}

export default function StartupsPage() {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [stage, setStage] = useState("All stages");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("fw_startups")
        .select("*")
        .eq("status", "live")
        .order("created_at", { ascending: false });
      setStartups(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = startups.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.tagline.toLowerCase().includes(search.toLowerCase());
    const matchSector = sector === "All" || s.sector === sector;
    const matchStage = stage === "All stages" || s.stage === stage;
    return matchSearch && matchSector && matchStage;
  });

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-[#060C18] pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(59,130,246,0.08),transparent)]" />
        <div className="container mx-auto px-4 relative z-10 max-w-5xl text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/25 bg-blue-500/8 text-blue-400 text-xs font-semibold tracking-widest uppercase mb-8">
            FIND · Startup Launchpad
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            India&apos;s next big thing<br />
            <span className="text-white/30">starts here.</span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Discover startups across India — watch founder pitches, browse decks, and connect directly with builders.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard/startup/submit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
              <Rocket className="w-4 h-4" /> List your startup
            </Link>
            <a href="#browse"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white/70 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
              Browse startups <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#070D1A] border-y border-white/6">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-3 divide-x divide-white/6">
            {[
              { label: "Startups listed", value: startups.length || "0" },
              { label: "Sectors covered", value: "10+" },
              { label: "Be the first", value: "🚀" },
            ].map(s => (
              <div key={s.label} className="py-6 text-center">
                <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-xs text-white/35">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse */}
      <section id="browse" className="py-20 bg-[#060C18]">
        <div className="container mx-auto px-4 max-w-5xl">

          {/* Search + filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, sector or keyword…"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#070D1A] border border-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <select value={stage} onChange={e => setStage(e.target.value)}
              className="px-4 py-3 rounded-xl bg-[#070D1A] border border-white/8 text-white/60 text-sm focus:outline-none focus:border-blue-500/50">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={sector} onChange={e => setSector(e.target.value)}
              className="px-4 py-3 rounded-xl bg-[#070D1A] border border-white/8 text-white/60 text-sm focus:outline-none focus:border-blue-500/50">
              {SECTORS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Sector pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {SECTORS.map(s => (
              <button key={s} onClick={() => setSector(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sector === s ? "bg-blue-600 text-white" : "border border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/6 bg-[#070D1A] py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-center mx-auto mb-5">
                <Rocket className="w-7 h-7 text-blue-400/50" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
                {search || sector !== "All" || stage !== "All stages" ? "No results found" : "Be the first on the launchpad"}
              </h3>
              <p className="text-white/35 text-sm mb-7 max-w-sm mx-auto">
                {search || sector !== "All" || stage !== "All stages"
                  ? "Try a different search or filter."
                  : "No startups listed yet. If you're building something, list it here — it's free."}
              </p>
              <Link href="/dashboard/startup/submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors">
                <Rocket className="w-4 h-4" /> List your startup
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(s => (
                <Link key={s.id} href={`/startups/${s.slug}`}
                  className="flex gap-4 items-start rounded-2xl border border-white/6 bg-[#070D1A] p-5 hover:border-blue-500/25 transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center flex-shrink-0 text-lg font-bold text-blue-400">
                    {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover rounded-xl" /> : s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{s.name}</h3>
                      <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                    </div>
                    <p className="text-sm text-white/45 mb-3 leading-snug">{s.tagline}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/15 text-blue-400">{s.stage}</span>
                      <span className="text-xs px-2.5 py-1 rounded-full border border-white/8 text-white/35">{s.sector}</span>
                      {s.city && <span className="text-xs px-2.5 py-1 rounded-full border border-white/8 text-white/35 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}</span>}
                      {s.funding_ask && <span className="text-xs px-2.5 py-1 rounded-full border border-white/8 text-white/35">Seeking {s.funding_ask}</span>}
                      {s.video_url && <span className="text-xs px-2.5 py-1 rounded-full border border-white/8 text-white/35 flex items-center gap-1"><Play className="w-3 h-3" />Video</span>}
                      {s.deck_url && <span className="text-xs px-2.5 py-1 rounded-full border border-white/8 text-white/35 flex items-center gap-1"><FileText className="w-3 h-3" />Deck</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why list */}
      <section className="py-20 bg-[#070D1A] border-t border-white/6">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Why list on FreWork Launchpad?</h2>
            <div className="w-12 h-px bg-blue-500/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Search, title: "Get discovered", body: "Investors, customers and co-founders actively browse. Your listing works 24/7." },
              { icon: Play, title: "Show, don't just tell", body: "Embed your founder video, share your pitch deck and tell your story in full." },
              { icon: FileText, title: "CA-verified badge", body: "Let FreWork's CA team verify your financials — builds instant credibility with investors." },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border border-white/6 bg-[#060C18] p-6 hover:border-blue-500/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#060C18] border-t border-white/6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Ready to launch?</h2>
          <p className="text-white/40 mb-8">Free to list. Takes 10 minutes. Your startup, in front of the right people.</p>
          <Link href="/dashboard/startup/submit"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
            List your startup <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
