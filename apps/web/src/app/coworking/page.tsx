"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, MapPin, Star, Wifi, Coffee, Zap, Car, Users, Clock, Heart, SlidersHorizontal, Map } from "lucide-react";
import Link from "next/link";

const SPACES = [
  { id: "1", name: "The Hub Bandra", city: "Mumbai", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=500", rating: 4.9, reviews: 342, price: 800, priceUnit: "day", seats: 120, amenities: ["Wifi", "Coffee", "Meeting Rooms", "24/7 Access", "Parking"], type: "Coworking", available: true, highlight: "Most Popular" },
  { id: "2", name: "Innov8 Koramangala", city: "Bangalore", img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=500", rating: 4.8, reviews: 289, price: 700, priceUnit: "day", seats: 200, amenities: ["Wifi", "Coffee", "Events Space", "Phone Booths", "Gym"], type: "Coworking", available: true, highlight: null },
  { id: "3", name: "WeWork Cyber City", city: "Gurgaon", img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=500", rating: 4.7, reviews: 516, price: 900, priceUnit: "day", seats: 500, amenities: ["Wifi", "Coffee", "Rooftop", "Lounge", "Events"], type: "Premium", available: true, highlight: "Editor's Pick" },
  { id: "4", name: "91springboard HSR Layout", city: "Bangalore", img: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=500", rating: 4.6, reviews: 198, price: 600, priceUnit: "day", seats: 80, amenities: ["Wifi", "Coffee", "Podcast Studio", "Library"], type: "Startup-friendly", available: true, highlight: null },
  { id: "5", name: "The Playce Connaught Place", city: "Delhi", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500", rating: 4.8, reviews: 234, price: 750, priceUnit: "day", seats: 150, amenities: ["Wifi", "Coffee", "Terrace", "Conference Rooms", "Cafe"], type: "Premium", available: false, highlight: null },
  { id: "6", name: "GoWork Whitefield", city: "Bangalore", img: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=500", rating: 4.5, reviews: 167, price: 500, priceUnit: "day", seats: 300, amenities: ["Wifi", "Cafeteria", "Outdoor Area", "Gym"], type: "Budget-friendly", available: true, highlight: "Best Value" },
  { id: "7", name: "Awfis Nariman Point", city: "Mumbai", img: "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=500", rating: 4.7, reviews: 421, price: 850, priceUnit: "day", seats: 180, amenities: ["Sea View", "Wifi", "Gourmet Cafe", "Concierge", "Security"], type: "Premium", available: true, highlight: null },
  { id: "8", name: "BHIVE Workspace MG Road", city: "Bangalore", img: "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=500", rating: 4.8, reviews: 308, price: 650, priceUnit: "day", seats: 140, amenities: ["Wifi", "Coffee", "Gaming Zone", "Terrace", "Showers"], type: "Coworking", available: true, highlight: null },
];

const CITIES = ["All Cities", "Mumbai", "Bangalore", "Delhi", "Gurgaon", "Hyderabad", "Pune", "Chennai"];
const AMENITY_ICONS: Record<string, any> = { Wifi: Wifi, Coffee: Coffee, Parking: Car, Gym: Zap };

export default function CoworkingPage() {
  const [city, setCity] = useState("All Cities");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const filtered = SPACES.filter(s =>
    (city === "All Cities" || s.city === city) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()) || s.city.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <h1 className="text-4xl font-bold mb-2">Find Your Perfect Workspace</h1>
          <p className="text-muted-foreground text-lg mb-8">Book premium coworking spaces across India & worldwide</p>
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by city or space name..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-orange-500 to-rose-500 text-white gap-2"><Search className="w-4 h-4" /> Search</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CITIES.map(c => (
              <button key={c} onClick={() => setCity(c)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${city === c ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setView("grid")} className={`p-2 rounded-lg border transition-all ${view === "grid" ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">{[...Array(4)].map((_, i) => <div key={i} className="bg-current rounded-sm w-1.5 h-1.5" />)}</div>
            </button>
            <button onClick={() => setView("list")} className={`p-2 rounded-lg border transition-all ${view === "list" ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex flex-col gap-0.5 w-3.5 h-3.5">{[...Array(3)].map((_, i) => <div key={i} className="bg-current rounded-sm w-full h-1" />)}</div>
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6"><span className="font-semibold text-foreground">{filtered.length}</span> spaces available</p>

        <div className={view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-4"}>
          {filtered.map((space, i) => (
            <motion.div key={space.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {view === "grid" ? (
                <Link href={`/coworking/${space.id}`}>
                  <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-orange-400/50 hover:shadow-lg transition-all">
                    <div className="relative">
                      <img src={space.img} alt={space.name} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                      <button onClick={e => { e.preventDefault(); setSaved(s => { const n = new Set(s); n.has(space.id) ? n.delete(space.id) : n.add(space.id); return n; }); }} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors">
                        <Heart className={`w-4 h-4 ${saved.has(space.id) ? "fill-red-400 text-red-400" : "text-white"}`} />
                      </button>
                      {space.highlight && <span className="absolute top-3 left-3 text-xs px-2 py-0.5 bg-orange-500 text-white rounded-full font-semibold">{space.highlight}</span>}
                      {!space.available && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white font-semibold text-sm">Sold Out Today</span></div>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-sm group-hover:text-orange-500 transition-colors">{space.name}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium">{space.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{space.city}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {space.amenities.slice(0, 3).map(a => <span key={a} className="text-xs px-2 py-0.5 bg-muted rounded-full">{a}</span>)}
                      </div>
                      <div className="flex items-center justify-between">
                        <div><span className="font-bold text-sm">₹{space.price}</span><span className="text-xs text-muted-foreground">/{space.priceUnit}</span></div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{space.seats} seats</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <Link href={`/coworking/${space.id}`}>
                  <div className="group flex gap-4 bg-card border border-border rounded-2xl p-4 hover:border-orange-400/50 hover:shadow-md transition-all">
                    <img src={space.img} alt={space.name} className="w-32 h-24 rounded-xl object-cover shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold group-hover:text-orange-500 transition-colors">{space.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{space.city}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹{space.price}<span className="text-xs font-normal text-muted-foreground">/{space.priceUnit}</span></p>
                          <div className="flex items-center gap-1 justify-end"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /><span className="text-xs">{space.rating} ({space.reviews})</span></div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {space.amenities.map(a => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
