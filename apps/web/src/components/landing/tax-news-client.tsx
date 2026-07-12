"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Shield } from "lucide-react";
import type { TaxNewsItem } from "@/app/api/tax-news/route";

const CATEGORY_STYLE: Record<string, { tagBg: string; tagColor: string; dotColor: string; borderUrgent?: string }> = {
  "Income Tax": { tagBg: "rgba(37,99,235,0.08)",   tagColor: "#1D4ED8", dotColor: "#2563EB" },
  GST:          { tagBg: "rgba(5,150,105,0.08)",   tagColor: "#065F46", dotColor: "#059669" },
  Compliance:   { tagBg: "rgba(184,144,58,0.10)",  tagColor: "#8C6A1E", dotColor: "#B8903A" },
  General:      { tagBg: "rgba(100,100,100,0.08)", tagColor: "#374151", dotColor: "#6B7280" },
};

const L = {
  bgCard: "#FFFFFF", text: "#1A1208", textSub: "#6B5B3E", textMuted: "#9C8B70",
  gold: "#B8903A", border: "rgba(184,144,58,0.18)", borderLight: "rgba(184,144,58,0.1)",
  shadow: "0 2px 20px rgba(139,108,50,0.07), 0 1px 3px rgba(139,108,50,0.05)",
  shadowHover: "0 12px 48px rgba(139,108,50,0.14), 0 2px 8px rgba(139,108,50,0.08)",
};

const FILTERS = ["All", "Income Tax", "GST", "Compliance"] as const;
type Filter = typeof FILTERS[number];

function formatDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return raw.slice(0, 10);
  }
}

function cleanTitle(title: string): string {
  // Google News appends " - Source Name" at the end
  return title.replace(/\s[-–]\s[^-–]{2,40}$/, "").trim();
}

export function TaxNewsClient({ items }: { items: TaxNewsItem[] }) {
  const [filter, setFilter] = useState<Filter>("All");

  const visible = items.filter(n => filter === "All" || n.category === filter);

  return (
    <>
      {/* Filter tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-5 py-2 rounded-full text-xs font-bold tracking-wide border transition-all duration-200"
            style={{
              background: filter === f ? L.gold : "transparent",
              borderColor: filter === f ? L.gold : L.border,
              color: filter === f ? "#fff" : L.textSub,
              boxShadow: filter === f ? "0 4px 14px rgba(184,144,58,0.3)" : "none",
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="popLayout">
          {visible.map(news => {
            const s = CATEGORY_STYLE[news.category] ?? CATEGORY_STYLE.General;
            return (
              <motion.div key={news.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                className="relative rounded-2xl border p-5 flex flex-col gap-3"
                style={{
                  background: L.bgCard,
                  borderColor: L.border,
                  boxShadow: L.shadow,
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = L.shadowHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = L.shadow; }}
              >
                {/* Category bar */}
                <div className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-2xl"
                  style={{ background: s.dotColor, opacity: 0.7 }} />

                <div className="flex items-start justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider"
                    style={{ background: s.tagBg, color: s.tagColor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dotColor }} />
                    {news.category}
                  </span>
                  <span className="text-[10px] whitespace-nowrap flex-shrink-0 font-medium" style={{ color: L.textMuted }}>
                    {formatDate(news.publishedAt)}
                  </span>
                </div>

                <h3 className="font-bold text-sm leading-snug line-clamp-3" style={{ color: L.text }}>
                  {cleanTitle(news.title)}
                </h3>

                {news.summary && (
                  <p className="text-xs leading-relaxed flex-1 line-clamp-3" style={{ color: L.textSub }}>
                    {news.summary}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: L.borderLight }}>
                  <span className="text-[10px] font-semibold flex items-center gap-1 truncate max-w-[60%]" style={{ color: L.textMuted }}>
                    <Shield size={9} /> {news.source}
                  </span>
                  <a href={news.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold flex-shrink-0"
                    style={{ color: s.dotColor }}>
                    Read <ExternalLink size={9} />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {visible.length === 0 && (
        <div className="text-center py-16" style={{ color: L.textMuted }}>
          <p className="text-sm">No {filter} news available right now. Check back soon.</p>
        </div>
      )}
    </>
  );
}
