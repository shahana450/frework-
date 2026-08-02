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
  bg: "#080D1C",
  bgAlt: "#0C1428",
  bgCard: "#101D35",
  text: "#EDE8DC",
  textSub: "#8A9BB8",
  textMuted: "#4A5A72",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  goldDark: "#A07C2E",
  border: "rgba(201,168,76,0.18)",
  borderLight: "rgba(201,168,76,0.08)",
  shadow: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  shadowHover: "0 10px 40px rgba(201,168,76,0.12), 0 2px 8px rgba(0,0,0,0.4)",
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

      {/* --- HERO: TWO PILLARS --- */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden" style={{ background:"#070C1A", paddingTop:"68px" }}>
        {/* Layered background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"-10%", top:"5%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 60%)", filter:"blur(90px)" }} />
          <div style={{ position:"absolute", right:"-10%", top:"5%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 60%)", filter:"blur(90px)" }} />
          <div style={{ position:"absolute", left:"30%", bottom:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 60%)", filter:"blur(70px)" }} />
          <div style={{ position:"absolute", inset:0, opacity:0.018, backgroundImage:"radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize:"32px 32px" }} />
        </div>

        {/* -- Scrolling service banners -- */}
        <div className="absolute top-[68px] inset-x-0 z-20 overflow-hidden py-2" style={{ background:"rgba(7,12,26,0.9)", borderBottom:"1px solid rgba(201,168,76,0.1)" }}>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none" style={{ background:"linear-gradient(90deg,#070C1A,transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none" style={{ background:"linear-gradient(270deg,#070C1A,transparent)" }} />

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

        {/* Main hero content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-16 pb-14">

          {/* Brand headline */}
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black tracking-[0.3em] uppercase border mb-6 inline-block"
              style={{ background:"rgba(201,168,76,0.08)", borderColor:"rgba(201,168,76,0.25)", color:"#C9A84C" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              India&apos;s Business Platform
            </span>
            <h1 className="font-black leading-[1.04] tracking-tight"
              style={{ fontFamily:"var(--font-plus-jakarta),sans-serif", fontSize:"clamp(2.2rem,5.5vw,4.8rem)", color:"#EDE8DC", letterSpacing:"-0.025em" }}>
              The smarter way to
              <br/>
              <span style={{ background:"linear-gradient(135deg,#C9A84C 0%,#E8C97A 50%,#C9A84C 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                run your business.
              </span>
            </h1>
            <p className="text-base font-medium max-w-xl mx-auto mt-4" style={{ color:"#8A9BB8" }}>
              Two things every Indian business needs — expert compliance and the right workspace. Both, right here.
            </p>
          </motion.div>

          {/* ═══ TWO PILLAR CARDS ═══ */}
          <div className="grid md:grid-cols-2 gap-5 mb-10">

            {/* PILLAR 1 — COMPLIANCE */}
            <motion.div initial={{ opacity:0, x:-24 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2, duration:0.5 }}>
              <div className="relative rounded-3xl overflow-hidden h-full transition-all hover:scale-[1.01] hover:shadow-2xl"
                style={{ background:"linear-gradient(160deg,#08112A 0%,#0D1A42 100%)", border:"1px solid rgba(37,99,235,0.3)", boxShadow:"0 8px 48px rgba(37,99,235,0.15)" }}>
                <div className="h-[3px]" style={{ background:"linear-gradient(90deg,#2563EB,#4F46E5,#0EA5E9)" }} />
                <div className="p-7 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.28)" }}>📋</div>
                    <div>
                      <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color:"#60A5FA" }}>Compliance & Legal</p>
                      <p className="text-[11px] font-semibold" style={{ color:"rgba(148,163,184,0.5)" }}>Expert CAs &amp; Lawyers</p>
                    </div>
                  </div>
                  <h2 className="font-black mb-3 leading-[1.1]"
                    style={{ fontSize:"clamp(1.7rem,3vw,2.5rem)", color:"#EDE8DC", letterSpacing:"-0.02em" }}>
                    Register. File.<br/>Comply.
                  </h2>
                  <p className="text-sm leading-relaxed mb-6" style={{ color:"rgba(148,163,184,0.7)" }}>
                    From company registration to GST, income tax, ROC and MSME — verified CAs handle everything end-to-end, online.
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 mb-6">
                    {["Company Registration","GST Registration","Income Tax (ITR)","GST Filing","ROC / MCA","MSME / Udyam"].map(s => (
                      <div key={s} className="flex items-center gap-2 text-xs font-semibold" style={{ color:"rgba(203,213,225,0.7)" }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:"#3B82F6" }} />{s}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-0 mb-6 rounded-2xl overflow-hidden border" style={{ borderColor:"rgba(37,99,235,0.14)", background:"rgba(37,99,235,0.07)" }}>
                    {[["₹499","Starting"],["24hr","Turnaround"],["100%","Online"]].map(([n,l],i,arr) => (
                      <div key={l} className="flex-1 text-center py-3" style={{ borderRight:i<arr.length-1?"1px solid rgba(37,99,235,0.12)":"none" }}>
                        <p className="text-sm font-black leading-none" style={{ color:"#60A5FA" }}>{n}</p>
                        <p className="text-[9px] font-semibold mt-0.5" style={{ color:"rgba(148,163,184,0.45)" }}>{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2.5">
                    <Link href="/services/compliance"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background:"linear-gradient(135deg,#2563EB,#1E40AF)", color:"#fff", boxShadow:"0 4px 20px rgba(37,99,235,0.4)" }}>
                      Explore Services <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20help%20with%20compliance%20services.`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-3 rounded-2xl text-xs font-bold border flex items-center gap-1.5 transition-all hover:opacity-90"
                      style={{ borderColor:"rgba(37,211,102,0.3)", color:"#25D366", background:"rgba(37,211,102,0.06)" }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Free Advice
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* PILLAR 2 — COWORKING */}
            <motion.div initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.25, duration:0.5 }}>
              <div className="relative rounded-3xl overflow-hidden h-full transition-all hover:scale-[1.01] hover:shadow-2xl"
                style={{ background:"linear-gradient(160deg,#100D02 0%,#1C1600 100%)", border:"1px solid rgba(201,168,76,0.28)", boxShadow:"0 8px 48px rgba(201,168,76,0.1)" }}>
                <div className="h-[3px]" style={{ background:"linear-gradient(90deg,#C9A84C,#E8C97A,#C9A84C)" }} />
                <div className="p-7 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.28)" }}>🏛️</div>
                    <div>
                      <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color:"#C9A84C" }}>Premium Coworking</p>
                      <p className="text-[11px] font-semibold" style={{ color:"rgba(148,163,184,0.5)" }}>Verified Spaces Across India</p>
                    </div>
                  </div>
                  <h2 className="font-black mb-3 leading-[1.1]"
                    style={{ fontSize:"clamp(1.7rem,3vw,2.5rem)", color:"#EDE8DC", letterSpacing:"-0.02em" }}>
                    Your Ideal<br/>Workspace.
                  </h2>
                  <p className="text-sm leading-relaxed mb-6" style={{ color:"rgba(148,163,184,0.7)" }}>
                    Hot desks, private cabins and meeting rooms across 8 cities. Every space personally verified before listing.
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 mb-6">
                    {["Hot Desks","Private Cabins","Meeting Rooms","Event Spaces","8 Cities","200+ Spaces"].map(s => (
                      <div key={s} className="flex items-center gap-2 text-xs font-semibold" style={{ color:"rgba(203,213,225,0.7)" }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:"#C9A84C" }} />{s}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-0 mb-6 rounded-2xl overflow-hidden border" style={{ borderColor:"rgba(201,168,76,0.14)", background:"rgba(201,168,76,0.07)" }}>
                    {[["₹350","From /day"],["200+","Spaces"],["8","Cities"]].map(([n,l],i,arr) => (
                      <div key={l} className="flex-1 text-center py-3" style={{ borderRight:i<arr.length-1?"1px solid rgba(201,168,76,0.12)":"none" }}>
                        <p className="text-sm font-black leading-none" style={{ color:"#C9A84C" }}>{n}</p>
                        <p className="text-[9px] font-semibold mt-0.5" style={{ color:"rgba(148,163,184,0.45)" }}>{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2.5">
                    <Link href="/coworking"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background:"linear-gradient(135deg,#C9A84C,#A07C2E)", color:"#fff", boxShadow:"0 4px 20px rgba(201,168,76,0.35)" }}>
                      Find a Space <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20help%20finding%20a%20coworking%20space.`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-3 rounded-2xl text-xs font-bold border flex items-center gap-1.5 transition-all hover:opacity-90"
                      style={{ borderColor:"rgba(37,211,102,0.3)", color:"#25D366", background:"rgba(37,211,102,0.06)" }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Book Visit
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
            className="flex items-center justify-center gap-8 flex-wrap mb-6">
            {[["500+","Businesses Served"],["200+","Verified Spaces"],["8","Indian Cities"],["₹499","Starting Price"]].map(([n,l]) => (
              <div key={l} className="text-center">
                <p className="text-xl font-black leading-none" style={{ color:"#C9A84C" }}>{n}</p>
                <p className="text-[10px] font-semibold mt-1" style={{ color:"rgba(148,163,184,0.45)" }}>{l}</p>
              </div>
            ))}
          </motion.div>

          {/* Trust note */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.45 }}
            className="text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color:"rgba(148,163,184,0.4)" }}>
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Trusted by 500+ Indian businesses
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Free WhatsApp consultation
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              100% online
            </div>
          </motion.div>
        </div>
      </section>


      {/* --- PLATFORM OVERVIEW --- */}
      <section className="py-20 px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #08112A 0%, #0F2044 55%, #0D1040 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"-5%", top:"-20%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 60%)", filter:"blur(80px)" }} />
          <div style={{ position:"absolute", right:"-5%", bottom:"-20%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 60%)", filter:"blur(80px)" }} />
          <div style={{ position:"absolute", left:"40%", top:"30%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 60%)", filter:"blur(60px)" }} />
          <div style={{ position:"absolute", inset:0, opacity:0.03, backgroundImage:"radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize:"24px 24px" }} />
        </div>

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: "#60A5FA" }}>One Platform · Five Business Essentials</p>
            <h2 className="font-black leading-tight" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#FFFFFF" }}>
              Not just tax. Everything your
              <br/>
              <span style={{ background: "linear-gradient(135deg,#60A5FA 0%,#A78BFA 50%,#34D399 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>business needs.</span>
            </h2>
            <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "rgba(148,163,184,0.85)" }}>
              FreWork is India&apos;s complete business platform — from day 1 incorporation to ongoing compliance, hiring, workspace and funding.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { emoji: "🏢", title: "Start", sub: "Register & Set Up", stat: "7-day", statLabel: "setup", items: ["Company Registration", "GST Number", "MSME Certificate"], color: "#34D399", border: "rgba(52,211,153,0.22)", bg: "rgba(52,211,153,0.07)", href: "/services/business-registration" },
              { emoji: "✅", title: "Comply", sub: "Tax & Compliance", stat: "₹499", statLabel: "from", items: ["GST Filing", "ITR Filing", "ROC / MCA"], color: "#60A5FA", border: "rgba(96,165,250,0.22)", bg: "rgba(96,165,250,0.07)", href: "/services/compliance" },
              { emoji: "👥", title: "Hire", sub: "Talent & Experts", stat: "24hr", statLabel: "match", items: ["Professionals", "Developers", "Designers"], color: "#C084FC", border: "rgba(192,132,252,0.22)", bg: "rgba(192,132,252,0.07)", href: "/freelancers" },
              { emoji: "🏛️", title: "Work", sub: "Coworking Spaces", stat: "200+", statLabel: "spaces", items: ["Hot Desks", "Private Cabins", "8 Cities"], color: "#FB923C", border: "rgba(251,146,60,0.22)", bg: "rgba(251,146,60,0.07)", href: "/coworking" },
              { emoji: "🚀", title: "Grow", sub: "Funding & Scale", stat: "500+", statLabel: "clients", items: ["Pitch Decks", "DPR / Business Plan", "Investor Connect"], color: "#FCD34D", border: "rgba(252,211,77,0.22)", bg: "rgba(252,211,77,0.07)", href: "/services/dpr" },
            ].map(p => (
              <Link key={p.title} href={p.href}
                className="group relative rounded-2xl p-5 border transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1 cursor-pointer block"
                style={{ background: p.bg, borderColor: p.border, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{p.emoji}</div>
                  <div className="text-right">
                    <p className="text-sm font-black leading-none" style={{ color: p.color }}>{p.stat}</p>
                    <p className="text-[9px] font-medium" style={{ color: "rgba(148,163,184,0.55)" }}>{p.statLabel}</p>
                  </div>
                </div>
                <p className="font-black text-base mb-0.5" style={{ color: p.color }}>{p.title}</p>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "rgba(148,163,184,0.7)" }}>{p.sub}</p>
                <ul className="space-y-1">
                  {p.items.map(item => (
                    <li key={item} className="text-[11px] flex items-center gap-1.5" style={{ color: "rgba(203,213,225,0.6)" }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.color, opacity: 0.7 }} />
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
      <section className="py-28 px-4 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#0B1428 0%,#080D1C 50%,#0D1020 100%)", borderTop: `1px solid ${L.borderLight}` }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", right: "-10%", top: "-20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", left: "-5%", bottom: "-10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 60%)", filter: "blur(50px)" }} />
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
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>Why FreWork</p>
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
                    <div className="p-7 rounded-2xl border transition-all duration-300 relative overflow-hidden"
                      style={{ background: L.bgCard, borderColor: open ? `${item.c}30` : L.borderLight, boxShadow: open ? L.shadowHover : L.shadow, transform: open ? "translateY(-2px)" : "none" }}>
                      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${item.c}, ${item.c}50)` }} />
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

      {/* --- TESTIMONIALS --- */}
      <section className="py-20 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>What our clients say</p>
            <h2 className="font-black" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.5rem,3.5vw,2.2rem)", color: L.text }}>
              Trusted by growing businesses
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote: "FreWork registered my company and GST in 6 days. I was expecting it to take a month. The process was completely seamless.", name: "Rahul Sharma", role: "Founder, TechStart Pune", color: "#059669" },
              { quote: "Booked a hot desk through FreWork and it was perfectly set up. Every space is personally verified — you get exactly what you see.", name: "Priya Menon", role: "Freelance Designer, Bangalore", color: "#C9A84C" },
              { quote: "Our CA through FreWork filed 3 years of pending ITR in 4 days. Affordable, fast, and genuinely professional service.", name: "Anil Gupta", role: "SME Owner, Delhi NCR", color: "#3B82F6" },
            ].map((item) => (
              <div key={item.name} className="rounded-2xl p-6 border" style={{ background: L.bgCard, borderColor: `${item.color}22`, boxShadow: L.shadow }}>
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <span key={i} style={{ color: "#C9A84C", fontSize: "14px" }}>★</span>)}
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: L.textSub }}>&ldquo;{item.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}25` }}>
                    {item.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: L.text }}>{item.name}</p>
                    <p className="text-[11px]" style={{ color: L.textMuted }}>{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
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
                  className="flex items-center gap-3 p-3.5 rounded-xl border transition-all group hover:scale-[1.03] hover:-translate-y-0.5 relative overflow-hidden"
                  style={{ background: `${s.color}04`, borderColor: `${s.color}1A`, boxShadow: L.shadow }}>
                  <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}40)` }} />
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
      <section className="py-28 px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #08112A 0%, #0F2044 55%, #1A0A3D 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"10%", top:"-30%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 60%)", filter:"blur(80px)" }} />
          <div style={{ position:"absolute", right:"5%", bottom:"-20%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 60%)", filter:"blur(70px)" }} />
          <div style={{ position:"absolute", inset:0, opacity:0.025, backgroundImage:"radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize:"24px 24px" }} />
        </div>
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-5" style={{ color: "#60A5FA" }}>Ready to start?</p>
          <h2 className="font-black mb-5 leading-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#FFFFFF" }}>
            India&apos;s complete<br/>
            <span style={{ background: "linear-gradient(135deg, #60A5FA, #A78BFA, #34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business platform.
            </span>
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto" style={{ color: "rgba(148,163,184,0.9)" }}>
            Join founders, SMEs, and professionals building their business with FreWork.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link href="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #2563EB, #4F46E5)", color: "#fff", boxShadow: "0 8px 32px rgba(37,99,235,0.45)" }}>
              Get Started Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm border transition-all hover:scale-[1.03]"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.06)" }}>
              <Phone className="w-4 h-4" style={{ color: "#34D399" }} /> {SUPPORT_PHONE}
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {["Company Registration", "GST Filing", "Coworking", "Hire Talent", "Pitch Decks"].map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
                <span className="w-1 h-1 rounded-full" style={{ background: "#34D399" }} />{s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="py-6 text-center text-xs border-t" style={{ borderColor: "rgba(37,99,235,0.12)", background: "#08112A", color: "rgba(148,163,184,0.4)" }}>
        &copy; {new Date().getFullYear()} FreWork — India&apos;s Business Platform &nbsp;·&nbsp; <Link href="/terms" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(96,165,250,0.6)" }}>Terms</Link> &nbsp;·&nbsp; <Link href="/privacy" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(96,165,250,0.6)" }}>Privacy</Link>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>

      {/* Sticky floating WhatsApp button */}
      <a
        href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20business%20help.%20Please%20guide%20me.`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-full text-sm font-bold text-white transition-all hover:scale-110 hover:shadow-2xl group"
        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", boxShadow: "0 4px 24px rgba(37,211,102,0.5), 0 2px 8px rgba(0,0,0,0.15)" }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span className="hidden sm:inline">WhatsApp Us</span>
      </a>
    </div>
  );
}
