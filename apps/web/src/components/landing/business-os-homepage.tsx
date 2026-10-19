"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AnnouncementTicker } from "@/components/landing/announcement-ticker";

// B7: named testimonials stay hidden until the owner confirms the people are real clients who consented
const SHOW_TESTIMONIALS = false;
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
  bg: "#F2F3F6",
  bgAlt: "#FFFFFF",
  bgCard: "#FFFFFF",
  text: "#141A3A",
  textSub: "#5A6080",
  textMuted: "#5A6080",
  blue: "#232A63",
  blueLight: "#C2410C",
  blueDark: "#1A1F4E",
  accent: "#232A63",
  border: "rgba(35,42,99,0.18)",
  borderLight: "rgba(20,26,58,0.09)",
  shadow: "0 1px 4px rgba(20,26,58,0.14)",
  shadowHover: "0 4px 24px rgba(35,42,99,0.15)",
};

const MODULES = [
  {
    id: "start", label: "START", tagline: "Register & Set Up", emoji: "🏢",
    desc: "Get your business legally incorporated in India – fast, affordable, and fully online.",
    icon: Building2, color: "#232A63", href: "/services/compliance", badge: "Most Popular",
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
    icon: FileText, color: "#232A63", href: "/services/compliance", badge: null,
    items: ["Income Tax (ITR)", "GST Filing", "ROC / MCA", "TDS Filing"],
    detail: {
      heading: "Never miss a compliance deadline",
      why: "Penalties for missed GST or ITR filings can be severe. FreWork tracks every deadline for you and files returns accurately and on time.",
      steps: ["Share your data or grant portal access", "We reconcile and prepare returns", "You approve before filing", "Acknowledgement delivered instantly"],
      pricing: "Priced per filing",
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
    icon: IndianRupee, color: "#C2410C", href: "/pricing", badge: "Live",
    items: ["Invoicing", "Payroll", "Bookkeeping", "Reports"],
    detail: {
      heading: "Your finance team, built in",
      why: "Most SMEs lose money due to poor bookkeeping and late invoicing. FreWork gives you professional-grade finance tools without hiring a full-time accountant.",
      steps: ["Connect your bank account", "Auto-categorize transactions", "Generate GST-ready invoices", "Get monthly P&L reports"],
      pricing: "FreBook from ₹399/mo + GST",
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
    icon: Users, color: "#C2410C", href: "/freelancers", badge: "Live",
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
    icon: TrendingUp, color: "#C2410C", href: "/services/dpr", badge: null,
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
    icon: MapPin, color: "#C2410C", href: "/coworking", badge: "Live",
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
      steps: ["Create your startup profile", "Get visibility to investors", "Participate in pitch events", "Close your round with legal support"],
      pricing: "Free to list",
      time: "Investor match in 7 days",
      features: [
        { icon: Rocket, text: "Startup profile visible to investors" },
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
  const [demoRun, setDemoRun] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setDemoRun(n => n + 1), 7000);
    return () => clearInterval(t);
  }, []);
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

  const handleFreBookClick = () => {
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

      {/* --- HERO: FreBook first --- */}
      <section className="relative overflow-hidden" style={{ background:"#F4F5FA", paddingTop:"92px", fontFamily:"var(--font-plus-jakarta),var(--font-inter),system-ui,sans-serif" }}>
        {/* Atmosphere: warm glow behind the headline, cool glow behind the demo, faint grid */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{ position:"absolute", left:"-8%", top:"6%", width:620, height:520, borderRadius:"50%", background:"radial-gradient(closest-side, rgba(240,102,43,0.16), transparent)", filter:"blur(30px)" }} />
          <div style={{ position:"absolute", right:"-6%", top:"0%", width:760, height:640, borderRadius:"50%", background:"radial-gradient(closest-side, rgba(58,67,142,0.20), transparent)", filter:"blur(30px)" }} />
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(35,42,99,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(35,42,99,0.05) 1px, transparent 1px)", backgroundSize:"44px 44px", maskImage:"radial-gradient(ellipse 70% 60% at 70% 40%, #000 30%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 70% 60% at 70% 40%, #000 30%, transparent 75%)" }} />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-14 md:pt-20 pb-16">
          <div className="grid lg:grid-cols-[1.02fr_1fr] gap-12 lg:gap-14 items-center">

            {/* Left: the promise */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
              <span className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 text-[12px] font-bold rounded-full"
                style={{ background:"#FFFFFF", color:"#232A63", border:"1px solid rgba(35,42,99,0.12)", boxShadow:"0 4px 14px rgba(20,26,58,0.06)" }}>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide" style={{ background:"#F0662B", color:"#fff" }}>NEW</span>
                FreBook — the AI accountant for Indian businesses
              </span>
              <h1 className="font-extrabold mt-6"
                style={{ fontSize:"clamp(2.4rem,4.6vw,4rem)", color:"#141A3A", letterSpacing:"-0.035em", lineHeight:1.02 }}>
                Your AI accountant.
                <br />
                <span style={{ background:"linear-gradient(100deg,#F0662B 10%,#FF8A4C 55%,#E2541B 90%)", WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent" }}>Chat in. Books out.</span>
              </h1>
              <p className="mt-5 max-w-[34rem]" style={{ color:"#4A5070", fontSize:"1.075rem", lineHeight:1.7 }}>
                Tell FreBook what happened — on the web or WhatsApp, in English or Hinglish. It drafts the entry, you approve it, and it lands in your books <b style={{ color:"#141A3A" }}>and in Tally</b>. Invoices, bank import, GST and live P&amp;L included.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={handleFreBookClick}
                  className="group flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-bold transition-all hover:-translate-y-0.5"
                  style={{ background:"linear-gradient(180deg,#2C3478,#1E2459)", color:"#fff", boxShadow:"0 12px 28px rgba(35,42,99,0.32), inset 0 1px 0 rgba(255,255,255,0.15)", border:"none", cursor:"pointer" }}>
                  {loggedIn ? "Open FreBook" : "Start your free week"} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
              <p className="mt-4 text-[13.5px] font-medium" style={{ color:"#5A6080" }}>
                <b style={{ color:"#0B7A55" }}>14 days free</b> · then from ₹399/month + GST · cancel anytime · no card to start
              </p>
              <div className="mt-9">
                <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color:"#8A90AE" }}>Works with what you already use</p>
                <div className="flex flex-wrap gap-2">
                  {["Tally Prime", "WhatsApp", "Excel", "Bank PDFs & CSV", "GST portal", "Razorpay"].map(t => (
                    <span key={t} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold" style={{ background:"rgba(255,255,255,0.75)", border:"1px solid rgba(20,26,58,0.08)", color:"#232A63" }}>{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right: a demo that plays on a loop, like a short screen recording */}
            <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15, duration:0.55 }} className="relative">
              <div className="absolute -inset-4 rounded-[34px] pointer-events-none" aria-hidden="true" style={{ background:"linear-gradient(140deg,rgba(240,102,43,0.22),rgba(58,67,142,0.22))", filter:"blur(28px)" }} />
              <div className="relative rounded-[26px] overflow-hidden" style={{ background:"#FFFFFF", border:"1px solid rgba(20,26,58,0.08)", boxShadow:"0 30px 70px rgba(20,26,58,0.18)" }}>
                <div className="flex items-center gap-3 px-5 py-4" style={{ background:"linear-gradient(180deg,#2A3172,#20265C)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-black" style={{ background:"#FFFFFF", color:"#232A63" }}>F</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white leading-none">FreBook</p>
                    <p className="text-[11.5px] mt-1 flex items-center gap-1.5" style={{ color:"#C8D2F2" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background:"#4ADE80" }} /> online · replies in seconds</p>
                  </div>
                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ background:"rgba(255,255,255,0.12)", color:"#FFD9C7" }}>LIVE DEMO</span>
                </div>
                {/* Scene tabs — the demo plays through these like a short video; tap one to jump */}
                <div role="tablist" aria-label="FreBook demo" className="grid grid-cols-5 gap-1 p-1.5" style={{ background:"#1B2156" }}>
                  {["Chat", "WhatsApp", "Bill / PDF", "Bulk", "Tally"].map((t, i) => {
                    const on = demoRun % 5 === i;
                    return (
                      <button key={t} role="tab" aria-selected={on} onClick={() => setDemoRun(i)}
                        className="relative h-8 rounded-lg text-[12px] font-bold overflow-hidden transition-colors"
                        style={{ background: on ? "rgba(255,255,255,0.14)" : "transparent", color: on ? "#FFFFFF" : "#9AA3D4", border:"none", cursor:"pointer" }}>
                        {t}
                        {on && <motion.span key={demoRun} initial={{ width:"0%" }} animate={{ width:"100%" }} transition={{ duration:7, ease:"linear" }}
                          className="absolute left-0 bottom-0 h-[2px]" style={{ background:"#F0662B" }} />}
                      </button>
                    );
                  })}
                </div>

                <div key={demoRun} className="relative p-5 flex flex-col gap-3 min-h-[340px]" style={{ background:"linear-gradient(180deg,#F7F8FC,#F1F3FA)" }}>
                  {demoRun % 5 === 0 && <>
                    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                      className="self-end max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-[14px] font-medium" style={{ background:"#232A63", color:"#fff" }}>
                      Paid office rent ₹25,000 from HDFC
                    </motion.div>
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:[0,1,1,0] }} transition={{ delay:0.8, duration:0.9, times:[0,0.1,0.8,1] }}
                      className="absolute left-5 top-[76px] flex gap-1 px-3.5 py-3 rounded-2xl" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.06)" }} aria-hidden="true">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background:"#9AA0BE", animationDelay:`${i*0.12}s` }} />)}
                    </motion.div>
                    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:1.7 }}
                      className="self-start w-[92%] rounded-2xl rounded-bl-md p-4" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.07)", boxShadow:"0 6px 16px rgba(20,26,58,0.05)" }}>
                      <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color:"#E2541B" }}>Draft entry</p>
                      <div className="mt-2.5 text-[14px] font-semibold" style={{ color:"#141A3A", fontVariantNumeric:"tabular-nums" }}>
                        <div className="flex justify-between"><span>Dr Rent</span><span>₹25,000</span></div>
                        <div className="flex justify-between pl-5 mt-1" style={{ color:"#4A5070" }}><span>Cr HDFC Bank</span><span>₹25,000</span></div>
                      </div>
                      <p className="mt-2.5 text-[12px]" style={{ color:"#6B7194" }}>Same ledger you used for rent last month.</p>
                    </motion.div>
                    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:2.6 }}
                      className="self-end px-4 py-2 rounded-2xl rounded-br-md text-[14px] font-bold" style={{ background:"#232A63", color:"#fff" }}>YES</motion.div>
                    <motion.div initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay:3.2, type:"spring", stiffness:260, damping:18 }}
                      className="self-start flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13.5px] font-bold" style={{ background:"#E3F6EE", color:"#0B7A55" }}>
                      <Check className="w-4 h-4" /> Posted · PMT/2026-27/0042
                    </motion.div>
                  </>}

                  {demoRun % 5 === 1 && (
                    /* The same entry on WhatsApp — looks like the real app */
                    <div className="-m-5 flex flex-col min-h-[340px]" style={{ background:"#EFE7DD" }}>
                      <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background:"#075E54" }}>
                        <div className="w-8 h-8 rounded-full grid place-items-center text-[13px] font-black" style={{ background:"#FFFFFF", color:"#232A63" }}>F</div>
                        <div className="flex-1">
                          <p className="text-[13.5px] font-bold text-white leading-none flex items-center gap-1">FreBook <span className="w-3.5 h-3.5 rounded-full grid place-items-center text-[8px]" style={{ background:"#25D366", color:"#fff" }}>✓</span></p>
                          <p className="text-[11px] mt-0.5" style={{ color:"#CDE8E2" }}>Business account</p>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2 p-3.5" style={{ backgroundImage:"radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize:"14px 14px" }}>
                        <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                          className="self-end max-w-[78%] px-3 py-1.5 rounded-lg rounded-tr-none text-[13.5px]" style={{ background:"#D9FDD3", color:"#111B21", boxShadow:"0 1px 0.5px rgba(0,0,0,0.13)" }}>
                          200 ka petrol cash mein
                          <span className="ml-2 text-[10px] align-bottom" style={{ color:"#667781" }}>10:42 <motion.span initial={{ color:"#8696A0" }} animate={{ color:"#53BDEB" }} transition={{ delay:1 }}>✓✓</motion.span></span>
                        </motion.div>
                        <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:1.4 }}
                          className="self-start max-w-[86%] px-3 py-2 rounded-lg rounded-tl-none text-[13px]" style={{ background:"#FFFFFF", color:"#111B21", boxShadow:"0 1px 0.5px rgba(0,0,0,0.13)" }}>
                          <p className="font-bold">📝 Draft · today</p>
                          <p className="italic" style={{ color:"#3B4A54" }}>Petrol ₹200 paid in cash</p>
                          <div className="mt-1.5" style={{ fontVariantNumeric:"tabular-nums" }}>
                            <div className="flex justify-between gap-6"><span>Dr Petrol &amp; Fuel</span><span>₹200</span></div>
                            <div className="flex justify-between gap-6 pl-3"><span>Cr Cash</span><span>₹200</span></div>
                          </div>
                          <p className="mt-1.5">Reply <b>YES</b> to post · <b>NO</b> to cancel</p>
                        </motion.div>
                        <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:2.8 }}
                          className="self-end px-3 py-1.5 rounded-lg rounded-tr-none text-[13.5px]" style={{ background:"#D9FDD3", color:"#111B21", boxShadow:"0 1px 0.5px rgba(0,0,0,0.13)" }}>
                          YES <span className="ml-2 text-[10px]" style={{ color:"#667781" }}>10:43 <motion.span initial={{ color:"#8696A0" }} animate={{ color:"#53BDEB" }} transition={{ delay:3.4 }}>✓✓</motion.span></span>
                        </motion.div>
                        <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:3.8 }}
                          className="self-start max-w-[86%] px-3 py-2 rounded-lg rounded-tl-none text-[13px]" style={{ background:"#FFFFFF", color:"#111B21", boxShadow:"0 1px 0.5px rgba(0,0,0,0.13)" }}>
                          ✅ Posted as <b>PMT/2026-27/0043</b><br />
                          <span style={{ color:"#3B4A54" }}>Say <b>YES</b> if you need the dashboard view.</span>
                        </motion.div>
                      </div>
                    </div>
                  )}

                  {demoRun % 5 === 2 && <>
                    {/* A bill photo arrives and is read */}
                    <motion.div initial={{ opacity:0, y:-14, rotate:-4 }} animate={{ opacity:1, y:0, rotate:-2 }} transition={{ delay:0.3, type:"spring", stiffness:180, damping:16 }}
                      className="self-end relative w-[62%] rounded-xl overflow-hidden p-3.5" style={{ background:"#FFFDF7", border:"1px solid #E9E1CC", boxShadow:"0 10px 24px rgba(20,26,58,0.12)", fontFamily:"ui-monospace,monospace" }}>
                      <p className="text-[11px] font-bold" style={{ color:"#3B3B3B" }}>SHREE OFFICE MART</p>
                      <p className="text-[9.5px]" style={{ color:"#7A7A7A" }}>GSTIN 32ABCDE1234F1Z5 · Inv 1187</p>
                      <div className="mt-2 text-[10px] space-y-0.5" style={{ color:"#444" }}>
                        <div className="flex justify-between"><span>Printer paper ×10</span><span>2,500</span></div>
                        <div className="flex justify-between"><span>CGST 9% / SGST 9%</span><span>450</span></div>
                        <div className="flex justify-between font-bold"><span>TOTAL</span><span>2,950</span></div>
                      </div>
                      <motion.div initial={{ top:"0%" }} animate={{ top:["0%","100%","0%"] }} transition={{ delay:0.9, duration:1.6, ease:"easeInOut" }}
                        className="absolute left-0 right-0 h-[3px]" style={{ background:"linear-gradient(90deg,transparent,#F0662B,transparent)", boxShadow:"0 0 12px #F0662B" }} aria-hidden="true" />
                    </motion.div>
                    <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1 }} className="self-end text-[11.5px] font-semibold" style={{ color:"#6B7194" }}>bill-1187.jpg · reading…</motion.p>
                    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:2.6 }}
                      className="self-start w-[92%] rounded-2xl rounded-bl-md p-4" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.07)" }}>
                      <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color:"#E2541B" }}>Read from the bill</p>
                      <div className="mt-2 text-[13.5px] font-semibold" style={{ color:"#141A3A", fontVariantNumeric:"tabular-nums" }}>
                        <div className="flex justify-between"><span>Dr Office Supplies</span><span>₹2,500</span></div>
                        <div className="flex justify-between"><span>Dr Input CGST + SGST</span><span>₹450</span></div>
                        <div className="flex justify-between pl-5" style={{ color:"#4A5070" }}><span>Cr Shree Office Mart</span><span>₹2,950</span></div>
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay:3.8, type:"spring", stiffness:260, damping:18 }}
                      className="self-start flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold" style={{ background:"#E3F6EE", color:"#0B7A55" }}>
                      <Check className="w-4 h-4" /> Supplier, GSTIN & GST split filled in
                    </motion.div>
                  </>}

                  {demoRun % 5 === 3 && <>
                    {/* A statement / Excel with many rows */}
                    <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background:"#fff", border:"1.5px dashed rgba(35,42,99,0.25)" }}>
                      <span className="w-10 h-10 rounded-xl grid place-items-center text-[11px] font-black" style={{ background:"#E7F6EC", color:"#137A3B" }}>XLS</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-bold truncate" style={{ color:"#141A3A" }}>HDFC-statement-Sep.xlsx</p>
                        <p className="text-[11.5px]" style={{ color:"#6B7194" }}>42 transactions · also PDF, CSV, receipts template</p>
                      </div>
                    </motion.div>
                    <div className="flex flex-col gap-1.5">
                      {[["02 Sep","Rent — Vijay Properties","−25,000","Rent"],["05 Sep","UPI from Asha Traders","+18,000","Asha Traders"],["09 Sep","KSEB electricity","−3,450","Electricity"],["12 Sep","Amazon Business","−1,180","Office Supplies"]].map((r, i) => (
                        <motion.div key={r[1]} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.9 + i * 0.35 }}
                          className="grid grid-cols-[46px_1fr_auto] items-center gap-2 px-3 py-2 rounded-xl text-[12px]" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.06)" }}>
                          <span style={{ color:"#8A90AE", fontVariantNumeric:"tabular-nums" }}>{r[0]}</span>
                          <span className="truncate" style={{ color:"#141A3A" }}>{r[1]} <span style={{ color:"#E2541B" }}>→ {r[3]}</span></span>
                          <span className="font-bold" style={{ color: r[2].startsWith("+") ? "#0B7A55" : "#141A3A", fontVariantNumeric:"tabular-nums" }}>{r[2]}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(35,42,99,0.10)" }}>
                        <motion.div initial={{ width:"0%" }} animate={{ width:"100%" }} transition={{ delay:2.4, duration:2.2, ease:"easeOut" }} className="h-full rounded-full" style={{ background:"linear-gradient(90deg,#3A438E,#F0662B)" }} />
                      </div>
                      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:4.6 }} className="mt-2 text-[13px] font-bold" style={{ color:"#0B7A55" }}>
                        ✓ 38 posted · 4 need a quick look · duplicates skipped
                      </motion.p>
                    </div>
                  </>}

                  {demoRun % 5 === 4 && <>
                    {/* Push to Tally */}
                    <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.07)" }}>
                      <span className="w-10 h-10 rounded-xl grid place-items-center text-[12px] font-black" style={{ background:"#EAF2FF", color:"#1F5EFF" }}>T</span>
                      <div className="flex-1">
                        <p className="text-[13.5px] font-bold" style={{ color:"#141A3A" }}>TallyPrime · Kumar Traders</p>
                        <p className="text-[11.5px] flex items-center gap-1.5" style={{ color:"#0B7A55" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background:"#22C55E" }} /> connected on this computer</p>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg text-[12px] font-bold" style={{ background:"#232A63", color:"#fff" }}>Push 42</span>
                    </motion.div>
                    <div className="flex flex-col gap-1.5">
                      {["PMT/2026-27/0042 · Rent", "RCT/2026-27/0019 · Asha Traders", "PUR/2026-27/0031 · Shree Office Mart", "JV/2026-27/0007 · Depreciation"].map((v, i) => (
                        <motion.div key={v} initial={{ opacity:0.35 }} animate={{ opacity:1 }} transition={{ delay:1.1 + i * 0.55 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px]" style={{ background:"#fff", border:"1px solid rgba(20,26,58,0.06)", color:"#141A3A" }}>
                          <motion.span initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:1.3 + i * 0.55, type:"spring", stiffness:300, damping:15 }}
                            className="w-5 h-5 rounded-full grid place-items-center" style={{ background:"#E3F6EE", color:"#0B7A55" }}><Check className="w-3 h-3" /></motion.span>
                          <span className="font-semibold" style={{ fontVariantNumeric:"tabular-nums" }}>{v}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(35,42,99,0.10)" }}>
                      <motion.div initial={{ width:"0%" }} animate={{ width:"100%" }} transition={{ delay:1, duration:3.4, ease:"easeInOut" }} className="h-full rounded-full" style={{ background:"#1F5EFF" }} />
                    </div>
                    <motion.div initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay:4.6, type:"spring", stiffness:260, damping:18 }}
                      className="self-start flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13.5px] font-bold" style={{ background:"#E3F6EE", color:"#0B7A55" }}>
                      <Check className="w-4 h-4" /> 42 vouchers in Tally · nothing typed twice
                    </motion.div>
                  </>}
                </div>
                <div className="grid grid-cols-3 text-center" style={{ borderTop:"1px solid rgba(20,26,58,0.07)" }}>
                  {[["Bills & statements","read for you"],["P&L, Balance Sheet","always live"],["GSTR-1 / 3B","prepared"]].map(([a,b],i) => (
                    <div key={a} className="py-3.5 px-2" style={{ borderRight: i < 2 ? "1px solid rgba(20,26,58,0.07)" : "none" }}>
                      <p className="text-[12.5px] font-bold" style={{ color:"#141A3A" }}>{a}</p>
                      <p className="text-[11.5px]" style={{ color:"#6B7194" }}>{b}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Secondary: CA services and coworking */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
            className="mt-16 grid md:grid-cols-[1.6fr_1fr] gap-4">
            <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background:"rgba(255,255,255,0.85)", border:"1px solid rgba(20,26,58,0.08)" }}>
              <div className="flex-1">
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color:"#C2410C" }}>Need a CA too?</p>
                <p className="mt-1 text-[15px] font-bold" style={{ color:"#141A3A" }}>GST registration ₹999 · ITR filing ₹799 · Company registration · ROC</p>
                <p className="text-[13px]" style={{ color:"#5A6080" }}>Done end-to-end by verified Chartered Accountants.</p>
              </div>
              <Link href="/services/compliance" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap"
                style={{ background:"rgba(35,42,99,0.08)", color:"#232A63" }}>
                Explore services <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background:"rgba(255,255,255,0.85)", border:"1px solid rgba(20,26,58,0.08)" }}>
              <MapPin className="w-5 h-5 flex-shrink-0" style={{ color:"#C2410C" }} />
              <div className="flex-1">
                <p className="text-[15px] font-bold" style={{ color:"#141A3A" }}>Coworking in 8 cities</p>
                <p className="text-[13px]" style={{ color:"#5A6080" }}>Hot desks from ₹350/day</p>
              </div>
              <Link href="/coworking" className="text-sm font-bold whitespace-nowrap" style={{ color:"#232A63" }}>Find a space →</Link>
            </div>
          </motion.div>
        </div>
      </section>


      {/* --- FREBOOK MANAGED --- */}
      <section id="frebook-managed" className="py-16 px-4" style={{ background: "#FFFFFF", borderTop: "1px solid rgba(20,26,58,0.07)" }}>
        <div className="container max-w-6xl mx-auto">
          <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] items-center rounded-[28px] p-7 md:p-10 relative overflow-hidden"
            style={{ background: "radial-gradient(120% 90% at 0% 0%, #24564A 0%, #133A31 45%, #0B211C 100%)", color: "#FFFFFF", boxShadow: "0 30px 60px -40px rgba(15,43,37,0.8)" }}>
            <div aria-hidden="true" className="absolute -right-24 -top-24 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(217,181,111,0.28), transparent 70%)" }} />
            <div className="relative flex flex-col gap-4">
              <span className="text-[11px] font-extrabold tracking-[0.2em] uppercase" style={{ color: "#D9B56F" }}>Done for you</span>
              <h2 className="text-3xl md:text-4xl font-black leading-tight" style={{ textWrap: "balance" }}>FreBook Managed</h2>
              <p className="text-base md:text-lg leading-relaxed" style={{ color: "#C9D3CE", maxWidth: 520 }}>
                Hand over your books. Our accounts team keeps them up to date, files your GST every month, and you see everything live on your phone.
              </p>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>₹3,999</span>
                <span className="text-base font-semibold pb-1.5" style={{ color: "#C9D3CE" }}>/month</span>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <a href={`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent("Hi FreWork, I'd like to get started with FreBook Managed (₹3,999/month). Please guide me.")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-xl font-extrabold text-[15px] transition-transform hover:-translate-y-0.5"
                  style={{ background: "#25D366", color: "#08311E", boxShadow: "0 12px 24px -12px rgba(37,211,102,0.7)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
                  Get started on WhatsApp
                </a>
              </div>
            </div>
            <ul className="relative grid gap-3">
              {[
                { t: "Monthly bookkeeping", d: "Done by your dedicated accounts team." },
                { t: "GSTR-1 & GSTR-3B filed", d: "Every month, on time." },
                { t: "Real-time dashboard on your phone", d: "Sales, expenses, cash, dues and GST." },
                { t: "24×7 replies on WhatsApp", d: "Ask anything about your books, any time." },
              ].map(f => (
                <li key={f.t} className="flex gap-3 items-start rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-black" style={{ background: "#D9B56F", color: "#1B2A22" }}>✓</span>
                  <span>
                    <span className="block font-extrabold text-[15px]">{f.t}</span>
                    <span className="block text-sm" style={{ color: "#C9D3CE" }}>{f.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --- PLATFORM OVERVIEW --- */}
      <section className="py-20 px-4 relative" style={{ background: "#F2F3F6", borderTop:"1px solid rgba(20,26,58,0.07)" }}>
        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3" style={{ color: "#232A63" }}>One Platform · Five Business Essentials</p>
            <h2 className="font-bold leading-tight" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.8rem,4vw,2.6rem)", color: "#141A3A" }}>
              Not just tax. Everything your business needs.
            </h2>
            <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#4A5070" }}>
              From day 1 incorporation to ongoing compliance, hiring, workspace and funding — all in one platform.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: Building2, title: "Start", sub: "Register & Set Up", stat: "7 days", items: ["Company Registration", "GST Number", "MSME Certificate"], href: "/services/business-registration", color: "#232A63" },
              { icon: FileText, title: "Comply", sub: "Tax & Compliance", stat: "CA-led", items: ["GST Filing", "ITR Filing", "ROC / MCA"], href: "/services/compliance", color: "#C2410C" },
              { icon: Users, title: "Hire", sub: "Talent & Experts", stat: "24 hr match", items: ["Professionals", "Developers", "Designers"], href: "/freelancers", color: "#C2410C" },
              { icon: MapPin, title: "Work", sub: "Coworking Spaces", stat: "Verified spaces", items: ["Hot Desks", "Private Cabins", "8 Cities"], href: "/coworking", color: "#C2410C" },
              { icon: TrendingUp, title: "Grow", sub: "Funding & Scale", stat: "Investor-ready", items: ["Pitch Decks", "DPR / Business Plan", "Investor Connect"], href: "/services/dpr", color: "#232A63" },
            ].map((p, idx) => {
              const Icon = p.icon;
              return (
              <Link key={p.title} href={p.href}
                className="group relative rounded-2xl p-5 border cursor-pointer block overflow-hidden"
                style={{ background:"linear-gradient(145deg,#FFFFFF 0%,#FFFFFF 100%)", borderColor:"rgba(35,42,99,0.15)", transition:"border-color 0.2s,box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${p.color}45`; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 32px ${p.color}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="rgba(35,42,99,0.15)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}>
                {/* Top accent */}
                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background:`linear-gradient(90deg,${p.color},transparent)` }} />
                {/* Number */}
                <div className="absolute top-4 right-4 text-[9px] font-bold tabular-nums" style={{ color:"rgba(20,26,58,0.13)" }}>0{idx+1}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background:`${p.color}14`, border:`1px solid ${p.color}30` }}>
                  <Icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
                <p className="font-bold text-sm mb-0.5" style={{ color: "#141A3A" }}>{p.title}</p>
                <p className="text-[10px] mb-1 font-medium" style={{ color: p.color }}>{p.stat}</p>
                <p className="text-[11px] mb-3" style={{ color: "#4A5070" }}>{p.sub}</p>
                <ul className="space-y-1.5">
                  {p.items.map(item => (
                    <li key={item} className="text-[11px] flex items-center gap-1.5" style={{ color: "#3A4170" }}>
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
      <section className="py-20 px-4 relative" style={{ background: "#FFFFFF", borderTop: `1px solid rgba(20,26,58,0.07)` }}>
        <div className="absolute inset-0 pointer-events-none" />

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-px w-10" style={{ background: `rgba(35,42,99,0.12)` }} />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "#232A63" }}>Coworking</span>
            <div className="h-px flex-1" style={{ background: `rgba(20,26,58,0.07)` }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold tracking-[0.15em] uppercase mb-6 border"
                style={{ background: "rgba(35,42,99,0.12)", borderColor: "rgba(35,42,99,0.12)", color: "#232A63" }}>
                Now Live
              </span>

              <h2 className="font-bold leading-[1.05] mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: L.text }}>
                Your perfect office,<br />
                <span style={{ color: "#232A63" }}>wherever you work.</span>
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
                    <f.icon className="w-4 h-4" style={{ color: "#C2410C" }} />
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

              <div className="flex items-center gap-0 mb-8 rounded-lg overflow-hidden border" style={{ borderColor: "rgba(20,26,58,0.09)" }}>{[{n:"₹350",l:"From /day"},{n:"Verified",l:"Spaces"}].map((s,idx) => (<div key={s.l} className="flex-1 text-center py-3 px-2" style={{ borderRight: idx<2 ? "1px solid rgba(20,26,58,0.08)" : "none" }}><p className="text-base font-bold" style={{ color: "#232A63" }}>{s.n}</p><p className="text-[10px]" style={{ color: L.textMuted }}>{s.l}</p></div>))}</div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "#232A63", color: "#F2F3F6" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border transition-all hover:border-[#141A3A]/15"
                  style={{ borderColor: "rgba(20,26,58,0.10)", color: L.textSub, background: L.bgCard }}>
                  List your space – Free
                </Link>
              </div>
            </div>

            {/* Right – Interactive plan card */}
            <div className="relative">
              <div className="rounded-xl overflow-hidden border"
                style={{ background: L.bgCard, borderColor: "rgba(20,26,58,0.09)" }}>
                <div className="h-[2px]" style={{ background: "linear-gradient(90deg,rgba(35,42,99,0.12),rgba(35,42,99,0.12),transparent)" }} />

                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(35,42,99,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border"
                      style={{ background: "rgba(35,42,99,0.07)", borderColor: "rgba(35,42,99,0.14)" }}>🏢</div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: L.text }}>FreWork Coworking</p>
                      <p className="text-[10px]" style={{ color: L.textMuted }}>Verified · Bangalore, Indiranagar</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    style={{ background: "rgba(35,42,99,0.08)", color: "#1A1F4E", borderColor: "rgba(35,42,99,0.2)" }}>
                    <span className="w-1 h-1 rounded-full bg-[#232A63] animate-pulse" />
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
                          borderColor: "rgba(35,42,99,0.12)", background: "rgba(35,42,99,0.12)",
                        } : {
                          borderColor: "rgba(20,26,58,0.08)", background: L.bgAlt
                        }}>
                        <p className="text-xl mb-1">{plan.emoji}</p>
                        <p className="text-[11px] font-semibold mb-0.5" style={{ color: selectedPlan === plan.key ? "#9A3412" : L.textSub }}>{plan.label}</p>
                        <p className="text-xs font-bold" style={{ color: selectedPlan === plan.key ? "#232A63" : L.textMuted }}>
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
                      style={{ background: "rgba(35,42,99,0.03)", borderColor: "rgba(35,42,99,0.1)" }}>
                      <p className="text-xs leading-relaxed" style={{ color: L.textSub }}>
                        {selectedCoworkPlan.desc}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <Link href="/coworking"
                    className="w-full py-3 rounded-lg text-sm font-semibold text-center block transition-all hover:opacity-90"
                    style={{ background: "#232A63", color: "#F2F3F6" }}>
                    Book a Visit →
                  </Link>
                </div>
              </div>

              <div className="absolute -bottom-3 -left-3 px-4 py-2.5 rounded-xl border shadow-xl"
                style={{ background: L.bgCard, borderColor: "rgba(234,88,12,0.2)", boxShadow: "0 8px 32px rgba(139,108,50,0.12)" }}>
                <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#1246C8" }}>Live in 8 cities</p>
                <p className="text-xs mt-0.5" style={{ color: L.textMuted }}>
                  <Link href="/coworking" style={{ color: "#232A63" }}>Browse spaces</Link> near you
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
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#232A63" }}>Services · One Platform</p>
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
                          {isExpanded ? "Close →" : "Learn more"}
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
                          {isActive ? "Click to collapse →" : "Click to learn more ↓"}
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
                      style={{ background: L.bgCard, borderColor: open ? "rgba(35,42,99,0.12)" : L.borderLight }}>
                      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, rgba(35,42,99,0.12), transparent)` }} />
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                        style={{ background: "rgba(35,42,99,0.12)", border: "1px solid rgba(35,42,99,0.12)" }}>
                        <Icon className="w-5 h-5" style={{ color: "#232A63" }} />
                      </div>
                      <h3 className="font-semibold mb-2 text-base" style={{ color: L.text }}>{item.t}</h3>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: L.textSub }}>{item.d}</p>
                      <span className="text-xs font-medium" style={{ color: "#232A63" }}>{open ? "Show less" : "Read more"}</span>
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

      {/* --- TESTIMONIALS --- hidden (B7) until the owner confirms Rahul Sharma, Priya Menon and Anil Gupta are real, consenting clients */}
      {SHOW_TESTIMONIALS && <section className="py-20 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.blue }}>What our clients say</p>
            <h2 className="font-black" style={{ fontFamily: "var(--font-plus-jakarta),sans-serif", fontSize: "clamp(1.5rem,3.5vw,2.2rem)", color: L.text }}>
              Trusted by growing businesses
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote: "FreWork registered my company and GST in 6 days. I was expecting it to take a month. The process was completely seamless.", name: "Rahul Sharma", role: "Founder, TechStart Pune", color: "#232A63" },
              { quote: "Booked a hot desk through FreWork and it was perfectly set up. Every space is personally verified — you get exactly what you see.", name: "Priya Menon", role: "Freelance Designer, Bangalore", color: "#232A63" },
              { quote: "Our CA through FreWork filed 3 years of pending ITR in 4 days. Affordable, fast, and genuinely professional service.", name: "Anil Gupta", role: "SME Owner, Delhi NCR", color: "#232A63" },
            ].map((item) => (
              <div key={item.name} className="rounded-2xl p-6 border" style={{ background: L.bgCard, borderColor: `${item.color}22`, boxShadow: L.shadow }}>
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <span key={i} style={{ color: "#232A63", fontSize: "14px" }}>★</span>)}
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
      </section>}

      {/* --- QUICK SERVICES --- */}
      <section className="py-20 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-black tracking-[0.35em] uppercase mb-10" style={{ color: L.textMuted }}>Popular on FreWork</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Building2, label: "Company Registration", href: "/services/business-registration" },
              { icon: MapPin, label: "Find Coworking Space", href: "/coworking" },
              { icon: Users, label: "Hire Talent", href: "/freelancers" },
              { icon: Presentation, label: "Pitch Deck & DPR", href: "/services/dpr" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance" },
              { icon: BarChart3, label: "Virtual Accountant", href: "/services/accounting" },
              { icon: FileText, label: "AI Accountant – FreBook", href: "/frebook" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-3.5 rounded-lg border transition-all group hover:border-[#141A3A]/12"
                  style={{ background: L.bgCard, borderColor: "rgba(20,26,58,0.08)" }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(35,42,99,0.12)", border: "1px solid rgba(35,42,99,0.12)" }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: "#232A63" }} />
                  </div>
                  <span className="text-xs font-medium leading-tight" style={{ color: L.textSub }}>{s.label}</span>
                  <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#232A63" }} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-24 px-4 relative overflow-hidden" style={{ background: "#F2F3F6", borderTop:"1px solid rgba(35,42,99,0.12)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position:"absolute", left:"20%", top:"-30%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(35,42,99,0.07) 0%, transparent 60%)", filter:"blur(80px)" }} />
        </div>
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-4" style={{ color: "#C2410C" }}>Ready to start?</p>
          <h2 className="font-bold mb-4 leading-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 4.5vw, 3rem)", color: "#141A3A" }}>
            India&apos;s complete business platform.
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto" style={{ color: "rgba(90,96,128,0.90)" }}>
            Join founders, SMEs, and professionals building their business with FreWork.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link href="/register"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background:"linear-gradient(135deg,#232A63,#1A1F4E)", color:"#fff", boxShadow:"0 6px 24px rgba(35,42,99,0.35)" }}>
              Get Started Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm border transition-all hover:border-[#232A63]/30"
              style={{ borderColor: "rgba(35,42,99,0.2)", color: "#232A63", background: "rgba(35,42,99,0.05)" }}>
              <Phone className="w-4 h-4" style={{ color: "#C2410C" }} /> {SUPPORT_PHONE}
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {["Company Registration", "GST Filing", "Coworking", "Hire Talent", "Pitch Decks"].map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: "#4A5070" }}>
                <span className="w-1 h-1 rounded-full" style={{ background: "#232A63", opacity:0.5 }} />{s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="py-6 text-center text-xs border-t" style={{ borderColor: "rgba(35,42,99,0.12)", background: "#232A63", color: "#C8D2F2" }}>
        &copy; {new Date().getFullYear()} FreWork — India&apos;s Business Platform &nbsp;·&nbsp; <Link href="/terms" className="hover:opacity-70 transition-opacity" style={{ color: "#FFB08A" }}>Terms</Link> &nbsp;·&nbsp; <Link href="/privacy" className="hover:opacity-70 transition-opacity" style={{ color: "#FFB08A" }}>Privacy</Link> &nbsp;·&nbsp; <Link href="/refund-policy" className="hover:opacity-70 transition-opacity" style={{ color: "#FFB08A" }}>Refund Policy</Link> &nbsp;·&nbsp; <Link href="/contact" className="hover:opacity-70 transition-opacity" style={{ color: "#FFB08A" }}>Contact</Link>
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
        style={{ background: "linear-gradient(135deg,#0B6E62,#075E54)", boxShadow: "0 4px 24px rgba(7,94,84,0.45), 0 2px 8px rgba(20,26,58,0.06)" }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span className="hidden sm:inline">WhatsApp Us</span>
      </a>

      {/* ═══ FREBOOK AUTH MODAL ═══ */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(7,12,26,0.88)", backdropFilter: "blur(12px)" }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: "linear-gradient(160deg,#FFFFFF,#0E1A38)", border: "1px solid rgba(35,42,99,0.25)", boxShadow: "0 24px 80px rgba(20,26,58,0.14)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#232A63,#F58A5B,#232A63)" }} />
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:opacity-70"
              style={{ background: "rgba(20,26,58,0.08)", color: "rgba(237,232,220,0.5)", border: "1px solid rgba(237,232,220,0.1)" }}
            >✕</button>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "linear-gradient(135deg,rgba(35,42,99,0.15),rgba(35,42,99,0.06))", border: "1px solid rgba(35,42,99,0.3)" }}>
                🛩️
              </div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-2" style={{ color: "#232A63" }}>FreBook by FreWork</p>
              <h3 className="font-black text-xl mb-1" style={{ color: "#EDE8DC", letterSpacing: "-0.02em" }}>Sign in to access FreBook</h3>
              <p className="text-xs mb-6" style={{ color: "#4A5070" }}>Your AI accountant — GST, books, TDS and more.</p>
              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#fff", color: "#1a1a1a", boxShadow: "0 4px 20px rgba(20,26,58,0.12)" }}
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
              <p className="text-[10px] mt-4" style={{ color: "#4A5070" }}>By continuing you agree to FreWork&apos;s Terms &amp; Privacy Policy</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

