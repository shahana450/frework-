"use client";

import { ShieldCheck, Clock, Users, Award } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "100% Compliance Guaranteed" },
  { icon: Clock, label: "24-Hour Response Time" },
  { icon: Users, label: "500+ Businesses Served" },
  { icon: Award, label: "CA & CS Qualified Experts" },
];

export function TrustBadges() {
  return (
    <section className="border-y border-[#C9A84C]/12 bg-[#070D1A] py-5">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-10 md:gap-20">
          {badges.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-[#C9A84C]/70" />
              <span className="text-xs font-medium text-white/45 tracking-wide uppercase">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
