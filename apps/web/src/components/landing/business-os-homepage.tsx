"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AnnouncementTicker } from "@/components/landing/announcement-ticker";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, FileText, IndianRupee, Users, TrendingUp, MapPin, Rocket, LayoutDashboard,
  ArrowRight, ChevronRight, ChevronDown, MessageCircle, Search, Shield, Clock, Star,
  Briefcase, BarChart3, Presentation, GraduationCap, Phone, Zap, Check, X,
  CalendarCheck, FileCheck, BadgeCheck, Banknote, Landmark, UserCheck,
  Coffee, Wifi, Car, Printer, AirVent, Lock,
} from "lucide-react";

const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+91 85908 74681").replace(/^ï»¿/, "");
const SUPPORT_WA = `918590874681`;

const L = {
  bg: "#FFFFFF",
  bgAlt: "#F8FAFC",
  bgCard: "#FFFFFF",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  gold: "#1E40AF",
  goldLight: "#3B82F6",
  goldDark: "#1E3A8A",
  border: "rgba(15,32,68,0.1)",
  borderLight: "rgba(15,32,68,0.06)",
  shadow: "0 1px 3px rgba(15,32,68,0.08), 0 1px 2px rgba(15,32,68,0.04)",
  shadowHover: "0 10px 40px rgba(15,32,68,0.12), 0 2px 8px rgba(15,32,68,0.06)",
};

const MODULES = [
  {
    id: "start", label: "START", tagline: "Register & Set Up", emoji: "🏢",
    desc: "Get your business legally incorporated in India – fast, affordable, and fully online.",
    icon: Building2, color: "#059669", href: "/services/compliance", badge: "Most Popular",
    items: ["Company Registration", "GST Registration", "PAN & TAN", "MSME / Udyam"],
    detail: {
      heading: "Everything to start your business",
      why: "Starting a business in India involves multiple government registrations. FreWork handles all of them end-to-end, so you can focus on building your product.",
      steps: ["Fill a simple online form", "Upload your documents", "Our experts file with the government", "Get your certificates in 3–7 days"],
      pricing: "Starting ₹1,499",
      time: "3–7 working days",
      features: [
        { icon: Building2, text: "Private Limited, LLP, OPC, Sole Prop, Partnership" },
        { icon: FileCheck, text: "GST registration included with company setup" },
        { icon: BadgeCheck, text: "MSME / Udyam certificate for government benefits" },
        { icon: CalendarCheck, text: "PAN & TAN for tax identity" },
      ],
    },
  },
  {
    id: "comply", label: "COMPLY", tagline: "Stay Compliant", emoji: "📋",
    desc: "Income Tax, GST filing, ROC – never miss a deadline with our compliance calendar.",
    icon: FileText, color: "#2563EB", href: "/services/compliance", badge: null,
    items: ["Income Tax (ITR)", "GST Filing", "ROC / MCA", "TDS Filing"],
    detail: {
      heading: "Never miss a compliance deadline",
      why: "Penalties for missed GST or ITR filings can be severe. FreWork tracks every deadline for you and files returns accurately and on time.",
      steps: ["Share your data or grant portal access", "We reconcile and prepare returns", "You approve before filing", "Acknowledgement delivered instantly"],
      pricing: "Starting ₹499/filing",
      time: "24–48 hrs turnaround",
      features: [
        { icon: FileText, text: "GSTR-1, GSTR-3B, Annual Return" },
        { icon: Landmark, text: "ITR-1 to ITR-6 for all business types" },
        { icon: CalendarCheck, text: "ROC / MCA annual filings & DIR-3 KYC" },
        { icon: Banknote, text: "TDS deduction, challan & quarterly returns" },
      ],
    },
  },
  {
    id: "finance", label: "FINANCE", tagline: "Manage Money", emoji: "💰",
    desc: "Invoicing, payroll, bookkeeping – keep your finances clean and audit-ready.",
    icon: IndianRupee, color: "#7C3AED", href: "/pricing", badge: "Coming Soon",
    items: ["Invoicing", "Payroll", "Bookkeeping", "Reports"],
    detail: {
      heading: "Your finance team, built in",
      why: "Most SMEs lose money due to poor bookkeeping and late invoicing. FreWork gives you professional-grade finance tools without hiring a full-time accountant.",
      steps: ["Connect your bank account", "Auto-categorize transactions", "Generate GST-ready invoices", "Get monthly P&L reports"],
      pricing: "Coming soon – ₹999/mo",
      time: "Real-time updates",
      features: [
        { icon: FileText, text: "GST-compliant invoicing in seconds" },
        { icon: UserCheck, text: "Payroll processing with PF & ESI" },
        { icon: BarChart3, text: "Monthly P&L, balance sheet & MIS" },
        { icon: BadgeCheck, text: "Audit-ready books maintained by CAs" },
      ],
    },
  },
  {
    id: "professionals", label: "FIND PEOPLE", tagline: "Hire Talent", emoji: "👥",
    desc: "Verified CAs, developers, designers and consultants for your business.",
    icon: Users, color: "#D97706", href: "/freelancers", badge: "Live",
    items: ["Professionals & Lawyers", "Developers", "Designers", "Consultants"],
    detail: {
      heading: "Hire verified professionals",
      why: "Finding reliable freelance professionals in India is hard. FreWork manually verifies every professional, developer and designer before they join the platform.",
      steps: ["Post your requirement for free", "Get matched with verified profiles", "Interview and shortlist", "Hire & pay securely on platform"],
      pricing: "Free to post",
      time: "Match in 24 hrs",
      features: [
        { icon: BadgeCheck, text: "All professionals manually verified before listing" },
        { icon: UserCheck, text: "Developers & designers with portfolio review" },
        { icon: Shield, text: "Secure payments with escrow protection" },
        { icon: Star, text: "Reviews & ratings from real clients" },
      ],
    },
  },
  {
    id: "grow", label: "GROW", tagline: "Scale Up", emoji: "📈",
    desc: "Business plans, DPRs, pitch decks – the documents you need to raise money and scale.",
    icon: TrendingUp, color: "#DC2626", href: "/services/dpr", badge: null,
    items: ["DPR", "Pitch Deck", "Business Plan", "Restructuring"],
    detail: {
      heading: "Documents that open doors",
      why: "Banks and investors need specific documents before they fund you. Our experts create DPRs, pitch decks and business plans that meet institutional standards.",
      steps: ["Share your business idea & financials", "Our expert team drafts the document", "Review and revise together", "Final document delivered in PDF & PPT"],
      pricing: "Starting ₹4,999",
      time: "5–10 working days",
      features: [
        { icon: FileText, text: "Bank-grade Detailed Project Report (DPR)" },
        { icon: Presentation, text: "Investor pitch decks with financial models" },
        { icon: BarChart3, text: "3–5 year business plans with projections" },
        { icon: Building2, text: "Restructuring & turnaround advisory" },
      ],
    },
  },
  {
    id: "workspace", label: "WORKSPACE", tagline: "Find Your Office", emoji: "🏛️",
    desc: "Premium verified coworking spaces across India – by the day, month or hour.",
    icon: MapPin, color: "#EA580C", href: "/coworking", badge: "Live",
    items: ["Coworking Desks", "Private Cabins", "Meeting Rooms", "Virtual Office"],
    detail: {
      heading: "Your office, your way",
      why: "We're building India's most trusted coworking directory. Every space is personally verified by our team before it's listed – no surprises when you arrive.",
      steps: ["Browse verified spaces near you", "Choose your plan (day/month/hour)", "Book online instantly", "Walk in – your workspace is ready"],
      pricing: "From ₹350/day",
      time: "Instant booking",
      features: [
        { icon: Wifi, text: "High-speed internet guaranteed" },
        { icon: Coffee, text: "Café & refreshment facilities" },
        { icon: Car, text: "Parking included at most locations" },
        { icon: Lock, text: "24/7 access with security" },
      ],
    },
  },
  {
    id: "launch", label: "LAUNCH", tagline: "Raise Funding", emoji: "🚀",
    desc: "List your startup, connect with investors and accelerators across India.",
    icon: Rocket, color: "#4F46E5", href: "/startups", badge: "Launching Soon",
    items: ["Startup Listing", "Investor Connect", "Pitch Events", "Mentorship"],
    detail: {
      heading: "Get funded, grow faster",
      why: "India has a growing startup ecosystem but most founders don't know how to access it. FreWork connects vetted startups directly with active investors.",
      steps: ["Create your startup profile", "Get visibility to 200+ investors", "Participate in pitch events", "Close your round with legal support"],
      pricing: "Free to list",
      time: "Investor match in 7 days",
      features: [
        { icon: Rocket, text: "Startup profile visible to 200+ investors" },
        { icon: Presentation, text: "Monthly pitch events & demo days" },
        { icon: UserCheck, text: "1-on-1 mentorship from founders" },
        { icon: FileText, text: "Term sheet & legal support included" },
      ],
    },
  },
  {
    id: "dashboard", label: "DASHBOARD", tagline: "Track Everything", emoji: "📊",
    desc: "Your compliance calendar, documents, renewals and status – all in one place.",
    icon: LayoutDashboard, color: "#1E40AF", href: "/dashboard", badge: "Early Access",
    items: ["Compliance Calendar", "Document Vault", "Renewals", "Status Tracker"],
    detail: {
      heading: "Your business command center",
      why: "Most business owners forget renewal dates and lose important documents. Your FreWork dashboard keeps everything in one place with automatic reminders.",
      steps: ["All your services tracked in one place", "Auto-reminders 30 days before deadlines", "Download any document any time", "Share access with your team or CA"],
      pricing: "Free with any plan",
      time: "Real-time sync",
      features: [
        { icon: CalendarCheck, text: "GST, ITR, ROC deadlines auto-tracked" },
        { icon: FileCheck, text: "Secure document vault – always accessible" },
        { icon: MessageCircle, text: "WhatsApp alerts before every due date" },
        { icon: UserCheck, text: "Team access & CA collaboration portal" },
      ],
    },
  },
];

