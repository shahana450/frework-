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
  bg: "#060A18",
  bgAlt: "#080E1F",
  bgCard: "#0C1326",
  text: "#F0F4FF",
  textSub: "#8AA0C8",
  textMuted: "#3D5070",
  blue: "#3B82F6",
  blueLight: "#60A5FA",
  blueDark: "#1D4ED8",
  accent: "#3B82F6",
  border: "rgba(59,130,246,0.18)",
  borderLight: "rgba(255,255,255,0.07)",
  shadow: "0 1px 4px rgba(0,0,0,0.5)",
  shadowHover: "0 4px 24px rgba(59,130,246,0.15)",
};

const MODULES = [
  {
    id: "start", label: "START", tagline: "Register & Set Up", emoji: "🏢",
    desc: "Get your business legally incorporated in India – fast, affordable, and fully online.",
    icon: Building2, color: "#3B82F6", href: "/services/compliance", badge: "Most Popular",
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
    icon: IndianRupee, color: "#818CF8", href: "/pricing", badge: "Coming Soon",
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
    icon: Users, color: "#60A5FA", href: "/freelancers", badge: "Live",
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
    icon: TrendingUp, color: "#38BDF8", href: "/services/dpr", badge: null,
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

function BlueDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-4">
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${L.blue})` }} />
      <div className="w-1 h-1 rounded-full" style={{ background: L.blue, opacity: 0.5 }} />
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, ${L.blue}, transparent)` }} />
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const moduleDetailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoggedIn(true);
        setUserName(session.user.user_metadata?.full_name?.split(" ")[0] ?? session.user.email?.split("@")[0] ?? "");
      }
    });
  }, []);

  const handleFrePilotClick = () => {
    if (loggedIn) {
      window.location.href = "/finance";
    } else {
      setShowAuthModal(true);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    sessionStorage.setItem("auth_next", "/finance");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

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
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden" style={{ background:"#060A18", paddingTop:"68px" }}>
        {/* Background: subtle blue glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"10%", top:"5%", width:800, height:500, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 65%)", filter:"blur(80px)" }} />
          <div style={{ position:"absolute", right:"5%", bottom:"10%", width:500, height:400, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 65%)", filter:"blur(70px)" }} />
        </div>

        {/* Services nav strip */}
        <div className="absolute top-[68px] inset-x-0 z-20 overflow-x-auto" style={{ background:"#ffffff", borderBottom:"1px solid rgba(59,130,246,0.15)", boxShadow:"0 2px 12px rgba(59,130,246,0.08)" }}>
          <div className="flex items-center justify-center gap-0 px-6 min-w-max mx-auto">
            {[
              { label:"GST Registration", href:"/services/gst" },
              { label:"Income Tax Return", href:"/services/income-tax" },
              { label:"Company Registration", href:"/services/business-registration" },
              { label:"ROC Compliance", href:"/services/roc-compliance" },
              { label:"TDS Filing", href:"/services/compliance" },
              { label:"Find Professionals", href:"/freelancers" },
              { label:"Coworking Spaces", href:"/coworking" },
              { label:"Virtual CFO", href:"/services/virtual-cfo" },
              { label:"Pitch Deck & DPR", href:"/services/dpr" },
              { label:"Business Audit", href:"/services/audit" },
              { label:"MSME Registration", href:"/services/business-registration" },
            ].map((s, i, arr) => (
              <span key={s.label} className="flex items-center">
                <Link href={s.href}
                  className="text-[11px] font-semibold px-3.5 py-2.5 whitespace-nowrap block transition-all duration-150 rounded"
                  style={{ color:"#1D4ED8", letterSpacing:"0.01em" }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "#ffffff";
                    el.style.background = "#3B82F6";
                    el.style.borderRadius = "4px";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "#1D4ED8";
                    el.style.background = "transparent";
                  }}>
                  {s.label}
                </Link>
                {i < arr.length - 1 && <span style={{ color:"rgba(59,130,246,0.2)", fontSize:"14px", lineHeight:1 }}>│</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Main hero content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-36 pb-14">

          {/* Brand headline */}
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase mb-6 inline-block"
              style={{ background:"rgba(59,130,246,0.1)", borderRadius:"4px", border:"1px solid rgba(59,130,246,0.25)", color:"#60A5FA" }}>
              India&apos;s Business Platform
            </span>
            <h1 className="font-bold leading-[1.05] tracking-tight"
              style={{ fontFamily:"var(--font-plus-jakarta),sans-serif", fontSize:"clamp(2.4rem,5.5vw,4.8rem)", color:"#F0F4FF", letterSpacing:"-0.025em" }}>
              The smarter way to
              <br/>
              <span style={{ background:"linear-gradient(135deg,#60A5FA 0%,#818CF8 60%,#38BDF8 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                run your business.
              </span>
            </h1>
            <p className="text-base max-w-lg mx-auto mt-5" style={{ color:"rgba(138,160,200,0.8)", lineHeight:"1.75" }}>
              Expert CA compliance, verified coworking spaces, and AI-powered accounting — everything your Indian business needs, in one place.
            </p>
          </motion.div>

          {/* ═══ TWO PILLAR CARDS ═══ */}
          <div className="grid md:grid-cols-2 gap-5 mb-10">

            {/* PILLAR 1 — COMPLIANCE */}
            <motion.div initial={{ opacity:0, x:-24 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2, duration:0.5 }}>
              <div className="relative rounded-2xl overflow-hidden h-full group transition-all"
                style={{ background:"linear-gradient(145deg,#0C1326 0%,#0E1830 100%)", border:"1px solid rgba(59,130,246,0.2)", boxShadow:"0 0 0 0 rgba(59,130,246,0)" }}>
                {/* Top accent bar */}
                <div className="h-[3px]" style={{ background:"linear-gradient(90deg,#3B82F6,#818CF8 50%,transparent)" }} />
                <div className="p-7 md:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.25)" }}>
                      <FileText className="w-5 h-5" style={{ color:"#60A5FA" }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color:"#60A5FA" }}>Compliance & Legal</p>
                      <p className="text-[11px]" style={{ color:"rgba(138,160,200,0.55)" }}>Expert CAs &amp; Lawyers</p>
                    </div>
                  </div>
                  <h2 className="font-bold mb-3 leading-[1.1]"
                    style={{ fontSize:"clamp(1.7rem,3vw,2.3rem)", color:"#F0F4FF", letterSpacing:"-0.02em" }}>
                    Register. File. Comply.
                  </h2>
                  <p className="text-sm leading-relaxed mb-6" style={{ color:"rgba(138,160,200,0.75)", lineHeight:"1.7" }}>
                    Company registration, GST, income tax, ROC and MSME — verified Chartered Accountants handle everything end-to-end.
                  </p>
                  {/* Pricing tiers */}
                  <div className="flex gap-2 mb-5">
                    {[
                      { price:"₹999", label:"Basic", services:"GST Reg · MSME · PAN/TAN" },
                      { price:"₹1,999", label:"Standard", services:"ITR Filing · GST Filing · TDS", popular:true },
                      { price:"₹2,999", label:"Pro", services:"ROC · MCA · Company Reg" },
                    ].map(p => (
                      <a key={p.label} href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%27m%20interested%20in%20the%20${p.label}%20plan%20(${encodeURIComponent(p.price)}).`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 rounded-xl p-3 text-center transition-all hover:scale-[1.02]"
                        style={{ background: p.popular ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)", border:`1px solid ${p.popular ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`, position:"relative" }}>
                        {p.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-2.5 py-0.5 rounded-full" style={{ background:"#3B82F6", color:"#fff", whiteSpace:"nowrap" }}>Popular</div>}
                        <div className="text-base font-bold leading-none mb-1" style={{ color: p.popular ? "#60A5FA" : "#3B82F6" }}>{p.price}</div>
                        <div className="text-[9px] font-semibold mb-1" style={{ color:"rgba(240,244,255,0.75)" }}>{p.label}</div>
                        <div className="text-[8px] leading-tight" style={{ color:"rgba(138,160,200,0.5)" }}>{p.services}</div>
                      </a>
                    ))}
                  </div>
                  <div className="flex gap-2.5">
                    <Link href="/services/compliance"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                      style={{ background:"linear-gradient(135deg,#3B82F6,#1D4ED8)", color:"#fff", boxShadow:"0 4px 16px rgba(59,130,246,0.3)" }}>
                      Explore Services <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20help%20with%20compliance%20services.`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-3 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all hover:border-white/15"
                      style={{ borderColor:"rgba(255,255,255,0.09)", color:"rgba(138,160,200,0.7)", background:"rgba(255,255,255,0.03)" }}>
                      <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Free Advice
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* PILLAR 2 — FREPILOT */}
            <motion.div initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.25, duration:0.5 }}>
              <button onClick={handleFrePilotClick} className="w-full h-full text-left group" style={{ background:"none", border:"none", padding:0, cursor:"pointer" }}>
                <div className="relative rounded-2xl overflow-hidden h-full transition-all"
                  style={{ background:"linear-gradient(145deg,#0A1020 0%,#0D1530 100%)", border:"1px solid rgba(99,102,241,0.25)" }}>
                  <div className="h-[3px]" style={{ background:"linear-gradient(90deg,#818CF8,#3B82F6 50%,transparent)" }} />
                  {/* Header bar */}
                  <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b" style={{ borderColor:"rgba(99,102,241,0.12)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background:"rgba(129,140,248,0.15)", border:"1px solid rgba(129,140,248,0.3)" }}>
                        <span style={{ fontSize:"1rem" }}>🛩️</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-none mb-0.5" style={{ color:"#A5B4FC" }}>FrePilot — AI Accountant</p>
                        <p className="text-[11px]" style={{ color:"rgba(129,140,248,0.5)" }}>You Build, We Pilot · ₹2,999/month</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background:"rgba(99,102,241,0.2)", color:"#A5B4FC", border:"1px solid rgba(99,102,241,0.35)" }}>NEW</span>
                  </div>
                  <div className="p-7 md:p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background:"rgba(129,140,248,0.12)", border:"1px solid rgba(129,140,248,0.25)" }}>
                        <Rocket className="w-5 h-5" style={{ color:"#A5B4FC" }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color:"#A5B4FC" }}>AI-Powered Accounting</p>
                        <p className="text-[11px]" style={{ color:"rgba(138,160,200,0.55)" }}>Built for Indian SMBs</p>
                      </div>
                    </div>
                    <h2 className="font-bold mb-3 leading-[1.1]"
                      style={{ fontSize:"clamp(1.7rem,3vw,2.3rem)", color:"#F0F4FF", letterSpacing:"-0.02em" }}>
                      Your books. Done right.
                    </h2>
                    <p className="text-sm leading-relaxed mb-6" style={{ color:"rgba(138,160,200,0.75)", lineHeight:"1.7" }}>
                      GST invoicing, TDS tracking, P&amp;L reports, and an AI accounting assistant — all in one platform built for India.
                    </p>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 mb-6">
                      {["GST Invoicing","AI Chat Assistant","TDS Tracker","P&L & Balance Sheet","Journal Entries","Tally Export"].map(s => (
                        <div key={s} className="flex items-center gap-2 text-xs" style={{ color:"rgba(165,180,252,0.7)" }}>
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background:"rgba(59,130,246,0.15)" }}>
                            <Check className="w-2.5 h-2.5" style={{ color:"#60A5FA" }} />
                          </div>{s}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-0 mb-6 rounded-xl overflow-hidden border" style={{ borderColor:"rgba(99,102,241,0.15)", background:"rgba(99,102,241,0.05)" }}>
                      {[["₹2,999","Per Month"],["Unlimited","Transactions"],["AI","Powered"]].map(([n,l],i,arr) => (
                        <div key={l} className="flex-1 text-center py-3" style={{ borderRight:i<arr.length-1?"1px solid rgba(99,102,241,0.1)":"none" }}>
                          <p className="text-sm font-bold leading-none" style={{ color:"#A5B4FC" }}>{n}</p>
                          <p className="text-[9px] font-medium mt-0.5" style={{ color:"rgba(138,160,200,0.45)" }}>{l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2.5">
                      <span className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all group-hover:opacity-90"
                        style={{ background:"linear-gradient(135deg,#6366F1,#3B82F6)", color:"#fff", boxShadow:"0 4px 16px rgba(99,102,241,0.35)" }}>
                        {loggedIn ? "Open FrePilot" : "Get Started"} <ArrowRight className="w-4 h-4" />
                      </span>
                      {!loggedIn && (
                        <span className="px-4 py-3 rounded-xl text-xs font-medium border flex items-center gap-1.5"
                          style={{ borderColor:"rgba(255,255,255,0.09)", color:"rgba(138,160,200,0.65)", background:"rgba(255,255,255,0.03)" }}>
                          Google Sign-in
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          </div>

          {/* ═══ COWORKING — compact card below ═══ */}
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.5 }} className="mb-10">
            <div className="relative rounded-2xl overflow-hidden transition-all"
              style={{ background:"linear-gradient(145deg,#0C1326,#0E1830)", border:"1px solid rgba(56,189,248,0.2)" }}>
              <div className="h-[2px]" style={{ background:"linear-gradient(90deg,#38BDF8,transparent)" }} />
              <div className="p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.3)" }}>
                  <MapPin className="w-5 h-5" style={{ color:"#38BDF8" }} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-1" style={{ color:"#38BDF8" }}>Premium Coworking</p>
                  <h3 className="font-bold mb-2 leading-tight" style={{ fontSize:"clamp(1.1rem,2vw,1.4rem)", color:"#F0F4FF" }}>
                    Your Ideal Workspace — 8 Indian Cities
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {["Hot Desks from ₹350/day","Private Cabins","Meeting Rooms","200+ Verified Spaces"].map(s => (
                      <span key={s} className="text-xs flex items-center gap-1.5" style={{ color:"rgba(138,160,200,0.65)" }}>
                        <span className="w-1 h-1 rounded-full" style={{ background:"#38BDF8", display:"inline-block", opacity:0.7 }} />{s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2.5 flex-shrink-0">
                  <Link href="/coworking"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ background:"linear-gradient(135deg,#0EA5E9,#0284C7)", color:"#fff", boxShadow:"0 4px 14px rgba(14,165,233,0.3)" }}>
                    Find a Space <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/coworking/list"
                    className="px-4 py-2.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all hover:border-sky-500/30"
                    style={{ borderColor:"rgba(56,189,248,0.2)", color:"rgba(138,160,200,0.65)", background:"rgba(56,189,248,0.05)" }}>
                    List Free
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats strip */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
            className="flex items-center justify-center gap-8 flex-wrap mb-6">
            {[["500+","Businesses Served"],["200+","Verified Spaces"],["8","Indian Cities"],["₹499","Starting Price"]].map(([n,l]) => (
              <div key={l} className="text-center">
                <p className="text-xl font-black leading-none" style={{ color:"#3B82F6" }}>{n}</p>
                <p className="text-[10px] font-semibold mt-1" style={{ color:"rgba(148,163,184,0.45)" }}>{l}</p>
              </div>
            ))}
          </motion.div>

          {/* Trust note */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.45 }}
            className="text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color:"rgba(148,163,184,0.4)" }}>
              <span className="w-1 h-1 rounded-full bg-blue-400" />
              Trusted by 500+ Indian businesses
              <span className="w-1 h-1 rounded-full bg-blue-400" />
              Free WhatsApp consultation
              <span className="w-1 h-1 rounded-full bg-blue-400" />
              100% online
            </div>
          </motion.div>
        </div>
      </section>


      {/* --- PLATFORM OVERVIEW --- */}
      <section className="py-20 px-4 relative" style={{ background: "#07091A", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3" style={{ color: "#3B82F6" }}>One Platform · Five Business Essentials</p>
            <h2 className="font-bold leading-tight" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.8rem,4vw,2.6rem)", color: "#E8E4DA" }}>
              Not just tax. Everything your business needs.
            </h2>
            <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "rgba(122,139,168,0.75)" }}>
              From day 1 incorporation to ongoing compliance, hiring, workspace and funding — all in one platform.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: Building2, title: "Start", sub: "Register & Set Up", stat: "7 days", items: ["Company Registration", "GST Number", "MSME Certificate"], href: "/services/business-registration", color: "#3B82F6" },
              { icon: FileText, title: "Comply", sub: "Tax & Compliance", stat: "from ₹499", items: ["GST Filing", "ITR Filing", "ROC / MCA"], href: "/services/compliance", color: "#60A5FA" },
              { icon: Users, title: "Hire", sub: "Talent & Experts", stat: "24 hr match", items: ["Professionals", "Developers", "Designers"], href: "/freelancers", color: "#818CF8" },
              { icon: MapPin, title: "Work", sub: "Coworking Spaces", stat: "200+ spaces", items: ["Hot Desks", "Private Cabins", "8 Cities"], href: "/coworking", color: "#38BDF8" },
              { icon: TrendingUp, title: "Grow", sub: "Funding & Scale", stat: "500+ clients", items: ["Pitch Decks", "DPR / Business Plan", "Investor Connect"], href: "/services/dpr", color: "#6366F1" },
            ].map((p, idx) => {
              const Icon = p.icon;
              return (
              <Link key={p.title} href={p.href}
                className="group relative rounded-2xl p-5 border cursor-pointer block overflow-hidden"
                style={{ background:"linear-gradient(145deg,#0C1326 0%,#0E1830 100%)", borderColor:"rgba(59,130,246,0.15)", transition:"border-color 0.2s,box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${p.color}45`; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 32px ${p.color}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="rgba(59,130,246,0.15)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}>
                {/* Top accent */}
                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background:`linear-gradient(90deg,${p.color},transparent)` }} />
                {/* Number */}
                <div className="absolute top-4 right-4 text-[9px] font-bold tabular-nums" style={{ color:"rgba(255,255,255,0.1)" }}>0{idx+1}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background:`${p.color}14`, border:`1px solid ${p.color}30` }}>
                  <Icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
                <p className="font-bold text-sm mb-0.5" style={{ color: "#F0F4FF" }}>{p.title}</p>
                <p className="text-[10px] mb-1 font-medium" style={{ color: p.color }}>{p.stat}</p>
                <p className="text-[11px] mb-3" style={{ color: "rgba(138,160,200,0.6)" }}>{p.sub}</p>
                <ul className="space-y-1.5">
                  {p.items.map(item => (
                    <li key={item} className="text-[11px] flex items-center gap-1.5" style={{ color: "rgba(165,180,252,0.55)" }}>
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.color, opacity:0.7 }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-1 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: p.color }}>
                  View details <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            );
            })}
          </div>
        </div>
      </section>

      {/* --- COWORKING SPOTLIGHT --- */}
      <section className="py-20 px-4 relative" style={{ background: "#0A0D20", borderTop: `1px solid rgba(255,255,255,0.05)` }}>
        <div className="absolute inset-0 pointer-events-none" />

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-px w-10" style={{ background: `rgba(59,130,246,0.12)` }} />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "#3B82F6" }}>Coworking</span>
            <div className="h-px flex-1" style={{ background: `rgba(255,255,255,0.05)` }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold tracking-[0.15em] uppercase mb-6 border"
                style={{ background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
                Now Live
              </span>

              <h2 className="font-bold leading-[1.05] mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: L.text }}>
                Your perfect office,<br />
                <span style={{ color: "#3B82F6" }}>wherever you work.</span>
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
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: L.blue }}>Available in</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"].map(city => (
                  <span key={city} className="px-3 py-1 rounded-full text-xs border font-medium"
                    style={{ background: L.bgCard, borderColor: L.borderLight, color: L.textMuted, boxShadow: L.shadow }}>
                    📍 {city}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-0 mb-8 rounded-lg overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>{[{n:"200+",l:"Spaces"},{n:"8",l:"Cities"},{n:"₹350",l:"From /day"}].map((s,idx) => (<div key={s.l} className="flex-1 text-center py-3 px-2" style={{ borderRight: idx<2 ? "1px solid rgba(255,255,255,0.06)" : "none" }}><p className="text-base font-bold" style={{ color: "#3B82F6" }}>{s.n}</p><p className="text-[10px]" style={{ color: L.textMuted }}>{s.l}</p></div>))}</div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "#3B82F6", color: "#07091A" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border transition-all hover:border-white/15"
                  style={{ borderColor: "rgba(255,255,255,0.08)", color: L.textSub, background: L.bgCard }}>
                  List your space – Free
                </Link>
              </div>
            </div>

            {/* Right – Interactive plan card */}
            <div className="relative">
              <div className="rounded-xl overflow-hidden border"
                style={{ background: L.bgCard, borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="h-[2px]" style={{ background: "linear-gradient(90deg,rgba(59,130,246,0.12),rgba(59,130,246,0.12),transparent)" }} />

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
                    style={{ background: "rgba(59,130,246,0.08)", color: "#1D4ED8", borderColor: "rgba(59,130,246,0.2)" }}>
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
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
                          borderColor: "rgba(59,130,246,0.12)", background: "rgba(59,130,246,0.12)",
                        } : {
                          borderColor: "rgba(255,255,255,0.06)", background: L.bgAlt
                        }}>
                        <p className="text-xl mb-1">{plan.emoji}</p>
                        <p className="text-[11px] font-semibold mb-0.5" style={{ color: selectedPlan === plan.key ? "#60A5FA" : L.textSub }}>{plan.label}</p>
                        <p className="text-xs font-bold" style={{ color: selectedPlan === plan.key ? "#3B82F6" : L.textMuted }}>
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
                    className="w-full py-3 rounded-lg text-sm font-semibold text-center block transition-all hover:opacity-90"
                    style={{ background: "#3B82F6", color: "#07091A" }}>
                    Book a Visit →
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
          <div className="text-center mb-8">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#3B82F6" }}>Services · One Platform</p>
            <h2 className="font-bold mb-3 leading-tight"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Everything your business needs
            </h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: L.textSub }}>
              From day one of registration to raising your Series A — click any card to learn more.
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
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.blue }}>How it works</p>
            <BlueDivider />
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
                        <span className="font-black text-2xl" style={{ color: L.blue }}>{step.n}</span>
                      </div>
                      <h3 className="font-bold mb-3 text-base text-center" style={{ color: L.text }}>{step.t}</h3>
                      <p className="text-sm leading-relaxed text-center mb-3" style={{ color: L.textSub }}>{step.d}</p>

                      <div className="flex justify-center">
                        <span className="text-xs font-semibold" style={{ color: L.blue }}>
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
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.blue }}>Why FreWork</p>
            <BlueDivider />
            <h2 className="font-black mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Your complete business platform, <span style={{ color: L.blue }}>all in one place</span>
            </h2>
            <p className="mt-3 text-sm max-w-sm mx-auto" style={{ color: L.textSub }}>
              From incorporation to GST, hiring to workspace — everything a growing Indian business needs, handled.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Shield, t: "One account, everything done", d: "Company registration, GST filing, ITR, coworking space booking and hiring — all from one account, one dashboard.", extra: "No more juggling 10 different portals. FreWork handles company formation, all tax filings, workspace booking and professional hiring in one place." },
              { icon: Clock, t: "From day 1 to growth", d: "Register your company, get GST, hire your team, find a workspace, raise funding — FreWork covers every stage of your business journey.", extra: "Whether you are just starting out or scaling up, FreWork has the tools and experts you need. Our platform grows with your business." },
              { icon: Star, t: "Built for Indian business", d: "Indian compliance, Indian cities, Indian pricing. We understand the real challenges of SMEs, startups and solo founders in India.", extra: "Our platform is built by a team that includes practicing CAs, former startup founders and operations experts — people who have faced the same problems." },
            ].map((item, i) => {
              const Icon = item.icon;
              const [open, setOpen] = useState(false);
              return (
                <motion.div key={item.t}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <button className="w-full text-left" onClick={() => setOpen(!open)}>
                    <div className="p-6 rounded-xl border transition-all duration-300 relative overflow-hidden"
                      style={{ background: L.bgCard, borderColor: open ? "rgba(59,130,246,0.12)" : L.borderLight }}>
                      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, rgba(59,130,246,0.12), transparent)` }} />
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                        style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.12)" }}>
                        <Icon className="w-5 h-5" style={{ color: "#3B82F6" }} />
                      </div>
                      <h3 className="font-semibold mb-2 text-base" style={{ color: L.text }}>{item.t}</h3>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: L.textSub }}>{item.d}</p>
                      <span className="text-xs font-medium" style={{ color: "#3B82F6" }}>{open ? "Show less" : "Read more"}</span>
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
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.blue }}>What our clients say</p>
            <h2 className="font-black" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.5rem,3.5vw,2.2rem)", color: L.text }}>
              Trusted by growing businesses
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote: "FreWork registered my company and GST in 6 days. I was expecting it to take a month. The process was completely seamless.", name: "Rahul Sharma", role: "Founder, TechStart Pune", color: "#3B82F6" },
              { quote: "Booked a hot desk through FreWork and it was perfectly set up. Every space is personally verified — you get exactly what you see.", name: "Priya Menon", role: "Freelance Designer, Bangalore", color: "#3B82F6" },
              { quote: "Our CA through FreWork filed 3 years of pending ITR in 4 days. Affordable, fast, and genuinely professional service.", name: "Anil Gupta", role: "SME Owner, Delhi NCR", color: "#3B82F6" },
            ].map((item) => (
              <div key={item.name} className="rounded-2xl p-6 border" style={{ background: L.bgCard, borderColor: `${item.color}22`, boxShadow: L.shadow }}>
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <span key={i} style={{ color: "#3B82F6", fontSize: "14px" }}>★</span>)}
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
              { icon: Building2, label: "Company Registration", href: "/services/business-registration" },
              { icon: MapPin, label: "Find Coworking Space", href: "/coworking" },
              { icon: Users, label: "Hire Talent", href: "/freelancers" },
              { icon: Presentation, label: "Pitch Deck & DPR", href: "/services/dpr" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance" },
              { icon: BarChart3, label: "Virtual Accountant", href: "/services/accounting" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-3.5 rounded-lg border transition-all group hover:border-white/12"
                  style={{ background: L.bgCard, borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.12)" }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: "#3B82F6" }} />
                  </div>
                  <span className="text-xs font-medium leading-tight" style={{ color: L.textSub }}>{s.label}</span>
                  <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#3B82F6" }} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-24 px-4 relative overflow-hidden" style={{ background: "#060A18", borderTop:"1px solid rgba(59,130,246,0.12)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"20%", top:"-30%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 60%)", filter:"blur(80px)" }} />
        </div>
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-4" style={{ color: "#60A5FA" }}>Ready to start?</p>
          <h2 className="font-bold mb-4 leading-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 4.5vw, 3rem)", color: "#F0F4FF" }}>
            India&apos;s complete business platform.
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto" style={{ color: "rgba(138,160,200,0.7)" }}>
            Join founders, SMEs, and professionals building their business with FreWork.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link href="/register"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background:"linear-gradient(135deg,#3B82F6,#1D4ED8)", color:"#fff", boxShadow:"0 6px 24px rgba(59,130,246,0.35)" }}>
              Get Started Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm border transition-all hover:border-blue-500/30"
              style={{ borderColor: "rgba(59,130,246,0.2)", color: "rgba(165,180,252,0.8)", background: "rgba(59,130,246,0.05)" }}>
              <Phone className="w-4 h-4" style={{ color: "#60A5FA" }} /> {SUPPORT_PHONE}
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {["Company Registration", "GST Filing", "Coworking", "Hire Talent", "Pitch Decks"].map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(138,160,200,0.4)" }}>
                <span className="w-1 h-1 rounded-full" style={{ background: "#3B82F6", opacity:0.5 }} />{s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="py-6 text-center text-xs border-t" style={{ borderColor: "rgba(37,99,235,0.12)", background: "#08112A", color: "rgba(148,163,184,0.4)" }}>
        &copy; {new Date().getFullYear()} FreWork — India&apos;s Business Platform &nbsp;·&nbsp; <Link href="/terms" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(96,165,250,0.6)" }}>Terms</Link> &nbsp;·&nbsp; <Link href="/privacy" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(96,165,250,0.6)" }}>Privacy</Link>
      </div>

      <style jsx global>{`
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
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

      {/* ═══ FREPILOT AUTH MODAL ═══ */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(7,12,26,0.88)", backdropFilter: "blur(12px)" }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: "linear-gradient(160deg,#0C1326,#0E1A38)", border: "1px solid rgba(59,130,246,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#3B82F6,#818CF8,#3B82F6)" }} />
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:opacity-70"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(237,232,220,0.5)", border: "1px solid rgba(237,232,220,0.1)" }}
            >✕</button>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.06))", border: "1px solid rgba(59,130,246,0.3)" }}>
                🛩️
              </div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-2" style={{ color: "#3B82F6" }}>FrePilot by FreWork</p>
              <h3 className="font-black text-xl mb-1" style={{ color: "#EDE8DC", letterSpacing: "-0.02em" }}>Sign in to access FrePilot</h3>
              <p className="text-xs mb-6" style={{ color: "rgba(148,163,184,0.5)" }}>Your AI accountant — GST, books, TDS and more.</p>
              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#fff", color: "#1a1a1a", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
              >
                {authLoading ? (
                  <span style={{ color: "#666" }}>Redirecting…</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </>
                )}
              </button>
              <p className="text-[10px] mt-4" style={{ color: "rgba(148,163,184,0.3)" }}>By continuing you agree to FreWork&apos;s Terms &amp; Privacy Policy</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

