import Link from "next/link";
import { Bell, ExternalLink, Shield, RefreshCw, Rss } from "lucide-react";
import type { TaxNewsItem } from "@/app/api/tax-news/route";
import { TaxNewsClient } from "./tax-news-client";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online").replace(/^﻿/, "");
const SUPPORT_WA = "918590874681";

// Fetch on the server — ISR revalidates every hour
async function fetchTaxNews(): Promise<{ items: TaxNewsItem[]; fetchedAt: string }> {
  try {
    const res = await fetch(`${APP_URL}/api/tax-news`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("failed");
    return res.json();
  } catch {
    return { items: [], fetchedAt: new Date().toISOString() };
  }
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(h / 24);
    if (d > 6) return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    if (d >= 1) return `${d}d ago`;
    if (h >= 1) return `${h}h ago`;
    return "Just now";
  } catch {
    return "";
  }
}

const CATEGORY_STYLE: Record<string, { tagBg: string; tagColor: string; dotColor: string }> = {
  "Income Tax": { tagBg: "rgba(37,99,235,0.08)", tagColor: "#1D4ED8", dotColor: "#2563EB" },
  GST:          { tagBg: "rgba(5,150,105,0.08)",  tagColor: "#065F46",  dotColor: "#059669" },
  Compliance:   { tagBg: "rgba(184,144,58,0.10)", tagColor: "#8C6A1E",  dotColor: "#B8903A" },
  General:      { tagBg: "rgba(100,100,100,0.08)", tagColor: "#374151", dotColor: "#6B7280" },
};

export async function TaxNewsSection() {
  const { items, fetchedAt } = await fetchTaxNews();

  const L = {
    bg: "#FAFAF5", bgAlt: "#F4EFE6", bgCard: "#FFFFFF",
    text: "#1A1208", textSub: "#6B5B3E", textMuted: "#9C8B70",
    gold: "#B8903A", goldLight: "#E8C97A", goldDark: "#8C6A1E",
    border: "rgba(184,144,58,0.18)", borderLight: "rgba(184,144,58,0.1)",
    shadow: "0 2px 20px rgba(139,108,50,0.07), 0 1px 3px rgba(139,108,50,0.05)",
  };

  return (
    <section className="py-24 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
      <div className="container max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border mb-4"
            style={{ background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)", color: "#B91C1C" }}>
            <Rss size={11} className="animate-pulse" />
            LIVE TAX &amp; REGULATORY NEWS
          </div>
          <h2 className="font-black mb-3 leading-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", color: L.text }}>
            Stay ahead of deadlines &amp; rule changes
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: L.textSub }}>
            Latest updates on Income Tax, GST &amp; compliance — auto-refreshed every hour from official sources.
          </p>
          {fetchedAt && (
            <p className="text-xs mt-2 flex items-center justify-center gap-1" style={{ color: L.textMuted }}>
              <RefreshCw size={10} /> Updated {timeAgo(fetchedAt)}
            </p>
          )}
        </div>

        {/* Client-side filter + grid */}
        {items.length > 0 ? (
          <TaxNewsClient items={items} />
        ) : (
          <FallbackCards />
        )}

        {/* Bottom CTA strip */}
        <div className="mt-10 rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: L.bgAlt, borderColor: L.border }}>
          <div>
            <p className="font-bold text-sm" style={{ color: L.text }}>Never miss a tax deadline again</p>
            <p className="text-xs mt-0.5" style={{ color: L.textSub }}>
              FreWork tracks your GST, ITR &amp; ROC deadlines and sends WhatsApp reminders.
            </p>
          </div>
          <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20please%20set%20up%20tax%20deadline%20reminders%20for%20me`}
            target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: `linear-gradient(135deg, #E8C97A, #B8903A)`, color: "#fff", boxShadow: "0 4px 14px rgba(184,144,58,0.3)" }}>
            <Bell size={14} /> Get Free Reminders
          </a>
        </div>
      </div>
    </section>
  );
}

// Shown while live feed is empty / loading
function FallbackCards() {
  const FALLBACK: Array<{ category: TaxNewsItem["category"]; title: string; summary: string; source: string }> = [
    { category: "Income Tax", title: "ITR Filing Deadline: July 31, 2025", summary: "Last date to file Income Tax Returns for AY 2025-26 for individuals and non-audit cases. Late filing attracts ₹5,000 penalty.", source: "Income Tax Dept." },
    { category: "GST", title: "GSTR-3B Due: 20th Monthly / 22nd–24th QRMP", summary: "Monthly filers must file by 20th each month. QRMP scheme filers: due on 22nd/24th based on state. Reconcile ITC with GSTR-2B.", source: "GST Council" },
    { category: "Compliance", title: "MCA Annual Filing: AOC-4 & MGT-7 Due Oct–Nov", summary: "Private Limited companies must file AOC-4 (30 days) & MGT-7 (60 days) from AGM. AGM must be held by September 30. ₹100/day late fee.", source: "MCA / ROC" },
  ];

  const L = {
    bgCard: "#FFFFFF", text: "#1A1208", textSub: "#6B5B3E", textMuted: "#9C8B70",
    border: "rgba(184,144,58,0.18)", borderLight: "rgba(184,144,58,0.1)",
    shadow: "0 2px 20px rgba(139,108,50,0.07)",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {FALLBACK.map((item, i) => {
        const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.General;
        return (
          <div key={i} className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{ background: L.bgCard, borderColor: L.border, boxShadow: L.shadow }}>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider"
                style={{ background: s.tagBg, color: s.tagColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dotColor }} />
                {item.category}
              </span>
            </div>
            <h3 className="font-bold text-sm leading-snug" style={{ color: L.text }}>{item.title}</h3>
            <p className="text-xs leading-relaxed flex-1" style={{ color: L.textSub }}>{item.summary}</p>
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: L.borderLight }}>
              <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: L.textMuted }}>
                <Shield size={9} /> {item.source}
              </span>
              <Link href="/services/compliance"
                className="inline-flex items-center gap-1 text-[11px] font-bold"
                style={{ color: s.dotColor }}>
                Get help <ExternalLink size={9} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
