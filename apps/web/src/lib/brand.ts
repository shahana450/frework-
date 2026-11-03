// Per-domain branding: the same app under another firm's name, logo and colours. frework.online stays FreBook.
// The brand comes from the domain; `?brand=cswa` (remembered on this device, `?brand=frebook` clears it) previews one
// before its domain is live.
import { useEffect, useState } from "react";

export type Brand = { key: string; name: string; tagline: string; logo: string | null; hosts: string[] };

export const BRANDS: Record<string, Brand> = {
  frebook: { key: "frebook", name: "FreBook", tagline: "Chat in. Books out.", logo: null, hosts: [] },
  cswa: { key: "cswa", name: "CSWA Books", tagline: "Group of Companies", logo: "/brands/cswa.png", hosts: [] },   // add the domain here once bought
};

const KEY = "fw_brand_preview";

export function currentBrand(): Brand {
  if (typeof window === "undefined") return BRANDS.frebook;
  try {
    const q = new URLSearchParams(location.search).get("brand");
    if (q && BRANDS[q]) { if (q === "frebook") localStorage.removeItem(KEY); else localStorage.setItem(KEY, q); return BRANDS[q]; }
  } catch { /* */ }
  const host = location.hostname.toLowerCase();
  const byHost = Object.values(BRANDS).find(b => b.hosts.some(h => host === h || host.endsWith("." + h)));
  if (byHost) return byHost;
  try { const k = localStorage.getItem(KEY); if (k && BRANDS[k]) return BRANDS[k]; } catch { /* */ }
  return BRANDS.frebook;
}

export function useBrand(): Brand {
  const [b, setB] = useState<Brand>(BRANDS.frebook);
  useEffect(() => { setB(currentBrand()); }, []);
  return b;
}

/** Colour overrides for a brand, layered over the FreBook styles (inline colours need !important). */
export const BRAND_CSS: Record<string, string> = {
  cswa: `
[data-brand="cswa"] .fw-side { background: #161B7A !important; border-right-color: rgba(160,175,255,0.18) !important; }
[data-brand="cswa"] .fw-side [style*="217,181,111"], [data-brand="cswa"] .fw-side [style*="D9B56F"] { border-color: rgba(170,185,255,0.35) !important; }
[data-brand="cswa"] .fw-side [style*="color: rgb(217, 181, 111)"] { color: #B9C4FF !important; }
[data-brand="cswa"] .fw-nav.on, [data-brand="cswa"] .fw-nav.on:hover { background: #FFFFFF !important; color: #161B7A !important; }
[data-brand="cswa"] .fw-nav:focus-visible { outline-color: #B9C4FF; }
[data-brand="cswa"], [data-brand="cswa"] .fw-main, [data-brand="cswa"] .fw-main > div:first-child { background: #F3F5FC !important; background-color: #F3F5FC !important; }
[data-brand="cswa"] .fw-topicons { border-color: #DDE2F3; box-shadow: 0 10px 28px -20px rgba(22,27,122,0.5); }
[data-brand="cswa"] .fw-topicons a { color: #48507A; }
[data-brand="cswa"] .fw-topicons a .ic { background: #EBEEFA; color: #161B7A; }
[data-brand="cswa"] .fw-topicons a:hover { background: #F2F4FD; color: #161B7A; }
[data-brand="cswa"] .fw-topicons a:hover .ic { background: #D9DFF7; }
[data-brand="cswa"] .fw-topicons a.on { background: linear-gradient(160deg,#2A31A8,#161B7A); }
[data-brand="cswa"] .fw-topicons a.on .ic { background: rgba(255,255,255,0.16); color: #FFFFFF; }
[data-brand="cswa"] .fw-topicons a.on::after { background: #B9C4FF; }
[data-brand="cswa"] .fw-topicons a .win { background: #161B7A; }
[data-brand="cswa"] .fw-tip { background: #161B7A; border-color: rgba(185,196,255,0.4); }
[data-brand="cswa"] .fw-main h1 { color: #161B7A; }
[data-brand="cswa"] .fw-main button[style*="18, 53, 45"], [data-brand="cswa"] .fw-main button[style*="15, 43, 37"], [data-brand="cswa"] .fw-main a[style*="18, 53, 45"] { background: #1E24A0 !important; }
[data-brand="cswa"] .fw-main input:focus-visible, [data-brand="cswa"] .fw-main button:focus-visible, [data-brand="cswa"] .fw-main a:focus-visible { outline-color: #1E24A0; }
@media (max-width: 760px) { [data-brand="cswa"] .fw-tabs a.on { color: #161B7A; } [data-brand="cswa"] .fw-tabs a.plus { background: #161B7A; } }
`,
};
