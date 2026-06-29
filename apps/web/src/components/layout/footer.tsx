import Link from "next/link";
import { Twitter, Linkedin, Instagram, Youtube } from "lucide-react";

const footerLinks = {
  FIND: [
    { label: "Coworking & Offices", href: "/coworking" },
    { label: "Freelancers", href: "/freelancers" },
    { label: "Jobs", href: "/jobs" },
    { label: "Post a Job", href: "/jobs/post" },
  ],
  GROW: [
    { label: "Compliance", href: "/services/compliance" },
    { label: "DPR", href: "/services/dpr" },
    { label: "Pitch Decks", href: "/services/pitch-decks" },
    { label: "Restructuring", href: "/services/restructuring" },
    { label: "Training", href: "/services/training" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

const socials = [
  { icon: Twitter, href: "https://twitter.com/frework", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com/company/frework", label: "LinkedIn" },
  { icon: Instagram, href: "https://instagram.com/frework", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com/frework", label: "YouTube" },
];

function FreWorkLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw_foot_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
        <filter id="fw_foot_glow">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#fw_foot_bg)"/>
      <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="10"/>
        <line x1="19" y1="19" x2="27" y2="24"/>
        <line x1="19" y1="19" x2="11" y2="24"/>
      </g>
      <g fill="white" filter="url(#fw_foot_glow)">
        <circle cx="19" cy="19" r="3.2"/>
        <circle cx="19" cy="10" r="2.2"/>
        <circle cx="27" cy="24" r="2.2"/>
        <circle cx="11" cy="24" r="2.2"/>
      </g>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/6 bg-[#060C18]">
      <div className="container py-16 px-4 mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <FreWorkLogo size={32} />
              <span
                className="font-bold text-[#F6F4FC] group-hover:text-white transition-colors"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "1.15rem", letterSpacing: "-0.025em" }}
              >
                FreWork
              </span>
            </Link>
            <p className="text-sm text-white/35 leading-relaxed max-w-xs mb-7">
              One platform, two doors — FIND workspaces, freelancers and jobs, or GROW your business with expert CA & CS services.
            </p>
            <div className="flex items-center gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl border border-white/8 flex items-center justify-center text-white/35 hover:text-white hover:border-white/20 transition-colors"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-bold tracking-[0.18em] uppercase text-white/30 mb-5">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/45 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/6 mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} FreWork. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span className="text-xs text-white/25">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
