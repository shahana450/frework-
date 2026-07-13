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
const BUDGETS = ["Any Budget","Under ₹500/day","₹500–₹1000/day","₹1000–₹2000/day","₹2000+/day"];

const AMENITY_ICONS: Record<string, React.ElementType> = {
  "High-Speed Wi-Fi": Wifi, "Coffee & Tea": Coffee, "AC": AirVent,
  "Printer/Scanner": Printer, "Parking": Car, "Meeting Rooms": Users,
  "24/7 Access": Lock, "Lounge Area": Users, "Cafeteria": UtensilsCrossed,
  "Gym": Dumbbell, "Business Address": Building2, "Mail Handling": Package,
  "Phone Booths": Headphones, "Standing Desks": Monitor, "Video Conf": Video,
  "Power Backup": Zap, "Lockers": Lock, "Reception": Users, "CCTV": Monitor,
  "Outdoor Terrace": Zap, "Event Hall": Users, "Creche": Users, "Smoking Zone": Zap,
};

const SPACES = [
  // Mumbai
  { id:"1",  name:"Awfis — Andheri West",          city:"Mumbai",    area:"Andheri West",         type:"Hot Desk",       price:399,  per:"day", monthlyPrice:7500,  rating:4.7, reviews:128, capacity:120, badge:"Most Popular", badgeColor:"#1E40AF", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access","Phone Booths","Power Backup","CCTV","Reception","Lockers"],
    desc:"Modern coworking space in the heart of Andheri with 120 seats. Ideal for freelancers and startups.", phone:"+918590874681" },
  { id:"2",  name:"WeWork — BKC",                  city:"Mumbai",    area:"Bandra Kurla Complex",  type:"Private Cabin",  price:1200, per:"day", monthlyPrice:22000, rating:4.9, reviews:341, capacity:500, badge:"Premium",      badgeColor:"#7C3AED", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access","Gym","Cafeteria","Phone Booths","Video Conf","Outdoor Terrace","Lockers","Reception"],
    desc:"World-class workspace in BKC, Mumbai's premier business district. Enterprise-grade amenities.", phone:"+918590874681" },
  { id:"3",  name:"Regus — Nariman Point",          city:"Mumbai",    area:"Nariman Point",         type:"Virtual Office", price:1500, per:"month", monthlyPrice:1500, rating:4.6, reviews:112, capacity:60,  badge:"Virtual",      badgeColor:"#0891B2", verified:true,
    amenities:["Business Address","Mail Handling","Meeting Rooms","Reception","CCTV","Phone Booths"],
    desc:"Prestigious business address at Nariman Point with mail handling and meeting room access.", phone:"+918590874681" },
  { id:"4",  name:"GoWork — Powai",                 city:"Mumbai",    area:"Powai",                 type:"Dedicated Desk", price:599,  per:"day", monthlyPrice:11000, rating:4.5, reviews:89,  capacity:200, badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","24/7 Access","Power Backup","Lockers","CCTV"],
    desc:"Spacious coworking in Powai's tech hub, close to IIT and top IT companies.", phone:"+918590874681" },

  // Bangalore
  { id:"5",  name:"91springboard — Koramangala",    city:"Bangalore", area:"Koramangala",           type:"Dedicated Desk", price:499,  per:"day", monthlyPrice:9000,  rating:4.8, reviews:214, capacity:200, badge:"Top Rated",    badgeColor:"#059669", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Lounge Area","Meeting Rooms","24/7 Access","Video Conf","Phone Booths","Power Backup","Cafeteria"],
    desc:"Vibrant coworking community in Koramangala with startup culture. Best for tech teams.", phone:"+918590874681" },
  { id:"6",  name:"IndiQube — Marathahalli",        city:"Bangalore", area:"Marathahalli",          type:"Hot Desk",       price:299,  per:"day", monthlyPrice:5500,  rating:4.4, reviews:88,  capacity:180, badge:"Best Value",   badgeColor:"#D97706", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Power Backup","CCTV"],
    desc:"Affordable hot desks near Marathahalli and Whitefield IT corridor.", phone:"+918590874681" },
  { id:"7",  name:"CoWrks — RMZ Ecoworld",         city:"Bangalore", area:"Bellandur",             type:"Private Cabin",  price:950,  per:"day", monthlyPrice:17000, rating:4.7, reviews:160, capacity:400, badge:"Premium",      badgeColor:"#7C3AED", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access","Cafeteria","Gym","Video Conf","Phone Booths","Outdoor Terrace","Lockers"],
    desc:"Enterprise-grade space at RMZ Ecoworld, Bangalore's most sought-after IT campus.", phone:"+918590874681" },
  { id:"8",  name:"Bhive — HSR Layout",             city:"Bangalore", area:"HSR Layout",            type:"Day Pass",       price:250,  per:"day", monthlyPrice:4500,  rating:4.6, reviews:310, capacity:150, badge:"Affordable",   badgeColor:"#059669", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Power Backup"],
    desc:"India's most affordable coworking chain with vibrant community events.", phone:"+918590874681" },

  // Delhi
  { id:"9",  name:"Regus — Connaught Place",        city:"Delhi",     area:"Connaught Place",       type:"Virtual Office", price:1800, per:"month", monthlyPrice:1800, rating:4.6, reviews:97,  capacity:60,  badge:"Virtual",      badgeColor:"#0891B2", verified:true,
    amenities:["Business Address","Mail Handling","Meeting Rooms","Reception","CCTV","High-Speed Wi-Fi"],
    desc:"Prime business address at Connaught Place for GST registration and mail handling.", phone:"+918590874681" },
  { id:"10", name:"Awfis — Saket",                  city:"Delhi",     area:"Saket",                 type:"Hot Desk",       price:349,  per:"day", monthlyPrice:6500,  rating:4.5, reviews:143, capacity:100, badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Power Backup","CCTV","Lockers"],
    desc:"Convenient coworking in Saket, close to South Delhi malls and Metro.", phone:"+918590874681" },
  { id:"11", name:"WeWork — DLF Cyber City",        city:"Gurgaon",   area:"DLF Cyber City",        type:"Dedicated Desk", price:699,  per:"day", monthlyPrice:12000, rating:4.8, reviews:275, capacity:600, badge:"Top Rated",    badgeColor:"#059669", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access","Gym","Cafeteria","Video Conf","Phone Booths","Lockers","Reception"],
    desc:"Iconic WeWork in DLF Cyber City — Gurgaon's prime corporate hub.", phone:"+918590874681" },
  { id:"12", name:"Innov8 — Cyber City",            city:"Gurgaon",   area:"Cyber City",            type:"Private Cabin",  price:899,  per:"day", monthlyPrice:16000, rating:4.6, reviews:97,  capacity:80,  badge:"Premium",      badgeColor:"#7C3AED", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","24/7 Access","Phone Booths","Power Backup","Video Conf"],
    desc:"Boutique premium cabins in Cyber City with round-the-clock access.", phone:"+918590874681" },
  { id:"13", name:"SpaceWork — Sector 18 Noida",   city:"Noida",     area:"Sector 18",             type:"Hot Desk",       price:299,  per:"day", monthlyPrice:5000,  rating:4.3, reviews:54,  capacity:90,  badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","CCTV"],
    desc:"Budget-friendly coworking near Noida City Centre Metro station.", phone:"+918590874681" },

  // Hyderabad
  { id:"14", name:"Smartworks — Hitech City",       city:"Hyderabad", area:"Hitech City",           type:"Dedicated Desk", price:449,  per:"day", monthlyPrice:8000,  rating:4.7, reviews:156, capacity:300, badge:"Best Value",   badgeColor:"#D97706", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Parking","Meeting Rooms","Cafeteria","24/7 Access","Power Backup","CCTV","Lockers"],
    desc:"Largest managed workspace in Hitech City with 300+ seats and full enterprise suite.", phone:"+918590874681" },
  { id:"15", name:"T-Hub — Raidurgam",              city:"Hyderabad", area:"Raidurgam",             type:"Event Space",    price:2500, per:"day", monthlyPrice:45000, rating:4.9, reviews:88,  capacity:800, badge:"Gov. Backed",  badgeColor:"#DC2626", verified:true,
    amenities:["High-Speed Wi-Fi","AC","Video Conf","Parking","Cafeteria","Meeting Rooms","24/7 Access","Event Hall","Power Backup","Reception"],
    desc:"India's largest startup incubator backed by Telangana Govt. Ideal for events and product launches.", phone:"+918590874681" },

  // Pune
  { id:"16", name:"WorkEZ — Baner",                 city:"Pune",      area:"Baner",                 type:"Dedicated Desk", price:380,  per:"day", monthlyPrice:7000,  rating:4.5, reviews:61,  capacity:90,  badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Parking","Printer/Scanner","Power Backup","CCTV"],
    desc:"Quiet, productive workspace in Baner's growing IT corridor.", phone:"+918590874681" },
  { id:"17", name:"Ideaspace — Kothrud",            city:"Pune",      area:"Kothrud",               type:"Hot Desk",       price:250,  per:"day", monthlyPrice:4500,  rating:4.4, reviews:77,  capacity:70,  badge:"Affordable",   badgeColor:"#059669", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms"],
    desc:"Friendly community coworking in Kothrud, near FC Road and Deccan Gymkhana.", phone:"+918590874681" },

  // Chennai
  { id:"18", name:"CoWrks — RMZ Millenia",          city:"Chennai",   area:"Perungudi",             type:"Hot Desk",       price:350,  per:"day", monthlyPrice:6500,  rating:4.5, reviews:73,  capacity:150, badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Lounge Area","Power Backup"],
    desc:"Stylish coworking at RMZ Millenia, Chennai's top office destination.", phone:"+918590874681" },
  { id:"19", name:"The Hive — T Nagar",             city:"Chennai",   area:"T Nagar",               type:"Private Cabin",  price:750,  per:"day", monthlyPrice:13000, rating:4.6, reviews:42,  capacity:60,  badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access","Video Conf"],
    desc:"Exclusive private cabins in T Nagar, the commercial heart of Chennai.", phone:"+918590874681" },

  // Others
  { id:"20", name:"Awfis — Salt Lake",              city:"Kolkata",   area:"Salt Lake Sector V",    type:"Dedicated Desk", price:350,  per:"day", monthlyPrice:6500,  rating:4.4, reviews:55,  capacity:130, badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Power Backup","CCTV"],
    desc:"Professional coworking in Kolkata's IT hub, Sector V.", phone:"+918590874681" },
  { id:"21", name:"AltF — SG Highway",              city:"Ahmedabad", area:"SG Highway",            type:"Hot Desk",       price:299,  per:"day", monthlyPrice:5500,  rating:4.5, reviews:68,  capacity:120, badge:"Trending",     badgeColor:"#D97706", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Parking","Power Backup"],
    desc:"Rapidly growing coworking brand on Ahmedabad's prestigious SG Highway.", phone:"+918590874681" },
  { id:"22", name:"91springboard — C Scheme",       city:"Jaipur",    area:"C Scheme",              type:"Dedicated Desk", price:320,  per:"day", monthlyPrice:6000,  rating:4.6, reviews:49,  capacity:100, badge:"Top Rated",    badgeColor:"#059669", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Lounge Area","Meeting Rooms","Power Backup"],
    desc:"Jaipur's most popular coworking space in the upscale C Scheme locality.", phone:"+918590874681" },
  { id:"23", name:"Launchpad — Marine Drive",       city:"Kochi",     area:"Marine Drive",          type:"Hot Desk",       price:280,  per:"day", monthlyPrice:5000,  rating:4.5, reviews:38,  capacity:80,  badge:"New",          badgeColor:"#0891B2", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Meeting Rooms","Outdoor Terrace"],
    desc:"Scenic coworking overlooking Kochi's marine drive, perfect for remote workers.", phone:"+918590874681" },
  { id:"24", name:"StartHub — Sector 35",           city:"Chandigarh",area:"Sector 35",             type:"Private Cabin",  price:600,  per:"day", monthlyPrice:10000, rating:4.4, reviews:31,  capacity:50,  badge:null, badgeColor:"", verified:true,
    amenities:["High-Speed Wi-Fi","Coffee & Tea","AC","Printer/Scanner","Parking","Meeting Rooms","24/7 Access"],
    desc:"Modern private cabins in Chandigarh's planned Sector 35 business district.", phone:"+918590874681" },
  { id:"25", name:"WorkVista — Vijay Nagar",        city:"Indore",    area:"Vijay Nagar",           type:"Meeting Room",   price:800,  per:"day", monthlyPrice:12000, rating:4.3, reviews:27,  capacity:40,  badge:"New",          badgeColor:"#0891B2", verified:true,
    amenities:["High-Speed Wi-Fi","AC","Video Conf","Printer/Scanner","Coffee & Tea","Power Backup"],
    desc:"Professional meeting rooms and training spaces in Indore's fastest-growing tech zone.", phone:"+918590874681" },
];

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
      if (budget === "Under ₹500/day"    && (s.per !== "day" || p >= 500))  return false;
      if (budget === "₹500–₹1000/day"   && (s.per !== "day" || p < 500 || p > 1000)) return false;
      if (budget === "₹1000–₹2000/day"  && (s.per !== "day" || p < 1000 || p > 2000)) return false;
      if (budget === "₹2000+/day"        && (s.per !== "day" || p < 2000)) return false;
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
            Hot desks, private cabins, virtual offices, meeting rooms — across 14 cities. Day pass to annual plans available.
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
            {[[String(allSpaces.length)+"+","Listed Spaces"],["14","Cities"],["₹250/day","Starting from"],["Verified","Every space"]].map(([v,l]) => (
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
                        ₹{space.price.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-slate-500">/{space.per}</span>
                      </p>
                      {space.per === "day" && (
                        <p className="text-[11px] text-slate-400">₹{space.monthlyPrice.toLocaleString("en-IN")}/mo</p>
                      )}
                    </div>
                    <a href={`https://wa.me/${space.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi FreWork, I'm interested in ${space.name} (${space.type}) at ${space.area}, ${space.city}. Starting price ₹${space.price}/${space.per}. Please share details.`)}`}
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
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No spaces found for your filters.</p>
            <button onClick={() => { setCity("All Cities"); setType("All Types"); setBudget("Any Budget"); setQuery(""); }}
              className="mt-3 text-blue-600 text-sm font-semibold hover:underline">Clear filters</button>
          </div>
        )}

        {/* List your space CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Own or manage a coworking space?</h3>
          <p className="text-slate-500 text-sm mb-5">List your space on FreWork for free and get enquiries from verified professionals across India.</p>
          <Link href="/dashboard/workspace/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
            List Your Space — Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
