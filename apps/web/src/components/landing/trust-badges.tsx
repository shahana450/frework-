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
    <section className="border-y border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {badges.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
              <Icon className="w-5 h-5 text-violet-600" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
