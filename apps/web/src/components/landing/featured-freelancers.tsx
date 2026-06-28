"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Star, MapPin, BadgeCheck, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const freelancers = [
  {
    id: "1",
    name: "Rahul Kumar",
    title: "Full-Stack Developer",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    location: "Bengaluru, Karnataka",
    rating: 4.9,
    reviews: 48,
    hourlyRate: 2800,
    skills: ["React", "Node.js", "TypeScript", "AWS"],
    verified: true,
    availability: "Available",
    badge: "Top Rated",
    badgeColor: "bg-yellow-500",
  },
  {
    id: "2",
    name: "Priya Sharma",
    title: "UI/UX Designer & Brand Strategist",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
    location: "Mumbai, Maharashtra",
    rating: 5.0,
    reviews: 31,
    hourlyRate: 2200,
    skills: ["Figma", "Branding", "Prototyping", "Webflow"],
    verified: true,
    availability: "Available",
    badge: "Expert",
    badgeColor: "bg-brand-500",
  },
  {
    id: "3",
    name: "Arjun Nair",
    title: "CA & Financial Consultant",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
    location: "Mumbai, Maharashtra",
    rating: 4.9,
    reviews: 62,
    hourlyRate: 3500,
    skills: ["IND AS", "GST", "Tax Planning", "Audit"],
    verified: true,
    availability: "Available",
    badge: "Expert",
    badgeColor: "bg-brand-500",
  },
  {
    id: "4",
    name: "Vikram Iyer",
    title: "Digital Marketing & SEO Expert",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    location: "Hyderabad, Telangana",
    rating: 4.8,
    reviews: 22,
    hourlyRate: 1800,
    skills: ["SEO", "Google Ads", "Content Strategy", "Analytics"],
    verified: true,
    availability: "Available",
    badge: "Rising Star",
    badgeColor: "bg-green-500",
  },
  {
    id: "5",
    name: "Sneha Kulkarni",
    title: "Machine Learning Engineer",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
    location: "Pune, Maharashtra",
    rating: 4.9,
    reviews: 17,
    hourlyRate: 4000,
    skills: ["PyTorch", "TensorFlow", "NLP", "Python"],
    verified: true,
    availability: "Available",
    badge: "Expert",
    badgeColor: "bg-brand-500",
  },
  {
    id: "6",
    name: "Rohan Desai",
    title: "Content Strategist & Copywriter",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150",
    location: "Ahmedabad, Gujarat",
    rating: 4.8,
    reviews: 29,
    hourlyRate: 1500,
    skills: ["Content Writing", "SEO Copy", "Brand Voice", "Blogging"],
    verified: true,
    availability: "Available",
    badge: "Rising Star",
    badgeColor: "bg-green-500",
  },
];

export function FeaturedFreelancers() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 bg-muted/20" ref={ref}>
      <div className="container">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-3">Featured Talent</h2>
            <p className="text-muted-foreground text-lg">
              Hand-picked experts verified by our team
            </p>
          </div>
          <Button variant="outline" asChild className="hidden md:flex">
            <Link href="/freelancers">
              Browse all talent <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {freelancers.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
            >
              <Link href={`/freelancers/${f.id}`}>
                <div className="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
                  {/* Badge */}
                  <span className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold text-white ${f.badgeColor}`}>
                    {f.badge}
                  </span>

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <img
                        src={f.avatar}
                        alt={f.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
                      />
                      {f.verified && (
                        <BadgeCheck className="absolute -bottom-1 -right-1 w-5 h-5 text-brand-500 bg-background rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{f.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{f.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{f.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-semibold">{f.rating}</span>
                      <span className="text-xs text-muted-foreground">({f.reviews} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={`text-xs font-medium ${f.availability === "Available" ? "text-green-500" : "text-orange-500"}`}>
                        {f.availability}
                      </span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {f.skills.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {f.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{f.skills.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <span className="text-xs text-muted-foreground">Starting at</span>
                      <p className="text-base font-bold">₹{f.hourlyRate.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/hr</span></p>
                    </div>
                    <Button size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      View Profile
                    </Button>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 md:hidden">
          <Button variant="outline" asChild>
            <Link href="/freelancers">Browse all talent <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
