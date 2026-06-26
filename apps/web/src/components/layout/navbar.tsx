"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Globe,
  Briefcase,
  Building2,
  Rocket,
  TrendingUp,
  Users,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const solutions = [
  { title: "Find Freelancers", href: "/freelancers", icon: Users, description: "Hire verified experts across 50+ categories" },
  { title: "Browse Jobs", href: "/jobs", icon: Briefcase, description: "Find your next project or full-time role" },
  { title: "Post a Job", href: "/jobs/post", icon: Briefcase, description: "Reach thousands of qualified candidates" },
  { title: "Book Workspace", href: "/coworking", icon: Building2, description: "Find coworking spaces in 150+ cities" },
  { title: "Startup Hub", href: "/startups", icon: Rocket, description: "Build, grow, and fund your startup" },
  { title: "Investor Portal", href: "/investors", icon: TrendingUp, description: "Discover and invest in top startups" },
  { title: "Community", href: "/community", icon: Globe, description: "Connect with professionals worldwide" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="gradient-text">FreWork</span>
        </Link>

        {/* Desktop Nav */}
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[500px] gap-2 p-4 md:grid-cols-2">
                  {solutions.map((item) => (
                    <li key={item.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={item.href}
                          className="flex items-start gap-3 rounded-lg p-3 hover:bg-accent transition-colors"
                        >
                          <item.icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                          <div>
                            <div className="text-sm font-medium">{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          </div>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors">
                Pricing
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/blog" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors">
                Blog
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/community" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors">
                Community
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 text-white">
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-md hover:bg-accent"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="container py-4 flex flex-col gap-2">
              {solutions.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{item.title}</span>
                </Link>
              ))}
              <div className="border-t border-border pt-3 mt-2 flex flex-col gap-2">
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild className="w-full bg-gradient-to-r from-brand-500 to-purple-600 text-white">
                  <Link href="/register">Get Started Free</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
