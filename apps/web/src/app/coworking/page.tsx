"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PageLayout } from "@/components/layout/page-layout";
import { motion } from "framer-motion";
import {
  Search, MapPin, Wifi, Coffee, Car, Users, Clock, Star,
  ArrowRight, CheckCircle, Building2, Phone,
  Monitor, AirVent, Printer, Lock, Zap, ChevronDown, ChevronUp,
  Dumbbell, UtensilsCrossed, Package, Video, Headphones,
} from "lucide-react";
import Link from "next/link";

const CITIES = ["All Cities","Mumbai","Delhi","Bangalore","Hyderabad","Pune","Chennai","Gurgaon","Noida","Kolkata","Ahmedabad","Jaipur","Kochi","Chandigarh","Indore"];
const TYPES  = ["All Types","Hot Desk","Dedicated Desk","Private Cabin","Meeting Room","Virtual Office","Event Space","Training Room","Day Pass"];
const BUDGETS = ["Any Budget","Under â‚¹500/day","â‚¹500â€“â‚¹1000/day","â‚¹1000â€“â‚¹2000/day","â‚¹2000+/day"];

const AMENITY_ICONS: Record<string, React.ElementType> = {
  "High-Speed Wi-Fi": Wifi, "Coffee & Tea": Coffee, "AC": AirVent,
  "Printer/Scanner": Printer, "Parking": Car, "Meeting Rooms": Users,
  "24/7 Access": Lock, "Lounge Area": Users, "Cafeteria": UtensilsCrossed,
  "Gym": Dumbbell, "Business Address": Building2, "Mail Handling": Package,
  "Phone Booths": Headphones, "Standing Desks": Monitor, "Video Conf": Video,
  "Power Backup": Zap, "Lockers": Lock, "Reception": Users, "CCTV": Monitor,
  "Outdoor Terrace": Zap, "Event Hall": Users, "Creche": Users, "Smoking Zone": Zap,
};

const SPACES: SpaceEntry[] = [];

interface SpaceEntry {
  id: string; name: string; city: string; area: string; type: string;
  price: number; per: string; monthlyPrice: number;
  rating: number; reviews: number; capacity: number;
  badge: string | null; badgeColor: string; verified: boolean;
  amenities: string[]; desc: string; phone: string;
  isUserListing?: boolean;
}

