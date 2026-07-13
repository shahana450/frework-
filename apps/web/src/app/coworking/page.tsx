"use client";

import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { motion } from "framer-motion";
import {
  Search, MapPin, Wifi, Coffee, Car, Users, Clock, Star,
  ArrowRight, CheckCircle, Building2, IndianRupee, Phone,
  Monitor, AirVent, Printer, Lock, Zap,
} from "lucide-react";
import Link from "next/link";

const CITIES = ["All Cities", "Mumbai", "Bangalore", "Delhi", "Gurgaon", "Hyderabad", "Pune", "Chennai"];

const TYPES = ["All Types", "Hot Desk", "Dedicated Desk", "Private Cabin", "Meeting Room", "Virtual Office"];

const SPACES = [
  {
    id: "1",
    name: "Awfis — Andheri West",
    city: "Mumbai",
    area: "Andheri West",
    type: "Hot Desk",
    price: 399,
    per: "day",
    monthlyPrice: 7500,
    rating: 4.7,
    reviews: 128,
    capacity: 120,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Parking", "Meeting Rooms"],
    img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80",
    badge: "Most Popular",
    badgeColor: "#1E40AF",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "2",
    name: "91springboard — Koramangala",
    city: "Bangalore",
    area: "Koramangala",
    type: "Dedicated Desk",
    price: 499,
    per: "day",
    monthlyPrice: 9000,
    rating: 4.8,
    reviews: 214,
    capacity: 200,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Lounge", "Meeting Rooms"],
    img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80",
    badge: "Top Rated",
    badgeColor: "#059669",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "3",
    name: "Innov8 — Cyber City",
    city: "Gurgaon",
    area: "Cyber City",
    type: "Private Cabin",
    price: 899,
    per: "day",
    monthlyPrice: 16000,
    rating: 4.6,
    reviews: 97,
    capacity: 80,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Parking", "24/7 Access"],
    img: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80",
    badge: "Premium",
    badgeColor: "#7C3AED",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "4",
    name: "CoWrks — RMZ Millenia",
    city: "Chennai",
    area: "Perungudi",
    type: "Hot Desk",
    price: 350,
    per: "day",
    monthlyPrice: 6500,
    rating: 4.5,
    reviews: 73,
    capacity: 150,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Lounge"],
    img: "https://images.unsplash.com/photo-1572025442646-866d16c84a54?w=600&q=80",
    badge: null,
    badgeColor: "",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "5",
    name: "Smartworks — Hitech City",
    city: "Hyderabad",
    area: "Hitech City",
    type: "Dedicated Desk",
    price: 449,
    per: "day",
    monthlyPrice: 8000,
    rating: 4.7,
    reviews: 156,
    capacity: 300,
    amenities: ["Wifi", "Coffee", "AC", "Parking", "Meeting Rooms", "Cafeteria"],
    img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&q=80",
    badge: "Best Value",
    badgeColor: "#D97706",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "6",
    name: "WeWork — BKC",
    city: "Mumbai",
    area: "Bandra Kurla Complex",
    type: "Private Cabin",
    price: 1200,
    per: "day",
    monthlyPrice: 22000,
    rating: 4.9,
    reviews: 341,
    capacity: 500,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Parking", "24/7 Access", "Gym"],
    img: "https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=600&q=80",
    badge: "Premium",
    badgeColor: "#7C3AED",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "7",
    name: "IndiQube — Marathahalli",
    city: "Bangalore",
    area: "Marathahalli",
    type: "Hot Desk",
    price: 299,
    per: "day",
    monthlyPrice: 5500,
    rating: 4.4,
    reviews: 88,
    capacity: 180,
    amenities: ["Wifi", "Coffee", "AC", "Printer", "Meeting Rooms"],
    img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80",
    badge: null,
    badgeColor: "",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "8",
    name: "Regus — Connaught Place",
    city: "Delhi",
    area: "Connaught Place",
    type: "Virtual Office",
    price: 1500,
    per: "month",
    monthlyPrice: 1500,
    rating: 4.6,
    reviews: 112,
    capacity: 60,
    amenities: ["Business Address", "Mail Handling", "Meeting Rooms", "24/7 Access"],
    img: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&q=80",
    badge: "Virtual Office",
    badgeColor: "#0891B2",
    verified: true,
    phone: "+918590874681",
  },
  {
    id: "9",
    name: "WorkEZ — Baner",
    city: "Pune",
    area: "Baner",
    type: "Dedicated Desk",
    price: 380,
    per: "day",
    monthlyPrice: 7000,
    rating: 4.5,
    reviews: 61,
    capacity: 90,
    amenities: ["Wifi", "Coffee", "AC", "Parking", "Printer"],
    img: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&q=80",
    badge: null,
    badgeColor: "",
    verified: true,
    phone: "+918590874681",
  },
];

