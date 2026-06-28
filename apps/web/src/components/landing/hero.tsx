"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Briefcase, Building2, Users, Rocket, Sparkles, ArrowRight } from "lucide-react";

const searchCategories = [
  { label: "Freelancers", value: "freelancers", icon: Users, href: "/freelancers" },
  { label: "Workspaces", value: "coworking", icon: Building2, href: "/coworking" },
  { label: "Jobs", value: "jobs", icon: Briefcase, href: "/jobs" },
  { label: "Startups", value: "startups", icon: Rocket, href: "/startups" },
];

const popularSearches = ["React Developer", "UI/UX Designer", "Coworking Mumbai", "Startup Funding", "CA/CPA"];

const floatingCards = [
  { top: "10%", left: "5%", content: "💼 New project posted", sub: "₹50,000 budget" },
  { top: "20%", right: "5%", content: "⭐ 5-star review", sub: "John D. · Just now" },
  { bottom: "25%", left: "3%", content: "🏢 Workspace booked", sub: "Bangalore · 3 seats" },
  { bottom: "20%", right: "3%", content: "🚀 Startup funded", sub: "$500K raised" },
];

export function Hero() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("freelancers");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = searchCategories.find((c) => c.value === activeCategory);
    if (cat) {
      router.push(`${cat.href}?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-mesh-gradient opacity-60 dark:opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float [animation-delay:1.5s]" />

      {/* Floating cards */}
      {floatingCards.map((card, i) => (
        <motion.div
          key={i}
          className="absolute hidden xl:block glass rounded-xl px-4 py-3 shadow-lg"
          style={{ top: card.top, left: card.left, right: card.right, bottom: card.bottom }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.2, duration: 0.6 }}
        >
          <p className="text-sm font-medium">{card.content}</p>
          <p className="text-xs text-muted-foreground">{card.sub}</p>
        </motion.div>
      ))}

      <div className="container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Badge className="mb-6 px-4 py-1.5 text-sm bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 hover:bg-brand-500/20">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            India's new platform for freelancers, workspaces &amp; hiring — join early
          </Badge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-6 leading-[1.1]">
            Free to Work.{" "}
            <span className="gradient-text">Free to Grow.</span>
            <br />
            This is FreWork.
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            India's most complete professional ecosystem. Find top freelancers,
            book coworking spaces, discover startups, and raise funding — all in one place.
          </p>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto">
            {/* Category tabs */}
            <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
              {searchCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 p-2 bg-background rounded-2xl border border-border shadow-xl">
              <div className="flex-1 flex items-center gap-3 px-3">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${searchCategories.find(c => c.value === activeCategory)?.label.toLowerCase()}...`}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2 px-3 border-l border-border">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Location"
                  className="w-24 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 text-white px-6"
              >
                Search
              </Button>
            </form>

            {/* Popular searches */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <span className="text-xs text-muted-foreground">Popular:</span>
              {popularSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 mt-10 flex-wrap">
            <Button size="lg" className="bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 text-white rounded-xl px-8 h-12 text-base">
              Start for Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl px-8 h-12 text-base">
              Watch Demo
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
