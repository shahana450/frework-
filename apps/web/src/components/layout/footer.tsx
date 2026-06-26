import Link from "next/link";
import { Globe, Twitter, Linkedin, Github, Instagram, Youtube } from "lucide-react";

const footerLinks = {
  Platform: [
    { label: "Find Freelancers", href: "/freelancers" },
    { label: "Post a Job", href: "/jobs/post" },
    { label: "Coworking Spaces", href: "/coworking" },
    { label: "Startup Hub", href: "/startups" },
    { label: "Investor Portal", href: "/investors" },
    { label: "Agency Hub", href: "/agencies" },
  ],
  Resources: [
    { label: "Blog", href: "/blog" },
    { label: "Community Forum", href: "/community" },
    { label: "Knowledge Center", href: "/knowledge" },
    { label: "Events", href: "/events" },
    { label: "Webinars", href: "/webinars" },
    { label: "API Docs", href: "/docs/api" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Partners", href: "/partners" },
    { label: "Affiliates", href: "/affiliates" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "GDPR", href: "/gdpr" },
    { label: "Security", href: "/security" },
    { label: "Sitemap", href: "/sitemap.xml" },
  ],
};

const socials = [
  { icon: Twitter, href: "https://twitter.com/frework", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com/company/frework", label: "LinkedIn" },
  { icon: Github, href: "https://github.com/frework", label: "GitHub" },
  { icon: Instagram, href: "https://instagram.com/frework", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com/frework", label: "YouTube" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="gradient-text">FreWork</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              India's fastest-growing platform to find freelancers, book coworking spaces, and grow your startup — all in one place.
            </p>
            <div className="flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent hover:border-primary/50 transition-colors"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} FreWork. All rights reserved.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              All systems operational
            </span>
            <span className="text-xs text-muted-foreground">🌍 Available in 50+ languages</span>
            <span className="text-xs text-muted-foreground">🔒 SOC2 Certified</span>
            <span className="text-xs text-muted-foreground">✅ GDPR Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
