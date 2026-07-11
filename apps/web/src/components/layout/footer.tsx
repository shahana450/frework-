import Link from "next/link";
import { Twitter, Linkedin, Instagram, Youtube, Phone } from "lucide-react";

const SUPPORT_WA = "918590874681";
const SUPPORT_PHONE = "+91 85908 74681";

const footerLinks = {
  Services: [
    { label: "Company Registration", href: "/services/compliance" },
    { label: "GST Registration", href: "/services/compliance" },
    { label: "Income Tax (ITR)", href: "/services/compliance" },
    { label: "ROC / MCA Filing", href: "/services/compliance" },
    { label: "MSME / Udyam", href: "/services/compliance" },
  ],
  Find: [
    { label: "Hire Professionals", href: "/freelancers" },
    { label: "Coworking Spaces", href: "/coworking" },
    { label: "Job Board", href: "/jobs" },
    { label: "Startup Launchpad", href: "/startups" },
  ],
  Grow: [
    { label: "Detailed Project Report", href: "/services/dpr" },
    { label: "Pitch Deck Design", href: "/services/pitch-decks" },
    { label: "Business Restructuring", href: "/services/restructuring" },
    { label: "Training & Workshops", href: "/services/training" },
  ],
  Company: [
    { label: "About FreWork", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
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
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#fw_foot_bg)"/>
      <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="10"/>
        <line x1="19" y1="19" x2="27" y2="24"/>
        <line x1="19" y1="19" x2="11" y2="24"/>
      </g>
      <g fill="white">
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
    <footer style={{ background: "#F4EFE6", borderTop: "1px solid rgba(184,144,58,0.15)" }}>
      <div className="container py-16 px-4 mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <FreWorkLogo size={32} />
              <div>
                <span
                  className="font-bold block transition-colors"
                  style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "1.15rem", letterSpacing: "-0.025em", color: "#1A1208" }}
                >
                  FreWork
                </span>
                <span className="text-[9px] tracking-[0.12em] uppercase block" style={{ color: "rgba(184,144,58,0.65)" }}>
                  Business OS
                </span>
              </div>
            </Link>

            <p className="text-sm leading-relaxed max-w-xs mb-5" style={{ color: "#9C8B70" }}>
              The Operating System for Indian Businesses. Start, Run and Grow — all in one place.
            </p>

            {/* Contact */}
            <div className="flex flex-col gap-2.5 mb-6">
              <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20need%20help`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all hover:scale-[1.02] w-fit"
                style={{ background: "rgba(37,211,102,0.06)", borderColor: "rgba(37,211,102,0.2)", color: "#15803D" }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat on WhatsApp
              </a>
              <a href={`tel:${SUPPORT_PHONE}`}
                className="inline-flex items-center gap-2 text-xs font-medium w-fit transition-colors"
                style={{ color: "#9C8B70" }}>
                <Phone className="w-3.5 h-3.5" style={{ color: "#B8903A" }} />
                {SUPPORT_PHONE}
              </a>
            </div>

            {/* Socials */}
            <div className="flex items-center gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-[1.08]"
                  style={{ border: "1px solid rgba(184,144,58,0.18)", color: "#9C8B70", background: "#fff" }}>
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[10px] font-black tracking-[0.2em] uppercase mb-5"
                style={{ color: "#B8903A" }}>{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-sm transition-colors hover:text-[#1A1208]"
                      style={{ color: "#9C8B70" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(184,144,58,0.12)" }}>
          <p className="text-xs" style={{ color: "#C4B49A" }}>
            © {new Date().getFullYear()} FreWork. All rights reserved. · Made with ❤️ in India
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs" style={{ color: "#C4B49A" }}>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