const TRUST_TICKER = ["Company Registration", "GST Filing", "Income Tax Returns", "Coworking Spaces", "Hire Professionals", "Pitch Decks", "Startup Funding", "Business Plans", "MSME Registration", "ROC Compliance"];

const COWORK_PLANS = [
  { key: "hotdesk", emoji: "💻", label: "Hot Desk", price: "₹350", per: "/day", desc: "Open seating in a vibrant coworking hall. Perfect for freelancers and remote workers who need a productive space with all amenities." },
  { key: "cabin", emoji: "🚪", label: "Private Cabin", price: "₹8,000", per: "/month", desc: "Dedicated private cabin with lockable door. Ideal for small teams of 2–6 people who need focus and confidentiality." },
  { key: "meeting", emoji: "📅", label: "Meeting Room", price: "₹500", per: "/hour", desc: "Fully equipped meeting room with projector, whiteboard and video conferencing. Book by the hour for client presentations." },
  { key: "virtual", emoji: "🌐", label: "Virtual Office", price: "₹999", per: "/month", desc: "Premium business address, GST registration address, mail handling and call answering. Look professional without a physical office." },
];

function GoldDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-4">
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${L.gold})` }} />
      <div className="w-1 h-1 rounded-full" style={{ background: L.gold, opacity: 0.5 }} />
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, ${L.gold}, transparent)` }} />
    </div>
  );
}

