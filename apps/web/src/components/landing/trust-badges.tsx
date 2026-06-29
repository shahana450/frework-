"use client";

import { ShieldCheck, Clock, MapPin, Users } from "lucide-react";

const badges = [
  { icon: MapPin, label: "Coworking Spaces Listed" },
  { icon: Users, label: "Freelancers on Platform" },
  { icon: ShieldCheck, label: "CA & CS Qualified Experts" },
  { icon: Clock, label: "24-Hour Response Time" },
];

export function TrustBadges() {
  return (
    <section className="border-y border-white/6 bg-[#070D1A] py-5">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-10 md:gap-20">
          {badges.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-white/25" />
              <span className="text-xs font-medium text-white/35 tracking-wide uppercase">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
