"use client";

import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const stats = [
  { label: "Active Freelancers", value: 2000000, suffix: "M+", prefix: "", display: "2M+" },
  { label: "Countries", value: 150, suffix: "+", prefix: "", display: "150+" },
  { label: "Projects Completed", value: 10000000, suffix: "M+", prefix: "", display: "10M+" },
  { label: "Coworking Spaces", value: 5000, suffix: "+", prefix: "", display: "5,000+" },
  { label: "Total Payments", value: 500, suffix: "M+", prefix: "$", display: "$500M+" },
  { label: "Client Satisfaction", value: 98, suffix: "%", prefix: "", display: "98%" },
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
          <h2 className="text-3xl font-bold mb-3">Trusted Worldwide</h2>
          <p className="text-muted-foreground">Numbers that speak for themselves</p>
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
