"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, LogIn, UserPlus, X, ChevronRight, Bell } from "lucide-react";
import type { TaxNewsItem } from "@/app/api/tax-news/route";

// Fallback headlines if API hasn't loaded yet
const FALLBACK_HEADLINES = [
  { id: "f1", category: "Income Tax" as const, title: "ITR Deadline: July 31, 2025 — File your AY 2025-26 return before the due date to avoid ₹5,000 penalty", url: "#" },
  { id: "f2", category: "GST" as const, title: "GSTR-3B Due: 20th each month for monthly filers — Reconcile ITC with GSTR-2B before filing", url: "#" },
  { id: "f3", category: "Compliance" as const, title: "New Tax Regime is default from FY 2024-25 — Submit Form 10-IEA to opt for Old Regime", url: "#" },
  { id: "f4", category: "GST" as const, title: "E-Invoice mandatory above ₹5 Crore turnover — IRP-generated IRN required for all B2B invoices", url: "#" },
  { id: "f5", category: "Compliance" as const, title: "MCA Annual Filing: AOC-4 & MGT-7 due Oct–Nov 2025 — AGM by September 30", url: "#" },
];

const CAT_COLOR: Record<string, string> = {
  "Income Tax": "#2563EB",
  GST:          "#059669",
  Compliance:   "#B8903A",
  General:      "#6B7280",
};

export function AnnouncementTicker() {
  const [headlines, setHeadlines] = useState<Array<{ id: string; category: string; title: string; url: string }>>(FALLBACK_HEADLINES);
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch live headlines
  useEffect(() => {
    fetch("/api/tax-news")
      .then(r => r.json())
      .then((data: { items: TaxNewsItem[] }) => {
        if (data.items?.length > 0) {
          setHeadlines(data.items.map(i => ({
            id: i.id,
            category: i.category,
            title: i.title.replace(/\s[-–]\s[^-–]{2,40}$/, ""),
            url: i.url,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % headlines.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [headlines.length]);

  if (dismissed) return null;

  const item = headlines[current];
  const catColor = CAT_COLOR[item?.category ?? "General"] ?? "#6B7280";

  return (
    <div
      className="fixed top-0 inset-x-0 z-[70] w-full select-none"
      style={{
        background: "linear-gradient(135deg, #1A1208 0%, #2C1F0A 50%, #1A1208 100%)",
        borderBottom: "1px solid rgba(184,144,58,0.3)",
      }}
    >
      {/* Subtle shimmer line */}
      <div className="absolute inset-x-0 top-0 h-[1.5px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, #B8903A 30%, #E8C97A 50%, #B8903A 70%, transparent 100%)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-4 h-14">

        {/* Left: LIVE badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black tracking-widest"
            style={{ background: "rgba(220,38,38,0.9)", color: "#fff" }}>
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
          <Bell size={14} style={{ color: "#B8903A" }} />
        </div>

        {/* Separator */}
        <div className="w-px h-6 flex-shrink-0" style={{ background: "rgba(184,144,58,0.3)" }} />

        {/* Scrolling headline */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={item?.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <span className="flex-shrink-0 text-[11px] font-black tracking-wider px-2 py-0.5 rounded"
                style={{ background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}40` }}>
                {item?.category}
              </span>
              <a
                href={item?.url && item.url !== "#" ? item.url : undefined}
                target={item?.url && item.url !== "#" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="text-[13px] font-medium leading-snug truncate transition-colors hover:text-white cursor-pointer"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {item?.title}
              </a>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot navigation */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {headlines.slice(0, Math.min(headlines.length, 6)).map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); if (intervalRef.current) clearInterval(intervalRef.current); }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                background: i === current ? "#B8903A" : "rgba(184,144,58,0.3)",
              }}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-6 flex-shrink-0" style={{ background: "rgba(184,144,58,0.3)" }} />

        {/* Auth buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Link href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <LogIn size={13} />
            Login
          </Link>
          <Link href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all"
            style={{
              background: "linear-gradient(135deg, #E8C97A, #B8903A)",
              color: "#1A1208",
              boxShadow: "0 2px 10px rgba(184,144,58,0.45)",
            }}>
            <UserPlus size={13} />
            <span className="hidden xs:inline">Sign Up</span>
            <span className="xs:hidden">Free</span>
          </Link>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded transition-colors hover:bg-white/10 ml-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
