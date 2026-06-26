"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Star, MapPin, Wifi, Coffee, Car, Users, Clock, ChevronLeft, ChevronRight, ArrowLeft, Check, Calendar } from "lucide-react";
import Link from "next/link";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORKSPACE_TYPES = [
  { id: "hot-desk", name: "Hot Desk", price: 800, unit: "day", desc: "Flexible open seating", capacity: 1 },
  { id: "dedicated", name: "Dedicated Desk", price: 12000, unit: "month", desc: "Your own permanent desk", capacity: 1 },
  { id: "private-cabin", name: "Private Cabin", price: 3500, unit: "day", desc: "Fully enclosed private office", capacity: "2-4" },
  { id: "meeting-room", name: "Meeting Room", price: 1500, unit: "hour", desc: "Professional boardroom", capacity: "8-12" },
];

export default function CoworkingDetailPage() {
  const params = useParams();
  const [selectedType, setSelectedType] = useState("hot-desk");
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [guests, setGuests] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  const imgs = [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
  ];

  const type = WORKSPACE_TYPES.find(t => t.id === selectedType)!;

  return (
    <PageLayout>
      <div className="container py-8 max-w-6xl">
        <Link href="/coworking" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Workspaces
        </Link>

        {/* Gallery */}
        <div className="relative rounded-2xl overflow-hidden mb-8 aspect-[16/6]">
          <img src={imgs[imgIdx]} alt="Space" className="w-full h-full object-cover" />
          <button onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setImgIdx(i => (i + 1) % imgs.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {imgs.map((_, i) => <button key={i} onClick={() => setImgIdx(i)} className={`w-2 h-2 rounded-full transition-all ${imgIdx === i ? "bg-white w-4" : "bg-white/50"}`} />)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">Most Popular</span>
                  <h1 className="text-3xl font-bold mb-1">The Hub Bandra</h1>
                  <p className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" />Bandra West, Mumbai, Maharashtra 400050</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold">4.9</span>
                  </div>
                  <p className="text-sm text-muted-foreground">342 reviews</p>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[["High-Speed Wifi", Wifi], ["Unlimited Coffee & Tea", Coffee], ["Parking Available", Car], ["24/7 Access", Clock], ["120 Seats", Users], ["Meeting Rooms", Calendar]].map(([label, Icon]: any) => (
                  <div key={label} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                    <Icon className="w-5 h-5 text-orange-500 shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div>
              <h2 className="text-lg font-semibold mb-3">About The Hub Bandra</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The Hub Bandra is Mumbai's premium coworking destination, nestled in the heart of Bandra West. With stunning views, curated events, and a vibrant community of 1,200+ members including founders, freelancers, and enterprise teams — it's the place where deals get made and ideas come to life. Features include 3 premium conference rooms, a podcasting studio, event space, and a rooftop cafe.
              </p>
            </div>

            {/* Workspace types */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Choose Your Space</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WORKSPACE_TYPES.map(t => (
                  <button key={t.id} onClick={() => setSelectedType(t.id)} className={`text-left p-4 rounded-xl border-2 transition-all ${selectedType === t.id ? "border-orange-500 bg-orange-500/5" : "border-border hover:border-orange-400/40"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{t.name}</span>
                      {selectedType === t.id && <Check className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{t.desc} · Up to {t.capacity} {typeof t.capacity === "number" ? "person" : "people"}</p>
                    <p className="font-bold text-orange-500">₹{t.price.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/{t.unit}</span></p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Booking card */}
          <div>
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
              <div className="text-center mb-6">
                <p className="text-3xl font-bold">₹{type.price.toLocaleString()}<span className="text-base font-normal text-muted-foreground">/{type.unit}</span></p>
                <p className="text-sm text-muted-foreground">{type.name}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-medium mb-2 block">Select Day</label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(d => (
                      <button key={d} onClick={() => setSelectedDay(d)} className={`py-2 rounded-lg text-xs font-medium transition-all ${selectedDay === d ? "bg-orange-500 text-white" : "bg-muted hover:bg-muted/60"}`}>{d}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">Guests</label>
                  <div className="flex items-center gap-3 border border-border rounded-xl px-4 py-2">
                    <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-7 h-7 rounded-full bg-muted hover:bg-muted/60 flex items-center justify-center font-bold transition-colors">-</button>
                    <span className="flex-1 text-center font-medium">{guests}</span>
                    <button onClick={() => setGuests(g => Math.min(10, g + 1))} className="w-7 h-7 rounded-full bg-muted hover:bg-muted/60 flex items-center justify-center font-bold transition-colors">+</button>
                  </div>
                </div>

                <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">₹{type.price.toLocaleString()} × {guests} guest{guests > 1 ? "s" : ""}</span><span>₹{(type.price * guests).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{Math.round(type.price * guests * 0.18).toLocaleString()}</span></div>
                  <div className="flex justify-between font-semibold border-t border-border pt-2"><span>Total</span><span>₹{Math.round(type.price * guests * 1.18).toLocaleString()}</span></div>
                </div>
              </div>

              <Button className="w-full mb-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white" size="lg">Book Now</Button>
              <Button variant="outline" className="w-full" size="sm">Request a Tour</Button>
              <p className="text-xs text-center text-muted-foreground mt-3">Free cancellation up to 24 hours before</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