const AMENITY_ICONS: Record<string, React.ElementType> = {
  Wifi: Wifi, Coffee: Coffee, AC: AirVent, Printer: Printer,
  Parking: Car, "Meeting Rooms": Users, "24/7 Access": Lock,
  Lounge: Users, Cafeteria: Coffee, Gym: Zap,
  "Business Address": Building2, "Mail Handling": Printer,
};

export default function CoworkingPage() {
  const [city, setCity] = useState("All Cities");
  const [type, setType] = useState("All Types");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => SPACES.filter(s => {
    const cityMatch = city === "All Cities" || s.city === city;
    const typeMatch = type === "All Types" || s.type === type;
    const q = query.toLowerCase();
    const queryMatch = !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.area.toLowerCase().includes(q);
    return cityMatch && typeMatch && queryMatch;
  }), [city, type, query]);

  return (
    <PageLayout>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F2044 0%, #1E3A8A 100%)" }} className="border-b border-blue-900">
        <div className="container py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Listings
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Find Your Perfect<br />
            <span style={{ background: "linear-gradient(90deg,#60A5FA,#93C5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Workspace in India
            </span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-xl">
            Premium coworking spaces in Mumbai, Bangalore, Delhi, Hyderabad, Pune and more. Day pass to annual plans.
          </p>
          <div className="flex gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by city, area or space name..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800"
              />
            </div>
            <button
              className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#2563EB,#1246C8)" }}
            >
              <Search className="w-4 h-4" /> Search
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-10">
            {[["9+", "Listed Spaces"], ["7", "Cities"], ["₹299/day", "Starting from"], ["Verified", "Every space"]].map(([v, l]) => (
              <div key={l}>
                <p className="text-xl font-black text-white">{v}</p>
                <p className="text-blue-300 text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5 ml-1">City</p>
            <div className="flex gap-2 flex-wrap">
              {CITIES.map(c => (
                <button key={c} onClick={() => setCity(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${city === c ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mb-8">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${type === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-500 mb-6 font-medium">{filtered.length} workspace{filtered.length !== 1 ? "s" : ""} found</p>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((space, i) => (
            <motion.div key={space.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_32px_rgba(15,32,68,0.12)] hover:border-blue-200 transition-all group"
            >
              {/* Image */}
              <div className="relative overflow-hidden h-44">
                <img src={space.img} alt={space.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {space.badge && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                    style={{ background: space.badgeColor }}>
                    {space.badge}
                  </span>
                )}
                {space.verified && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 text-emerald-700 text-[11px] font-bold">
                    <CheckCircle className="w-3 h-3" /> Verified
                  </span>
                )}
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/90 text-slate-700 text-[11px] font-semibold">{space.type}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{space.name}</h3>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold text-slate-800">{space.rating}</span>
                    <span className="text-xs text-slate-400">({space.reviews})</span>
                  </div>
                </div>
                <p className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                  <MapPin className="w-3 h-3" /> {space.area}, {space.city}
                </p>

                {/* Amenities */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {space.amenities.slice(0, 4).map(a => {
                    const Icon = AMENITY_ICONS[a] ?? CheckCircle;
                    return (
                      <span key={a} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-600">
                        <Icon className="w-2.5 h-2.5" /> {a}
                      </span>
                    );
                  })}
                  {space.amenities.length > 4 && (
                    <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-400">
                      +{space.amenities.length - 4} more
                    </span>
                  )}
                </div>

                {/* Price + CTA */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-900">
                      ₹{space.price.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-slate-500">/{space.per}</span>
                    </p>
                    {space.per === "day" && (
                      <p className="text-[11px] text-slate-400">₹{space.monthlyPrice.toLocaleString("en-IN")}/mo</p>
                    )}
                  </div>
                  <a
                    href={`https://wa.me/${space.phone.replace(/\D/g, "")}?text=Hi%20FreWork%2C%20I%27m%20interested%20in%20${encodeURIComponent(space.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}
                  >
                    <Phone className="w-3.5 h-3.5" /> Enquire
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No spaces found for your filters.</p>
            <button onClick={() => { setCity("All Cities"); setType("All Types"); setQuery(""); }}
              className="mt-3 text-blue-600 text-sm font-semibold hover:underline">Clear filters</button>
          </div>
        )}

        {/* List your space CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Own or manage a coworking space?</h3>
          <p className="text-slate-500 text-sm mb-5">List your space on FreWork for free and get enquiries from verified professionals across India.</p>
          <Link href="/dashboard/workspace/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>
            List Your Space — Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
