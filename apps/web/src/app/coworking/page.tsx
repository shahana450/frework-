"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, MapPin, Building2, ArrowRight, CheckCircle, Wifi, Coffee, Car, Users, Clock, Shield } from "lucide-react";
import Link from "next/link";

const CITIES = ["All Cities", "Mumbai", "Bangalore", "Delhi", "Gurgaon", "Hyderabad", "Pune", "Chennai"];

const FEATURES = [
  { icon: Wifi, label: "High-speed Internet", desc: "Fibre broadband in every listing" },
  { icon: Coffee, label: "Cafeteria & Café", desc: "Coffee and meals on-site" },
  { icon: Car, label: "Parking", desc: "Two-wheeler and car parking" },
  { icon: Users, label: "Meeting Rooms", desc: "Book private cabins by the hour" },
  { icon: Clock, label: "Flexible Hours", desc: "Day pass, monthly, or annual plans" },
  { icon: Shield, label: "Verified Listings", desc: "Every space personally verified" },
];

export default function CoworkingPage() {
  const [city, setCity] = useState("All Cities");
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <PageLayout>
      {/* Hero search bar */}
      <div className="bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs font-bold tracking-widest uppercase mb-4">
            🚧 Launching Soon
          </div>
          <h1 className="text-4xl font-bold mb-2">Find Your Perfect Workspace</h1>
          <p className="text-muted-foreground text-lg mb-8">We&apos;re onboarding premium coworking spaces across India — be the first to know when we go live.</p>
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by city or space name..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-orange-500 to-rose-500 text-white gap-2">
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-10">
        {/* City filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-10">
          {CITIES.map(c => (
            <button key={c} onClick={() => setCity(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${city === c ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Coming soon panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center mb-16"
        >
          <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Coworking directory launching soon</h2>
          <p className="text-muted-foreground mb-8">
            We&apos;re personally visiting and verifying spaces across India before listing them. No fake data, no stock photos — only real verified offices.
            {city !== "All Cities" && <><br /><span className="font-semibold text-foreground mt-2 inline-block">Actively onboarding in {city}.</span></>}
          </p>

          {/* Notify form */}
          {!submitted ? (
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-sm outline-none focus:border-orange-400 transition-colors"
              />
              <Button
                onClick={() => { if (email) setSubmitted(true); }}
                className="h-11 px-5 bg-orange-500 hover:bg-orange-600 text-white gap-2 shrink-0"
              >
                Notify me <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle className="w-5 h-5" /> You&apos;re on the list — we&apos;ll notify you!
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">No spam. One email when we launch in your city.</p>
        </motion.div>

        {/* Feature grid — what to expect */}
        <div className="mb-16">
          <p className="text-center text-xs font-bold tracking-widest uppercase text-muted-foreground mb-8">What every FreWork listing includes</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {FEATURES.map((f, i) => (
              <motion.div key={f.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA for space owners */}
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg mb-2">Own or manage a coworking space?</h3>
          <p className="text-muted-foreground text-sm mb-5">List your space on FreWork for free and get enquiries from verified professionals across India.</p>
          <Link href="/dashboard/workspace/submit">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              List your space — Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
