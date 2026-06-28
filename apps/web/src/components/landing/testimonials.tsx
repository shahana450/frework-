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
    text: "I listed my profile on FreWork last month and already have two long-term clients. The platform is clean, fast, and focused — exactly what Indian freelancers need.",
    location: "Bengaluru, India",
  },
  {
    name: "Arjun Mehta",
    role: "Founder",
    company: "TechPulse Startup",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    rating: 5,
    text: "We posted our first job on FreWork and received 12 qualified applications in 3 days. The talent quality is far better than what we found on generic platforms.",
    location: "Pune, India",
  },
  {
    name: "Ritu Sharma",
    role: "Coworking Space Owner",
    company: "The WorkNest",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100",
    rating: 5,
    text: "We listed our coworking space on FreWork and filled 8 seats in the first two weeks. Simple listing process, great visibility with local professionals.",
    location: "Mumbai, India",
  },
  {
    name: "Vikram Iyer",
    role: "Full-Stack Developer",
    company: "Freelancer",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
    rating: 5,
    text: "FreWork gave me a professional profile page I'm proud to share with clients. Landed my first ₹80,000 project within 3 weeks of joining. Highly recommend it.",
    location: "Hyderabad, India",
  },
  {
    name: "Sneha Kulkarni",
    role: "HR Manager",
    company: "GrowthBridge Pvt Ltd",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100",
    rating: 5,
    text: "We use FreWork to find contract professionals for project-based work. The verified profiles save us hours of screening and the platform is easy to use.",
    location: "Chennai, India",
  },
  {
    name: "Rohan Desai",
    role: "Content Strategist",
    company: "Freelancer",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100",
    rating: 5,
    text: "As a content freelancer, FreWork helped me position myself properly and reach clients who actually value good writing. My monthly income has nearly doubled.",
    location: "Ahmedabad, India",
  },
];

export function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 bg-muted/20" ref={ref}>
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Loved by India's Professionals</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join freelancers, employers, and workspace owners who are growing with FreWork.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-muted-foreground text-sm">Rated 5/5 by our early community</span>
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
