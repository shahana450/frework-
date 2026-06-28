"use client";

import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const stats = [
  { label: "Freelancers Joined", value: 500, suffix: "+", prefix: "", display: "500+" },
  { label: "Workspaces Listed", value: 50, suffix: "+", prefix: "", display: "50+" },
  { label: "Active Job Openings", value: 30, suffix: "+", prefix: "", display: "30+" },
  { label: "Cities Covered", value: 6, suffix: "", prefix: "", display: "6" },
  { label: "Successful Hires", value: 40, suffix: "+", prefix: "", display: "40+" },
  { label: "Growing Every Week", value: 100, suffix: "%", prefix: "", display: "🚀" },
];

function AnimatedNumber({ value, display }: { value: number; display: string }) {
  return <span>{display}</span>;
}

export function Stats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section ref={ref} className="py-20 border-y border-border bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Growing Across India</h2>
          <p className="text-muted-foreground">Real numbers, growing every week</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              <div className="text-3xl lg:text-4xl font-bold gradient-text mb-2">
                <AnimatedNumber value={stat.value} display={stat.display} />
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