export function BusinessOSHomepage() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("hotdesk");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [billingYearly, setBillingYearly] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const moduleDetailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoggedIn(true);
        setUserName(session.user.user_metadata?.full_name?.split(" ")[0] ?? session.user.email?.split("@")[0] ?? "");
      }
    });
  }, []);

  const handleModuleClick = (id: string) => {
    if (expandedModule === id) {
      setExpandedModule(null);
    } else {
      setExpandedModule(id);
      setTimeout(() => moduleDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes("gst") || q.includes("tax") || q.includes("itr") || q.includes("register")) window.location.href = "/services/compliance";
    else if (q.includes("freelanc") || q.includes("ca ") || q.includes("developer")) window.location.href = "/freelancers";
    else if (q.includes("cowork") || q.includes("office") || q.includes("space")) window.location.href = "/coworking";
    else if (q.includes("startup") || q.includes("invest") || q.includes("funding")) window.location.href = "/startups";
    else if (q.includes("pitch") || q.includes("dpr") || q.includes("plan")) window.location.href = "/services/dpr";
    else window.location.href = "/contact";
  };

  const expanded = MODULES.find(m => m.id === expandedModule);
  const selectedCoworkPlan = COWORK_PLANS.find(p => p.key === selectedPlan)!;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: L.bg, color: L.text }}>
      <AnnouncementTicker />

      {/* --- HERO --- */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-44 pb-20 overflow-hidden">
        {/* Premium layered background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Base gradient */}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, #F0F4FF 0%, #FFFFFF 45%, #F8FAFF 100%)" }} />
          {/* Top blue glow */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 55% at 50% -10%, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />
          {/* Left accent */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 35% 50% at -5% 60%, rgba(99,102,241,0.07) 0%, transparent 60%)" }} />
          {/* Right accent */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 35% 50% at 105% 40%, rgba(16,185,129,0.05) 0%, transparent 60%)" }} />
          {/* Subtle dot grid */}
          <div style={{ position:"absolute", inset:0, opacity:0.025, backgroundImage:"radial-gradient(rgba(37,99,235,1) 1px, transparent 1px)", backgroundSize:"28px 28px" }} />
        </div>

        {/* -- Interactive scrolling service banners -- */}
        <div className="absolute top-[70px] inset-x-0 z-20 overflow-hidden">
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none" style={{ background:"linear-gradient(90deg,#FFFFFF,transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none" style={{ background:"linear-gradient(270deg,#FFFFFF,transparent)" }} />

          {/* Row 1 – scrolls left, pauses on hover */}
          {(() => {
            const row1 = [
              { label:"GST Registration",    icon:"📋", color:"#2563EB", bg:"rgba(37,99,235,0.09)",   href:"/services/gst" },
              { label:"Income Tax Return",   icon:"🏛️", color:"#7C3AED", bg:"rgba(124,58,237,0.09)", href:"/services/income-tax" },
              { label:"Company Registration",icon:"🏢", color:"#059669", bg:"rgba(5,150,105,0.09)",  href:"/services/business-registration" },
              { label:"Virtual Accountant",  icon:"💼", color:"#1E40AF", bg:"rgba(18,70,200,0.08)",  href:"/services/accounting" },
              { label:"Find Freelancers",    icon:"👥", color:"#EA580C", bg:"rgba(234,88,12,0.09)",  href:"/freelancers" },
              { label:"Coworking Spaces",    icon:"📍", color:"#0891B2", bg:"rgba(8,145,178,0.09)",  href:"/coworking" },
              { label:"Business Audit",      icon:"🔍", color:"#7C3AED", bg:"rgba(124,58,237,0.09)", href:"/services/audit" },
              { label:"Virtual CFO",         icon:"📊", color:"#059669", bg:"rgba(5,150,105,0.09)",  href:"/services/virtual-cfo" },
            ];
            return (
              <div className="group flex gap-3 mb-2.5 whitespace-nowrap"
                style={{ animation:"marquee 22s linear infinite" }}
                onMouseEnter={e => (e.currentTarget.style.animationPlayState="paused")}
                onMouseLeave={e => (e.currentTarget.style.animationPlayState="running")}>
                {[...Array(3)].flatMap((_, ri) => row1.map((t, i) => (
                  <Link key={`${ri}-${i}`} href={t.href}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all duration-200 cursor-pointer select-none"
                    style={{ background:t.bg, color:t.color, border:`1px solid ${t.color}22` }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform="scale(1.1) translateY(-2px)";
                      el.style.boxShadow=`0 6px 20px ${t.color}30`;
                      el.style.background=`${t.color}18`;
                      el.style.borderColor=`${t.color}50`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform="scale(1) translateY(0)";
                      el.style.boxShadow="none";
                      el.style.background=t.bg;
                      el.style.borderColor=`${t.color}22`;
                    }}>
                    <span>{t.icon}</span> {t.label}
                    <span className="text-[9px] opacity-50">&rarr;</span>
                  </Link>
                )))}
              </div>
            );
          })()}

          {/* Row 2 – scrolls right, pauses on hover */}
          {(() => {
            const row2 = [
              { label:"ROC Compliance",         icon:"✅", color:"#059669", bg:"rgba(5,150,105,0.09)",  href:"/services/roc-compliance" },
              { label:"Pitch Deck & DPR",       icon:"📈", color:"#EA580C", bg:"rgba(234,88,12,0.09)",  href:"/services/dpr" },
              { label:"Startup Funding",         icon:"🚀", color:"#7C3AED", bg:"rgba(124,58,237,0.09)", href:"/services/dpr" },
              { label:"GST Filing",              icon:"🧾", color:"#2563EB", bg:"rgba(37,99,235,0.09)",  href:"/services/gst" },
              { label:"Payroll Management",      icon:"💰", color:"#1E40AF", bg:"rgba(18,70,200,0.08)",  href:"/services/accounting" },
              { label:"Business Restructuring",  icon:"🔄", color:"#0891B2", bg:"rgba(8,145,178,0.09)",  href:"/services/restructuring" },
              { label:"Tax Audit",               icon:"🔎", color:"#7C3AED", bg:"rgba(124,58,237,0.09)", href:"/services/audit" },
              { label:"MSME Registration",       icon:"🏭", color:"#059669", bg:"rgba(5,150,105,0.09)",  href:"/services/business-registration" },
            ];
            return (
              <div className="flex gap-3 whitespace-nowrap"
                style={{ animation:"marquee-reverse 28s linear infinite" }}
                onMouseEnter={e => (e.currentTarget.style.animationPlayState="paused")}
                onMouseLeave={e => (e.currentTarget.style.animationPlayState="running")}>
                {[...Array(3)].flatMap((_, ri) => row2.map((t, i) => (
                  <Link key={`${ri}-${i}`} href={t.href}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all duration-200 cursor-pointer select-none"
                    style={{ background:t.bg, color:t.color, border:`1px solid ${t.color}22` }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform="scale(1.1) translateY(-2px)";
                      el.style.boxShadow=`0 6px 20px ${t.color}30`;
                      el.style.background=`${t.color}18`;
                      el.style.borderColor=`${t.color}50`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform="scale(1) translateY(0)";
                      el.style.boxShadow="none";
                      el.style.background=t.bg;
                      el.style.borderColor=`${t.color}22`;
                    }}>
                    <span>{t.icon}</span> {t.label}
                    <span className="text-[9px] opacity-50">&rarr;</span>
                  </Link>
                )))}
              </div>
            );
          })()}
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">

          {/* -- Hero Logo with orbiting ring -- */}
          <motion.div initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }}
            transition={{ duration:0.7, ease:[0.16,1,0.3,1] }}
            className="flex flex-col items-center mb-8">

            <div className="relative flex items-center justify-center mb-5">
              {/* Clean professional logo box */}
              <motion.div whileHover={{ scale:1.05 }} transition={{ type:"spring", stiffness:300 }}
                className="relative rounded-[24px] p-2 cursor-pointer"
                style={{ background:"linear-gradient(135deg,#0F2044,#1E40AF)", boxShadow:"0 8px 40px rgba(18,70,200,0.28),0 2px 8px rgba(18,70,200,0.12)" }}>
                <svg width="72" height="72" viewBox="0 0 38 38" fill="none">
                  <defs>
                    <linearGradient id="hw_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0F2044"/><stop offset="100%" stopColor="#1E40AF"/>
                    </linearGradient>
                  </defs>
                  <rect width="38" height="38" rx="9" fill="url(#hw_bg)"/>
                  <g stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round">
                    <line x1="19" y1="19" x2="19" y2="11"/>
                    <line x1="19" y1="19" x2="26.5" y2="24"/>
                    <line x1="19" y1="19" x2="11.5" y2="24"/>
                  </g>
                  <circle cx="19" cy="19" r="3" fill="white"/>
                  <circle cx="19" cy="11" r="2" fill="rgba(255,255,255,0.9)"/>
                  <circle cx="26.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
                  <circle cx="11.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
                </svg>
              </motion.div>
            </div>

            {/* Wordmark */}
            <motion.div className="flex items-baseline gap-1" whileHover={{ scale:1.03 }}>
              <span className="font-black tracking-tight" style={{ fontSize:"1.8rem", color:L.text, fontFamily:"var(--font-plus-jakarta),sans-serif" }}>Fre</span>
              <span className="font-black tracking-tight" style={{ fontSize:"1.8rem", background:`linear-gradient(135deg,#2563EB,#1E40AF)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontFamily:"var(--font-plus-jakarta),sans-serif" }}>Work</span>
            </motion.div>
          </motion.div>

          {/* Premium pill badge */}
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-bold tracking-wide uppercase"
            style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.08),rgba(99,102,241,0.1))", border:"1px solid rgba(37,99,235,0.18)", color:"#2563EB", backdropFilter:"blur(8px)" }}>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
            Register · Comply · Hire · Work · Grow
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
            className="font-black leading-[1.04] mb-6 tracking-tight px-2"
            style={{ fontFamily:"var(--font-plus-jakarta),sans-serif", fontSize:"clamp(2rem,6.5vw,5.8rem)", color:L.text, letterSpacing:"-0.02em" }}>
            The Operating System
            <br/>
            <span style={{ background:`linear-gradient(135deg,#2563EB 0%,#4F46E5 40%,#1E40AF 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              for Indian Businesses
            </span>
          </motion.h1>

          <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.28 }}
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed px-4 font-medium" style={{ color:L.textSub }}>
            Start, run and grow your business — GST, compliance, talent and workspaces, all in one platform.
          </motion.p>

          {/* Search bar */}
          <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            onSubmit={handleSearch}
            className="flex gap-2 max-w-xl mx-auto mb-8 p-1.5 rounded-2xl"
            style={{ background:"#FFFFFF", border:"1px solid rgba(37,99,235,0.15)", boxShadow:"0 4px 32px rgba(37,99,235,0.1), 0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: L.textMuted }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="What does your business need today?"
                className="flex-1 bg-transparent outline-none text-sm py-2.5 font-medium" style={{ color: L.text }} />
            </div>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 transition-all hover:opacity-90 active:scale-95"
              style={{ background:`linear-gradient(135deg,#2563EB,#1E40AF)`, color:"#fff", boxShadow:"0 4px 14px rgba(37,99,235,0.35)" }}>
              Search
            </button>
          </motion.form>

          {/* Quick search chips */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
            className="flex flex-wrap justify-center gap-2 mb-10">
            {["Register a Company", "Find Coworking Space", "Hire Talent", "GST Filing", "Get Funding"].map(chip => (
              <button key={chip} onClick={() => { setSearchQuery(chip); }}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-[1.04]"
                style={{ background: L.bgCard, borderColor: L.borderLight, color: L.textSub, boxShadow: L.shadow }}>
                {chip}
              </button>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 mb-16">

            {loggedIn ? (
              /* -- LOGGED IN: show Dashboard button prominently -- */
              <>
                <Link href="/dashboard"
                  className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#0F2044,#1E3A8A)", color: "#fff", boxShadow: "0 4px 24px rgba(15,32,68,0.35)" }}>
                  <LayoutDashboard className="w-4 h-4" />
                  {userName ? `${userName}'s Dashboard` : "Go to Dashboard"}
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20want%20to%20know%20more.`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: L.border, color: L.textSub, background: L.bgCard, boxShadow: L.shadow }}>
                  <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                  Talk to an Expert
                </a>
              </>
            ) : (
              /* -- NOT LOGGED IN: show Register + Login -- */
              <>
                <Link href="/register"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] hover:opacity-90"
                  style={{ background: `linear-gradient(135deg,#1246C8,#2563EB)`, color: "#fff", boxShadow: "0 4px 24px rgba(18,70,200,0.3)" }}>
                  Get Started Free <ChevronRight className="w-4 h-4" />
                </Link>
                <Link href="/login"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: "#1246C8", color: "#1246C8", background: "rgba(18,70,200,0.06)", boxShadow: L.shadow }}>
                  <LayoutDashboard className="w-4 h-4" />
                  Login / Dashboard
                </Link>
                <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20want%20to%20know%20more.`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: L.border, color: L.textSub, background: L.bgCard, boxShadow: L.shadow }}>
                  <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                  Talk to an Expert
                </a>
              </>
            )}
          </motion.div>



          {/* -- Services Quick-Link Strip -- */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            className="mb-12">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: L.textMuted }}>
              Everything Your Business Needs
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {[
                { label: "Company Registration",  color: "#059669", bg: "rgba(5,150,105,0.07)",  href: "/services/business-registration" },
                { label: "Coworking Spaces",      color: "#EA580C", bg: "rgba(234,88,12,0.07)",  href: "/coworking" },
                { label: "Find Freelancers",      color: "#7C3AED", bg: "rgba(124,58,237,0.07)", href: "/freelancers" },
                { label: "Pitch Deck & DPR",      color: "#D97706", bg: "rgba(217,119,6,0.07)",  href: "/services/dpr" },
                { label: "Business Training",     color: "#1E40AF", bg: "rgba(18,70,200,0.07)",  href: "/services/training" },
                { label: "GST Registration",      color: "#2563EB", bg: "rgba(37,99,235,0.07)",  href: "/services/compliance" },
                { label: "GST Filing",            color: "#2563EB", bg: "rgba(37,99,235,0.07)",  href: "/services/compliance" },
                { label: "Income Tax Return",     color: "#2563EB", bg: "rgba(37,99,235,0.07)",  href: "/services/compliance" },
                { label: "Virtual Accountant",    color: "#059669", bg: "rgba(5,150,105,0.07)",  href: "/services/accounting" },
                { label: "Business Restructuring",color: "#0891B2", bg: "rgba(8,145,178,0.07)",  href: "/services/restructuring" },
              ].map(({ label, color, bg, href }) => (
                <Link key={label} href={href}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all hover:scale-[1.05] hover:shadow-md"
                  style={{ background: bg, color, borderColor: `${color}25` }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, opacity: 0.7 }} />
                  {label}
                </Link>
              ))}
              <Link href="/services"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black border transition-all hover:scale-[1.05]"
                style={{ background: "linear-gradient(135deg, #1246C8, #2563EB)", color: "#fff", border: "none", boxShadow: "0 4px 16px rgba(18,70,200,0.28)" }}>
                View All Services â†'
              </Link>
            </div>
          </motion.div>

          {/* Marquee */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative overflow-hidden">
            <div className="flex gap-8 animate-marquee whitespace-nowrap">
              {[...TRUST_TICKER, ...TRUST_TICKER].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2.5 text-xs font-semibold flex-shrink-0" style={{ color: L.textMuted }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: L.gold, opacity: 0.5 }} />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>


      {/* --- PLATFORM OVERVIEW --- */}
      <section className="py-16 px-4 relative" style={{ background: "linear-gradient(180deg, #F0F4FF 0%, #FFFFFF 100%)" }}>
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: "#2563EB" }}>One Platform · Five Business Essentials</p>
            <h2 className="font-black leading-tight" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#0F2044" }}>
              Not just tax. Everything your<br/>
              <span style={{ background: "linear-gradient(135deg,#2563EB,#4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>business needs.</span>
            </h2>
            <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#64748B" }}>
              FreWork is India&apos;s complete business platform — from day 1 incorporation to ongoing compliance, hiring, workspace and funding.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { emoji: "🏢", title: "Start", sub: "Register & Set Up", items: ["Company Registration", "GST Number", "MSME Certificate"], color: "#059669", bg: "rgba(5,150,105,0.06)", href: "/services/business-registration" },
              { emoji: "✅", title: "Comply", sub: "Tax & Compliance", items: ["GST Filing", "ITR Filing", "ROC / MCA"], color: "#2563EB", bg: "rgba(37,99,235,0.06)", href: "/services/compliance" },
              { emoji: "👥", title: "Hire", sub: "Talent & Experts", items: ["Tax Consultants", "Developers", "Designers"], color: "#7C3AED", bg: "rgba(124,58,237,0.06)", href: "/freelancers" },
              { emoji: "🏛️", title: "Work", sub: "Coworking Spaces", items: ["Hot Desks", "Private Cabins", "8 Cities"], color: "#EA580C", bg: "rgba(234,88,12,0.06)", href: "/coworking" },
              { emoji: "🚀", title: "Grow", sub: "Funding & Scale", items: ["Pitch Decks", "DPR / Business Plan", "Investor Connect"], color: "#D97706", bg: "rgba(217,119,6,0.06)", href: "/services/dpr" },
            ] as const).map(p => (
              <Link key={p.title} href={p.href}
                className="group relative rounded-2xl p-5 border transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1 cursor-pointer block"
                style={{ background: p.bg, borderColor: p.color + "22", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="text-3xl mb-3">{p.emoji}</div>
                <p className="font-black text-base mb-0.5" style={{ color: p.color }}>{p.title}</p>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "#64748B" }}>{p.sub}</p>
                <ul className="space-y-1">
                  {p.items.map(item => (
                    <li key={item} className="text-[11px] flex items-center gap-1.5" style={{ color: "#64748B" }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4" style={{ color: p.color }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --- COWORKING SPOTLIGHT --- */}
      <section className="py-28 px-4 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #F8FAFF 0%, #FFFFFF 50%, #F0F4FF 100%)", borderTop: "1px solid rgba(37,99,235,0.08)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", right: "-10%", top: "-20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 65%)", filter: "blur(40px)" }} />
        </div>

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, ${L.gold}, transparent)` }} />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: L.gold }}>Featured Module</span>
            <div className="h-px flex-1" style={{ background: `rgba(184,144,58,0.12)` }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase mb-6 border"
                style={{ background: "rgba(18,70,200,0.06)", borderColor: "rgba(18,70,200,0.2)", color: "#1246C8" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Now Live
              </span>

              <h2 className="font-black leading-[1.05] mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", color: L.text }}>
                Your perfect office,<br />
                <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #0EA5E9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  wherever you work.
                </span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: L.textSub }}>
                Day desk or private cabin, by the hour or by the month. Browse India&apos;s most trusted coworking directory – every space personally verified before listing.
              </p>

              {/* Amenity tiles */}
              <div className="grid grid-cols-3 gap-2.5 mb-8">
                {[
                  { icon: Wifi, l: "High-speed WiFi" }, { icon: Coffee, l: "Café & Cafeteria" },
                  { icon: Car, l: "Parking" }, { icon: Printer, l: "Printer & Scanner" },
                  { icon: AirVent, l: "Climate Control" }, { icon: Lock, l: "24/7 Access" },
                ].map(f => (
                  <div key={f.l} className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center"
                    style={{ background: L.bgCard, borderColor: L.borderLight, boxShadow: L.shadow }}>
                    <f.icon className="w-4 h-4" style={{ color: "#EA580C" }} />
                    <span className="text-[10px] font-semibold leading-tight" style={{ color: L.textSub }}>{f.l}</span>
                  </div>
                ))}
              </div>

              {/* Cities */}
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: L.gold }}>Available in</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"].map(city => (
                  <span key={city} className="px-3 py-1 rounded-full text-xs border font-medium"
                    style={{ background: L.bgCard, borderColor: L.borderLight, color: L.textMuted, boxShadow: L.shadow }}>
                    📍 {city}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-0 mb-8 rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(37,99,235,0.12)", background: "rgba(37,99,235,0.03)" }}>{[{n:"200+",l:"Spaces"},{n:"8",l:"Cities"},{n:"₹350",l:"From /day"}].map((s,idx) => (<div key={s.l} className="flex-1 text-center py-3 px-2" style={{ borderRight: idx<2 ? "1px solid rgba(37,99,235,0.1)" : "none" }}><p className="text-base font-black" style={{ color: "#2563EB" }}>{s.n}</p><p className="text-[10px] font-semibold" style={{ color: L.textMuted }}>{s.l}</p></div>))}</div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1E40AF)", color: "#fff", boxShadow: "0 4px 20px rgba(37,99,235,0.28)" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: "rgba(37,99,235,0.2)", color: "#1E40AF", background: L.bgCard, boxShadow: L.shadow }}>
                  List your space – Free
                </Link>
              </div>
            </div>

            {/* Right – Interactive plan card */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden border"
                style={{ background: L.bgCard, borderColor: "rgba(37,99,235,0.12)", boxShadow: "0 24px 64px rgba(37,99,235,0.1), 0 4px 16px rgba(0,0,0,0.04)" }}>
                <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #2563EB, #4F46E5, #0EA5E9)" }} />

                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(37,99,235,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border"
                      style={{ background: "rgba(37,99,235,0.07)", borderColor: "rgba(37,99,235,0.14)" }}>🏢</div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: L.text }}>FreWork Coworking</p>
                      <p className="text-[10px]" style={{ color: L.textMuted }}>Verified · Bangalore, Indiranagar</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    style={{ background: "rgba(5,150,105,0.06)", color: "#065F46", borderColor: "rgba(5,150,105,0.2)" }}>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Available
                  </span>
                </div>

                {/* Plan selector tabs */}
                <div className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{ color: L.textMuted }}>
                    Select a plan – tap to learn more
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {COWORK_PLANS.map((plan) => (
                      <button key={plan.key} onClick={() => setSelectedPlan(plan.key)}
                        className="rounded-2xl p-3.5 text-left border cursor-pointer transition-all duration-200"
                        style={selectedPlan === plan.key ? {
                          borderColor: "rgba(234,88,12,0.35)", background: "rgba(234,88,12,0.05)",
                          boxShadow: "0 4px 16px rgba(234,88,12,0.1)", transform: "scale(1.02)"
                        } : {
                          borderColor: L.borderLight, background: L.bgAlt
                        }}>
                        <p className="text-xl mb-1">{plan.emoji}</p>
                        <p className="text-[11px] font-bold mb-0.5" style={{ color: selectedPlan === plan.key ? "#1E40AF" : L.textSub }}>{plan.label}</p>
                        <p className="text-xs font-black" style={{ color: selectedPlan === plan.key ? "#2563EB" : L.textMuted }}>
                          {plan.price}<span className="font-normal text-[10px]">{plan.per}</span>
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Plan description */}
                  <AnimatePresence mode="wait">
                    <motion.div key={selectedPlan}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="rounded-xl p-4 mb-4 border"
                      style={{ background: "rgba(37,99,235,0.03)", borderColor: "rgba(37,99,235,0.1)" }}>
                      <p className="text-xs leading-relaxed" style={{ color: L.textSub }}>
                        {selectedCoworkPlan.desc}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <Link href="/coworking"
                    className="w-full py-3 rounded-2xl text-sm font-bold text-center block transition-all hover:opacity-90 hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg, #2563EB, #1E40AF)", color: "#fff", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}>
                    Book a Visit â†'
                  </Link>
                </div>
              </div>

              <div className="absolute -bottom-3 -left-3 px-4 py-2.5 rounded-xl border shadow-xl"
                style={{ background: L.bgCard, borderColor: "rgba(234,88,12,0.2)", boxShadow: "0 8px 32px rgba(139,108,50,0.12)" }}>
                <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#1246C8" }}>Live in 8 cities</p>
                <p className="text-xs mt-0.5" style={{ color: L.textMuted }}>
                  <Link href="/coworking" style={{ color: "#2563EB" }}>Browse spaces</Link> near you
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 8 MODULES (interactive click-to-expand) --- */}
      <section className="py-28 px-4 relative" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-6">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>8 Modules · One Platform</p>
            <GoldDivider />
            <h2 className="font-black mb-3 leading-tight mt-4"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 3rem)", color: L.text }}>
              Everything your business needs
            </h2>
            <p className="text-base max-w-md mx-auto mb-3" style={{ color: L.textSub }}>
              From day one of registration to raising your Series A
            </p>
            <p className="text-xs font-semibold" style={{ color: L.textMuted }}>
              👆 Click any module to learn more
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isExpanded = expandedModule === mod.id;
              return (
                <motion.div key={mod.id}
                  initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <button onClick={() => handleModuleClick(mod.id)}
                    className="w-full text-left block h-full"
                    aria-expanded={isExpanded}>
                    <div className="relative h-full rounded-2xl p-5 transition-all duration-300 cursor-pointer"
                      style={{
                        background: isExpanded ? `${mod.color}08` : L.bgCard,
                        border: `2px solid ${isExpanded ? mod.color + "50" : L.borderLight}`,
                        boxShadow: isExpanded ? `0 8px 40px ${mod.color}15` : L.shadow,
                        transform: isExpanded ? "translateY(-2px)" : "none",
                      }}>
                      {isExpanded && (
                        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                          style={{ background: `linear-gradient(90deg, transparent, ${mod.color}, transparent)` }} />
                      )}
                      {mod.badge && (
                        <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${mod.color}10`, color: mod.color, border: `1px solid ${mod.color}22` }}>
                          {mod.badge}
                        </span>
                      )}

                      <div className="text-2xl mb-3">{mod.emoji}</div>

                      <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: mod.color }}>
                        {mod.label}
                      </p>
                      <h3 className="font-bold text-sm mb-2" style={{ color: L.text }}>{mod.tagline}</h3>
                      <p className="text-[11px] leading-relaxed mb-3" style={{ color: L.textMuted }}>{mod.desc}</p>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[11px] font-bold" style={{ color: isExpanded ? mod.color : L.textMuted }}>
                          {isExpanded ? "Close â†'" : "Learn more"}
                        </span>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-4 h-4" style={{ color: isExpanded ? mod.color : L.textMuted }} />
                        </motion.div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Expanded detail panel */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                ref={moduleDetailRef}
                key={expanded.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden">
                <div className="rounded-3xl border p-8 md:p-10 relative"
                  style={{ background: `${expanded.color}04`, borderColor: `${expanded.color}25`, boxShadow: `0 8px 40px ${expanded.color}10` }}>

                  {/* Top accent */}
                  <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-3xl"
                    style={{ background: `linear-gradient(90deg, transparent, ${expanded.color}, transparent)` }} />

                  {/* Close button */}
                  <button onClick={() => setExpandedModule(null)}
                    className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center border transition-all hover:scale-110"
                    style={{ background: L.bgCard, borderColor: L.borderLight, color: L.textMuted }}>
                    <X className="w-4 h-4" />
                  </button>

                  <div className="grid md:grid-cols-2 gap-10">
                    {/* Left */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border"
                          style={{ background: `${expanded.color}10`, borderColor: `${expanded.color}25` }}>
                          {expanded.emoji}
                        </div>
                        <div>
                          <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: expanded.color }}>{expanded.label}</p>
                          <h3 className="font-black text-xl" style={{ color: L.text }}>{expanded.detail.heading}</h3>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed mb-6" style={{ color: L.textSub }}>{expanded.detail.why}</p>

                      {/* Features */}
                      <div className="space-y-3 mb-6">
                        {expanded.detail.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border"
                            style={{ background: L.bgCard, borderColor: L.borderLight }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${expanded.color}10`, border: `1px solid ${expanded.color}20` }}>
                              <f.icon className="w-4 h-4" style={{ color: expanded.color }} />
                            </div>
                            <span className="text-sm" style={{ color: L.textSub }}>{f.text}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 p-4 rounded-2xl border"
                        style={{ background: L.bgCard, borderColor: L.borderLight }}>
                        <div className="text-center flex-1">
                          <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: L.textMuted }}>Price</p>
                          <p className="text-base font-black" style={{ color: expanded.color }}>{expanded.detail.pricing}</p>
                        </div>
                        <div className="w-px h-8" style={{ background: L.borderLight }} />
                        <div className="text-center flex-1">
                          <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: L.textMuted }}>Timeline</p>
                          <p className="text-base font-black" style={{ color: expanded.color }}>{expanded.detail.time}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right – How it works steps */}
                    <div>
                      <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-5" style={{ color: L.textMuted }}>
                        How it works
                      </p>
                      <div className="space-y-3 mb-8">
                        {expanded.detail.steps.map((step, i) => (
                          <motion.div key={i}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-4 p-4 rounded-xl border"
                            style={{ background: L.bgCard, borderColor: L.borderLight }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background: `${expanded.color}12`, color: expanded.color, border: `1px solid ${expanded.color}25` }}>
                              {i + 1}
                            </div>
                            <p className="text-sm pt-0.5" style={{ color: L.textSub }}>{step}</p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <Link href={expanded.href}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] hover:opacity-90"
                          style={{ background: `linear-gradient(135deg, ${expanded.color}dd, ${expanded.color})`, color: "#fff", boxShadow: `0 4px 20px ${expanded.color}30` }}>
                          Get Started <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20help%20with%20${encodeURIComponent(expanded.tagline)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-5 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.02]"
                          style={{ borderColor: L.border, color: L.textSub, background: L.bgCard }}>
                          <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* --- HOW IT WORKS (interactive steps) --- */}
      <section className="py-28 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>How it works</p>
            <GoldDivider />
            <h2 className="font-black mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Simple as 1 – 2 – 3
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "01", t: "Tell us what you need", d: "Choose a service or describe your business challenge. Our experts understand Indian business inside-out.", icon: Search, detail: "Browse our 8 modules or simply search. You can also WhatsApp us directly and we'll guide you to the right service within minutes." },
              { n: "02", t: "Get matched & supported", d: "We connect you with the right verified professional and track your service end-to-end via your dashboard.", icon: UserCheck, detail: "A dedicated expert is assigned to your case. You can track progress in real-time on your dashboard and get WhatsApp updates at every step." },
              { n: "03", t: "Run your business", d: "Stay on top of deadlines, documents, and renewals – all in one place. No more missed filings.", icon: CalendarCheck, detail: "Your compliance calendar tracks every due date automatically. You get reminders 30 days, 7 days and 1 day before each deadline." },
            ].map((step, i) => {
              const Icon = step.icon;
              const isActive = activeStep === i;
              return (
                <motion.div key={step.n}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <button className="w-full text-left" onClick={() => setActiveStep(isActive ? -1 : i)}>
                    <div className="p-6 rounded-2xl border transition-all duration-300"
                      style={{
                        background: isActive ? L.bgCard : L.bgCard,
                        borderColor: isActive ? L.border : L.borderLight,
                        boxShadow: isActive ? L.shadowHover : L.shadow,
                        transform: isActive ? "translateY(-3px)" : "none",
                      }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{ background: isActive ? `rgba(184,144,58,0.12)` : `rgba(184,144,58,0.06)`, border: `1px solid ${L.border}` }}>
                        <span className="font-black text-2xl" style={{ color: L.gold }}>{step.n}</span>
                      </div>
                      <h3 className="font-bold mb-3 text-base text-center" style={{ color: L.text }}>{step.t}</h3>
                      <p className="text-sm leading-relaxed text-center mb-3" style={{ color: L.textSub }}>{step.d}</p>

                      <div className="flex justify-center">
                        <span className="text-xs font-semibold" style={{ color: L.gold }}>
                          {isActive ? "Click to collapse â†'" : "Click to learn more ↓"}
                        </span>
                      </div>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 border-t text-sm leading-relaxed text-center" style={{ borderColor: L.borderLight, color: L.textMuted }}>
                              {step.detail}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- WHY FREWORK --- */}
      <section className="py-28 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>Why choose us</p>
            <GoldDivider />
            <h2 className="font-black mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Your complete business platform, <span style={{ color: L.gold }}>all in one place</span>
            </h2>
            <p className="mt-3 text-sm max-w-sm mx-auto" style={{ color: L.textSub }}>
              From incorporation to GST, hiring to workspace — everything a growing Indian business needs, handled.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Shield, c: "#059669", t: "One account, everything done", d: "Company registration, GST filing, ITR, coworking space booking and hiring — all from one account, one dashboard.", extra: "No more juggling 10 different portals. FreWork handles company formation, all tax filings, workspace booking and professional hiring in one place." },
              { icon: Clock, c: "#2563EB", t: "From day 1 to growth", d: "Register your company, get GST, hire your team, find a workspace, raise funding — FreWork covers every stage of your business journey.", extra: "Whether you are just starting out or scaling up, FreWork has the tools and experts you need. Our platform grows with your business." },
              { icon: Star, c: "#1E40AF", t: "Built for Indian business", d: "Indian compliance, Indian cities, Indian pricing. We understand the real challenges of SMEs, startups and solo founders in India.", extra: "Our platform is built by a team that includes practicing CAs, former startup founders and operations experts — people who have faced the same problems." },
            ].map((item, i) => {
              const Icon = item.icon;
              const [open, setOpen] = useState(false);
              return (
                <motion.div key={item.t}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <button className="w-full text-left" onClick={() => setOpen(!open)}>
                    <div className="p-7 rounded-2xl border transition-all duration-300"
                      style={{ background: L.bgCard, borderColor: open ? `${item.c}30` : L.borderLight, boxShadow: open ? L.shadowHover : L.shadow, transform: open ? "translateY(-2px)" : "none" }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                        style={{ background: `${item.c}08`, border: `1px solid ${item.c}20` }}>
                        <Icon className="w-6 h-6" style={{ color: item.c }} />
                      </div>
                      <h3 className="font-bold mb-2.5 text-base" style={{ color: L.text }}>{item.t}</h3>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: L.textSub }}>{item.d}</p>
                      <span className="text-xs font-semibold" style={{ color: item.c }}>{open ? "Show less â†'" : "Read more ↓"}</span>
                      <AnimatePresence>
                        {open && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            className="text-sm leading-relaxed mt-3 pt-3 border-t overflow-hidden"
                            style={{ color: L.textMuted, borderColor: L.borderLight }}>
                            {item.extra}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- QUICK SERVICES --- */}
      <section className="py-20 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-black tracking-[0.35em] uppercase mb-10" style={{ color: L.textMuted }}>Popular on FreWork</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Building2, label: "Company Registration", href: "/services/business-registration", color: "#059669" },
              { icon: MapPin, label: "Find Coworking Space", href: "/coworking", color: "#EA580C" },
              { icon: Users, label: "Hire Talent", href: "/freelancers", color: "#7C3AED" },
              { icon: Presentation, label: "Pitch Deck & DPR", href: "/services/dpr", color: "#D97706" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training", color: "#1E40AF" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance", color: "#2563EB" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance", color: "#2563EB" },
              { icon: BarChart3, label: "Virtual Accountant", href: "/services/accounting", color: "#059669" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-3.5 rounded-xl border transition-all group hover:scale-[1.03] hover:-translate-y-0.5"
                  style={{ background: L.bgCard, borderColor: L.borderLight, boxShadow: L.shadow }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-semibold leading-tight" style={{ color: L.textSub }}>{s.label}</span>
                  <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-24 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl p-12 overflow-hidden border"
            style={{ background: L.bgCard, borderColor: L.border, boxShadow: "0 20px 60px rgba(139,108,50,0.1)" }}>
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-3xl"
              style={{ background: `linear-gradient(90deg, ${L.goldLight}, ${L.gold}, ${L.goldDark})` }} />
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(184,144,58,0.05) 0%, transparent 60%)" }} />

            <p className="relative z-10 text-[10px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: L.gold }}>Ready to start?</p>
            <GoldDivider />
            <h2 className="relative z-10 font-black mb-4 leading-tight mt-4"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Start your business journey today
            </h2>
            <p className="relative z-10 text-base mb-8 max-w-md mx-auto" style={{ color: L.textSub }}>
              Join founders, SMEs, and professionals building their business with FreWork.
            </p>
            <div className="relative z-10 flex flex-wrap gap-3 justify-center">
              <Link href="/register"
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03] hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff", boxShadow: `0 4px 24px rgba(184,144,58,0.25)` }}>
                Get Started Free <ChevronRight className="w-4 h-4" />
              </Link>
              <a href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm border transition-all hover:scale-[1.03]"
                style={{ borderColor: L.border, color: L.textSub, background: L.bgAlt, boxShadow: L.shadow }}>
                <Phone className="w-4 h-4" style={{ color: L.gold }} /> {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="py-8 text-center text-xs border-t" style={{ color: L.textMuted, borderColor: L.borderLight, background: L.bg }}>
        FreWork is in Beta – growing and improving every day. Thank you for being an early supporter.
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
}
