"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Users, Globe, Linkedin, Play, FileText,
  Mail, Rocket, ExternalLink, CheckCircle2, Calendar
} from "lucide-react";

interface Startup {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  sector: string;
  stage: string;
  city: string;
  founded_year: number;
  team_size: number;
  website: string;
  linkedin: string;
  video_url: string;
  deck_url: string;
  funding_ask: string;
  equity_offered: string;
  revenue: string;
  users_count: string;
  logo_url: string;
  contact_email: string;
  looking_for: string;
  created_at: string;
}

function getYoutubeEmbed(url: string) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export default function StartupProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [startup, setStartup] = useState<Startup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("fw_startups")
        .select("*")
        .eq("slug", slug)
        .eq("status", "live")
        .single();
      if (!data) { router.replace("/startups"); return; }
      setStartup(data);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!startup) return null;
  const embedUrl = getYoutubeEmbed(startup.video_url);

  return (
    <PageLayout>
      <div className="bg-[#060C18] min-h-screen">
        <div className="container mx-auto px-4 max-w-5xl py-28">

          {/* Back */}
          <Link href="/startups" className="inline-flex items-center gap-1.5 text-sm text-white/35 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Launchpad
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">

            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">

              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl font-bold text-blue-400 flex-shrink-0">
                  {startup.logo_url
                    ? <img src={startup.logo_url} alt={startup.name} className="w-full h-full object-cover rounded-2xl" />
                    : startup.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>{startup.name}</h1>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">{startup.stage}</span>
                  </div>
                  <p className="text-white/50">{startup.tagline}</p>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/30">
                    {startup.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{startup.city}</span>}
                    {startup.sector && <span>{startup.sector}</span>}
                    {startup.team_size && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{startup.team_size} people</span>}
                    {startup.founded_year && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Founded {startup.founded_year}</span>}
                  </div>
                </div>
              </div>

              {/* Video */}
              {embedUrl && (
                <div className="rounded-2xl overflow-hidden border border-white/6 aspect-video">
                  <iframe src={embedUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              )}

              {/* About */}
              {startup.description && (
                <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-6">
                  <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-widest text-white/40">About</h2>
                  <p className="text-white/60 leading-relaxed whitespace-pre-line">{startup.description}</p>
                </div>
              )}

              {/* Deck */}
              {startup.deck_url && (
                <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-6">
                  <h2 className="font-semibold text-sm uppercase tracking-widest text-white/40 mb-4">Pitch Deck</h2>
                  <a href={startup.deck_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-blue-500/25 text-blue-400 text-sm hover:bg-blue-500/8 transition-colors">
                    <FileText className="w-4 h-4" /> View pitch deck <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Traction */}
              {(startup.revenue || startup.users_count) && (
                <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-6">
                  <h2 className="font-semibold text-sm uppercase tracking-widest text-white/40 mb-4">Traction</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {startup.revenue && (
                      <div>
                        <div className="text-xl font-bold text-white">{startup.revenue}</div>
                        <div className="text-xs text-white/35">Revenue / MRR</div>
                      </div>
                    )}
                    {startup.users_count && (
                      <div>
                        <div className="text-xl font-bold text-white">{startup.users_count}</div>
                        <div className="text-xs text-white/35">Users / Customers</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">

              {/* Funding */}
              {(startup.funding_ask || startup.equity_offered) && (
                <div className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/4 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]/60 mb-3">Fundraising</h3>
                  {startup.funding_ask && (
                    <div className="mb-2">
                      <div className="text-xl font-bold text-white">{startup.funding_ask}</div>
                      <div className="text-xs text-white/35">Amount seeking</div>
                    </div>
                  )}
                  {startup.equity_offered && (
                    <div>
                      <div className="text-lg font-bold text-white">{startup.equity_offered}</div>
                      <div className="text-xs text-white/35">Equity offered</div>
                    </div>
                  )}
                </div>
              )}

              {/* Looking for */}
              {startup.looking_for && (
                <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Looking for</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{startup.looking_for}</p>
                </div>
              )}

              {/* Connect */}
              <div className="rounded-2xl border border-white/6 bg-[#070D1A] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Connect</h3>
                {startup.contact_email && (
                  <a href={`mailto:${startup.contact_email}`}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                    <Mail className="w-4 h-4" /> Send a message
                  </a>
                )}
                {startup.website && (
                  <a href={startup.website} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 text-white/50 hover:text-white text-sm transition-colors">
                    <Globe className="w-4 h-4" /> Visit website
                  </a>
                )}
                {startup.linkedin && (
                  <a href={startup.linkedin} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 text-white/50 hover:text-white text-sm transition-colors">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
              </div>

              {/* FreWork CA services promo */}
              <div className="rounded-2xl border border-[#C9A84C]/15 bg-[#C9A84C]/4 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]/60 mb-2">FreWork GROW</h3>
                <p className="text-xs text-white/40 leading-relaxed mb-3">Need compliance, a DPR or a polished pitch deck for this startup?</p>
                <Link href="/services/compliance"
                  className="inline-flex items-center gap-1.5 text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors">
                  Explore CA services <ArrowLeft className="w-3 h-3 rotate-180" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
