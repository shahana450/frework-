"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Priya Nair",
    role: "Senior UX Designer",
    company: "Freelancer",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100",
    rating: 5,
    text: "WorkSphere completely transformed how I find clients. Within the first month, I landed 3 long-term projects worth over ₹8 lakhs. The AI matching is incredibly accurate.",
    location: "Bangalore, India",
  },
  {
    name: "Michael Torres",
    role: "CTO",
    company: "NovaTech Startup",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    rating: 5,
    text: "We hired our entire engineering team through WorkSphere in just 2 weeks. The quality of talent is unmatched and the escrow payment system gave us complete peace of mind.",
    location: "Austin, USA",
  },
  {
    name: "Fatima Al-Hassan",
    role: "Coworking Owner",
    company: "Desert Hub Dubai",
    avatar: "https://images.unsplash.com/photo-1619473273021-48c5fd38f7d8?w=100",
    rating: 5,
    text: "Our occupancy went from 40% to 95% within 3 months of listing on WorkSphere. The booking management and payment processing are seamless. Best decision we ever made.",
    location: "Dubai, UAE",
  },
  {
    name: "David Kim",
    role: "Founder",
    company: "HealthAI Startup",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100",
    rating: 5,
    text: "Through the Startup Hub, I connected with 3 investors and closed a $1.2M seed round. The investor matching algorithm is phenomenal. Couldn't have done it without WorkSphere.",
    location: "Seoul, South Korea",
  },
  {
    name: "Amara Osei",
    role: "Marketing Consultant",
    company: "Freelancer",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100",
    rating: 5,
    text: "The AI proposal generator helped me win 80% more projects. My earnings tripled in 6 months. WorkSphere is the most professional freelancing platform I've ever used.",
    location: "Accra, Ghana",
  },
  {
    name: "Rachel Zhang",
    role: "HR Director",
    company: "GlobalCorp",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100",
    rating: 5,
    text: "We've reduced our hiring time by 70% using WorkSphere. The talent verification and skill assessments save us weeks of screening. Absolutely worth every dollar.",
    location: "Shanghai, China",
  },
];

export function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 bg-muted/20" ref={ref}>
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Loved by Professionals Worldwide</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join millions of professionals who trust WorkSphere to grow their careers and businesses.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-muted-foreground text-sm">4.9/5 from 50,000+ reviews</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 relative"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/10" />
              <div className="flex items-center gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                />
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
