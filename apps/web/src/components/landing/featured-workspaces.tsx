"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { MapPin, Star, Wifi, Coffee, Monitor, Car, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "WiFi": Wifi,
  "Coffee": Coffee,
  "Monitors": Monitor,
  "Parking": Car,
  "Meeting Rooms": Users,
};

const workspaces = [
  {
    id: "1",
    name: "The Hub Bandra",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    location: "Bandra, Mumbai",
    rating: 4.9,
    reviews: 342,
    price: 599,
    currency: "₹",
    priceUnit: "day",
    seats: 120,
    amenities: ["WiFi", "Coffee", "Meeting Rooms"],
    tags: ["Hot Desk", "Private Cabin"],
    badge: "Most Popular",
  },
  {
    id: "2",
    name: "WeCreate Singapore",
    image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
    location: "Marina Bay, Singapore",
    rating: 4.8,
    reviews: 218,
    price: 45,
    currency: "$",
    priceUnit: "day",
    seats: 200,
    amenities: ["WiFi", "Coffee", "Monitors", "Parking"],
    tags: ["Hot Desk", "Event Space"],
    badge: "Premium",
  },
  {
    id: "3",
    name: "TechNest London",
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800",
    location: "Shoreditch, London",
    rating: 4.7,
    reviews: 476,
    price: 35,
    currency: "£",
    priceUnit: "day",
    seats: 180,
    amenities: ["WiFi", "Coffee", "Meeting Rooms"],
    tags: ["Dedicated Desk", "Virtual Office"],
    badge: null,
  },
  {
    id: "4",
    name: "Nomad Nest Bali",
    image: "https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?w=800",
    location: "Canggu, Bali",
    rating: 4.9,
    reviews: 651,
    price: 15,
    currency: "$",
    priceUnit: "day",
    seats: 60,
    amenities: ["WiFi", "Coffee"],
    tags: ["Hot Desk", "Community"],
    badge: "Editor's Pick",
  },
  {
    id: "5",
    name: "Skywork Dubai",
    image: "https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=800",
    location: "DIFC, Dubai",
    rating: 4.8,
    reviews: 189,
    price: 120,
    currency: "$",
    priceUnit: "day",
    seats: 95,
    amenities: ["WiFi", "Coffee", "Monitors", "Parking", "Meeting Rooms"],
    tags: ["Private Cabin", "Hot Desk"],
    badge: "Luxury",
  },
  {
    id: "6",
    name: "Basecamp NYC",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800",
    location: "SoHo, New York",
    rating: 4.7,
    reviews: 528,
    price: 65,
    currency: "$",
    priceUnit: "day",
    seats: 150,
    amenities: ["WiFi", "Coffee", "Monitors"],
    tags: ["Hot Desk", "Event Space"],
    badge: null,
  },
];

export function FeaturedWorkspaces() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24" ref={ref}>
      <div className="container">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-3">Premium Workspaces</h2>
            <p className="text-muted-foreground text-lg">Book coworking spaces in 150+ cities</p>
          </div>
          <Button variant="outline" asChild className="hidden md:flex">
            <Link href="/coworking">
              Explore all spaces <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((space, i) => (
            <motion.div
              key={space.id}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
            >
              <Link href={`/coworking/${space.id}`}>
                <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={space.image}
                      alt={space.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {space.badge && (
                      <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                        {space.badge}
                      </span>
                    )}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold">
                      {space.currency}{space.price}/{space.priceUnit}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{space.name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{space.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{space.location}</span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {space.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>

                    {/* Amenities */}
                    <div className="flex items-center gap-3 pt-3 border-t border-border">
                      {space.amenities.slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] ?? Wifi;
                        return (
                          <Icon key={amenity} className="w-4 h-4 text-muted-foreground" />
                        );
                      })}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {space.seats} seats · {space.reviews} reviews
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