export default function CoworkingPage() {
  const [city,   setCity]   = useState("All Cities");
  const [type,   setType]   = useState("All Types");
  const [budget, setBudget] = useState("Any Budget");
  const [query,  setQuery]  = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userSpaces, setUserSpaces] = useState<SpaceEntry[]>([]);

  useEffect(() => {
    supabase
      .from("fw_workspaces")
      .select("id, name, city, address, type, price_per_day, price_per_month, capacity, amenities, description, contact_phone, status")
      .eq("status", "approved")
      .then(({ data }) => {
        if (!data) return;
        const mapped: SpaceEntry[] = data.map(s => ({
          id: "user-" + s.id,
          name: s.name ?? "Unnamed Space",
          city: s.city ?? "India",
          area: s.address ?? "",
          type: s.type ?? "Hot Desk",
          price: s.price_per_day ?? s.price_per_month ?? 0,
          per: s.price_per_day ? "day" : "month",
          monthlyPrice: s.price_per_month ?? 0,
          rating: 0,
          reviews: 0,
          capacity: s.capacity ?? 0,
          badge: "New Listing",
          badgeColor: "#059669",
          verified: false,
          amenities: s.amenities ?? [],
          desc: s.description ?? "",
          phone: s.contact_phone ?? "+918590874681",
          isUserListing: true,
        }));
        setUserSpaces(mapped);
      });
  }, []);

  const allSpaces = useMemo(() => [...userSpaces, ...SPACES], [userSpaces]);

  const filtered = useMemo(() => allSpaces.filter(s => {
    if (city   !== "All Cities" && s.city !== city) return false;
    if (type   !== "All Types"  && s.type !== type)  return false;
    if (budget !== "Any Budget") {
      const p = s.price;
      if (budget === "Under â‚¹500/day"    && (s.per !== "day" || p >= 500))  return false;
      if (budget === "â‚¹500â€“â‚¹1000/day"   && (s.per !== "day" || p < 500 || p > 1000)) return false;
      if (budget === "â‚¹1000â€“â‚¹2000/day"  && (s.per !== "day" || p < 1000 || p > 2000)) return false;
      if (budget === "â‚¹2000+/day"        && (s.per !== "day" || p < 2000)) return false;
    }
    const q = query.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.area.toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
  }), [city, type, budget, query, allSpaces]);

  return (
    <PageLayout>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0F2044 0%,#1E3A8A 100%)" }} className="border-b border-blue-900">
        <div className="container py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {SPACES.length}+ Live Listings
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Find Your Perfect<br />
            <span style={{ background:"linear-gradient(90deg,#60A5FA,#93C5FD)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Workspace in India
            </span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-xl">
            Hot desks, private cabins, virtual offices, meeting rooms â€” across 14 cities. Day pass to annual plans available.
          </p>
          <div className="flex gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by city, area or space name..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800" />
            </div>
            <button className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background:"linear-gradient(135deg,#2563EB,#1246C8)" }}>
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
          <div className="flex flex-wrap gap-6 mt-10">
            {[[String(allSpaces.length)+"+","Listed Spaces"],["14","Cities"],["â‚¹250/day","Starting from"],["Verified","Every space"]].map(([v,l]) => (
              <div key={l}><p className="text-xl font-black text-white">{v}</p><p className="text-blue-300 text-xs">{l}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-10">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Filter Spaces</p>
          <div className="space-y-4">

            {/* City */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">City</p>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <button key={c} onClick={() => setCity(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${city===c ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Space Type</p>
              <div className="flex flex-wrap gap-2">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${type===t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Budget</p>
              <div className="flex flex-wrap gap-2">
                {BUDGETS.map(b => (
                  <button key={b} onClick={() => setBudget(b)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${budget===b ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 font-medium">{filtered.length} workspace{filtered.length!==1?"s":""} found</p>
          <button onClick={() => { setCity("All Cities"); setType("All Types"); setBudget("Any Budget"); setQuery(""); }}
            className="text-xs text-blue-600 font-semibold hover:underline">Clear all filters</button>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((space, i) => {
            const isExpanded = expandedId === space.id;
            return (
              <motion.div key={space.id}
                initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_32px_rgba(15,32,68,0.12)] hover:border-blue-200 transition-all group flex flex-col"
              >
                {/* Image */}
                <div className="relative overflow-hidden h-44 flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-slate-400" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {space.badge && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                      style={{ background: space.badgeColor }}>{space.badge}</span>
                  )}
                  {space.verified && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 text-emerald-700 text-[11px] font-bold">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 flex gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-white/90 text-slate-700 text-[11px] font-semibold">{space.type}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600/90 text-white text-[11px] font-semibold">{space.city}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">{space.name}</h3>
                    {space.rating > 0 ? (
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-slate-800">{space.rating}</span>
                        <span className="text-xs text-slate-400">({space.reviews})</span>
                      </div>
                    ) : (space as SpaceEntry).isUserListing ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold ml-2 flex-shrink-0">New</span>
                    ) : null}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {space.area}, {space.city}
                  </p>
                  <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">{space.desc}</p>

                  {/* Capacity */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{space.capacity} seats</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Flexible plans</span>
                  </div>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(isExpanded ? space.amenities : space.amenities.slice(0, 5)).map(a => {
                      const Icon = AMENITY_ICONS[a] ?? CheckCircle;
                      return (
                        <span key={a} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-600">
                          <Icon className="w-2.5 h-2.5 flex-shrink-0" /> {a}
                        </span>
                      );
                    })}
                  </div>
                  {space.amenities.length > 5 && (
                    <button onClick={() => setExpandedId(isExpanded ? null : space.id)}
                      className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold mb-3 hover:underline self-start">
                      {isExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> +{space.amenities.length-5} more amenities</>}
                    </button>
                  )}

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-lg font-black text-slate-900">
                        â‚¹{space.price.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-slate-500">/{space.per}</span>
                      </p>
                      {space.per === "day" && (
                        <p className="text-[11px] text-slate-400">â‚¹{space.monthlyPrice.toLocaleString("en-IN")}/mo</p>
                      )}
                    </div>
                    <a href={`https://wa.me/${space.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi FreWork, I'm interested in ${space.name} (${space.type}) at ${space.area}, ${space.city}. Starting price â‚¹${space.price}/${space.per}. Please share details.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                      style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                      <Phone className="w-3.5 h-3.5" /> Enquire
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Verified spaces coming soon</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              We are onboarding and personally verifying coworking spaces across India.<br />
              Every space is visited and confirmed before listing — no fake listings, ever.
            </p>
            <p className="text-xs text-slate-400 mb-5">Own a coworking space? Be the first to list — free forever for early partners.</p>
            <Link href="/dashboard/workspace/submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
              List Your Space — Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* List your space CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Own or manage a coworking space?</h3>
          <p className="text-slate-500 text-sm mb-5">List your space on FreWork for free and get enquiries from verified professionals across India.</p>
          <Link href="/dashboard/workspace/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
            List Your Space â€” Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
