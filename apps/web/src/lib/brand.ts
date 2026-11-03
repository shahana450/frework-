// Per-domain branding: the same app under another firm's name, logo and colours. frework.online stays FreBook.
// The brand comes from the domain; `?brand=cswa` (remembered on this device, `?brand=frebook` clears it) previews one
// before its domain is live.
import { useEffect, useState } from "react";

export type Brand = { key: string; name: string; tagline: string; logo: string | null; hosts: string[] };

export const BRANDS: Record<string, Brand> = {
  frebook: { key: "frebook", name: "FreBook", tagline: "Chat in. Books out.", logo: null, hosts: [] },
  cswa: { key: "cswa", name: "BooksAI", tagline: "by CSWA", logo: "/brands/cswa.png", hosts: [] },   // add the domain here once bought
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
[data-brand="cswa"] .fw-side { background: #1F1F9E !important; border-right-color: rgba(160,175,255,0.18) !important; }
[data-brand="cswa"] .fw-side [style*="217,181,111"], [data-brand="cswa"] .fw-side [style*="D9B56F"] { border-color: rgba(170,185,255,0.35) !important; }
[data-brand="cswa"] .fw-side [style*="color: rgb(217, 181, 111)"] { color: #B9C4FF !important; }
[data-brand="cswa"] .fw-nav.on, [data-brand="cswa"] .fw-nav.on:hover { background: #FFFFFF !important; color: #1F1F9E !important; }
[data-brand="cswa"] .fw-nav:focus-visible { outline-color: #B9C4FF; }
[data-brand="cswa"], [data-brand="cswa"] .fw-main, [data-brand="cswa"] .fw-main > div:first-child { background: #F3F5FC !important; background-color: #F3F5FC !important; }
[data-brand="cswa"] .fw-topicons { border-color: #DDE2F3; box-shadow: 0 10px 28px -20px rgba(31,31,158,0.45); }
[data-brand="cswa"] .fw-topicons a { color: #48507A; }
[data-brand="cswa"] .fw-topicons a .ic { background: #EBEEFA; color: #1F1F9E; }
[data-brand="cswa"] .fw-topicons a:hover { background: #F2F4FD; color: #1F1F9E; }
[data-brand="cswa"] .fw-topicons a:hover .ic { background: #D9DFF7; }
[data-brand="cswa"] .fw-topicons a.on { background: linear-gradient(160deg,#3A3AC4,#1F1F9E); }
[data-brand="cswa"] .fw-topicons a.on .ic { background: rgba(255,255,255,0.16); color: #FFFFFF; }
[data-brand="cswa"] .fw-topicons a.on::after { background: #B9C4FF; }
[data-brand="cswa"] .fw-topicons a .win { background: #1F1F9E; }
[data-brand="cswa"] .fw-tip { background: #1F1F9E; border-color: rgba(185,196,255,0.4); }
[data-brand="cswa"] .fw-main h1 { color: #1F1F9E; }
[data-brand="cswa"] .fw-main [style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main [style*="background: rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: rgb(27, 66, 55)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(18, 53, 45)"] { background: #1F1F9E !important; }
[data-brand="cswa"] .fw-main [style*="background: rgb(244, 239, 228)"], [data-brand="cswa"] .fw-main [style*="background: rgb(247, 241, 227)"], [data-brand="cswa"] .fw-main [style*="background: rgb(243, 236, 221)"] { background: #EEF1FB !important; }
[data-brand="cswa"] .fw-main [style*="background: rgb(228, 236, 232)"], [data-brand="cswa"] .fw-main [style*="background: rgb(243, 232, 210)"] { background: #E6EAFA !important; }
[data-brand="cswa"] .fw-main [style*="color: rgb(154, 107, 34)"] { color: #3A3AC4 !important; }
[data-brand="cswa"] .fw-main input:focus-visible, [data-brand="cswa"] .fw-main button:focus-visible, [data-brand="cswa"] .fw-main a:focus-visible { outline-color: #1F1F9E; }
/* Its own arrangement, not FreBook's: a white top bar with icon-beside-label pills, and a flat sidebar with a left marker */
[data-brand="cswa"] .fw-topicons { margin: 0; border-radius: 0; border-width: 0 0 1px; background: #FFFFFF; padding: 8px 16px; gap: 4px; box-shadow: 0 6px 18px -14px rgba(31,31,158,0.5); }
[data-brand="cswa"] .fw-topicons a { flex-direction: row; gap: 7px; min-width: 0; padding: 7px 14px 7px 8px; border-radius: 999px; font-size: 12.5px; }
[data-brand="cswa"] .fw-topicons a .ic { width: 26px; height: 26px; border-radius: 50%; }
[data-brand="cswa"] .fw-topicons a .ic svg { width: 15px; height: 15px; }
[data-brand="cswa"] .fw-topicons a.on { background: #1F1F9E; box-shadow: none; }
[data-brand="cswa"] .fw-topicons a.on::after { display: none; }
[data-brand="cswa"] .fw-topicons a.grp { margin-left: 14px; }
[data-brand="cswa"] .fw-topicons a .win { top: -4px; right: -4px; border-radius: 50%; }
[data-brand="cswa"] .fw-nav { border-radius: 0 !important; margin-left: 0 !important; margin-right: 0 !important; border-left: 3px solid transparent; }
[data-brand="cswa"] .fw-nav.on, [data-brand="cswa"] .fw-nav.on:hover { background: rgba(255,255,255,0.12) !important; color: #FFFFFF !important; border-left-color: #FFFFFF; }
/* The rest of FreBook's green and gold inside pages, in the brand's blues */
[data-brand="cswa"] .fw-main [style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main [style*="background: rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="#12352D"], [data-brand="cswa"] .fw-main [style*="#0F2B25"] { background: #1F1F9E !important; }
[data-brand="cswa"] .fw-main [style*="color: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main [style*="color: rgb(15, 43, 37)"] { color: #1F1F9E !important; }
[data-brand="cswa"] .fw-main [style*="background: rgb(201, 162, 74)"], [data-brand="cswa"] .fw-main [style*="background: rgb(217, 181, 111)"] { background: #6B74E0 !important; color: #FFFFFF !important; }
[data-brand="cswa"] .fw-main [style*="color: rgb(201, 162, 74)"], [data-brand="cswa"] .fw-main [style*="color: rgb(232, 194, 122)"], [data-brand="cswa"] .fw-main [style*="color: rgb(217, 181, 111)"] { color: #8D96F0 !important; }
[data-brand="cswa"] .fw-main [style*="background: rgb(255, 253, 248)"], [data-brand="cswa"] .fw-main [style*="background: rgb(251, 248, 241)"], [data-brand="cswa"] .fw-main [style*="background: rgb(248, 243, 232)"], [data-brand="cswa"] .fw-main [style*="background: rgb(246, 241, 231)"] { background: #FFFFFF !important; }
[data-brand="cswa"] .fw-main [style*="border: 1px solid rgb(230, 223, 208)"] { border-color: #E1E5F3 !important; }
/* Richer finish: deep gradient sidebar, glow on the selected item, soft blue shadows on cards */
[data-brand="cswa"] .fw-side { background: linear-gradient(180deg,#2328A8 0%,#1A1D8C 45%,#10125E 100%) !important; box-shadow: 6px 0 24px -12px rgba(16,18,94,0.55); }
[data-brand="cswa"] .fw-nav.on, [data-brand="cswa"] .fw-nav.on:hover { background: linear-gradient(90deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06)) !important; box-shadow: inset 3px 0 0 #8FB4FF; border-left-color: transparent; }
[data-brand="cswa"] .fw-nav:hover { background: rgba(255,255,255,0.09); }
[data-brand="cswa"], [data-brand="cswa"] .fw-main, [data-brand="cswa"] .fw-main > div:first-child { background: radial-gradient(1200px 500px at 85% -10%, #E7ECFF 0%, rgba(231,236,255,0) 60%), #F6F8FF !important; }
[data-brand="cswa"] .fw-topicons { background: rgba(255,255,255,0.92); }
[data-brand="cswa"] .fw-topicons a.on { background: linear-gradient(135deg,#4A5CFF,#2328A8) !important; box-shadow: 0 8px 18px -8px rgba(58,72,230,0.7); }
[data-brand="cswa"] .fw-topicons a .ic { background: #EEF1FF; color: #2328A8; }
[data-brand="cswa"] .fw-topicons a:hover .ic { background: #DCE3FF; }
[data-brand="cswa"] .fw-main h1 { color: #1A1D8C; }
[data-brand="cswa"] .fw-main [style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main [style*="background: rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(18, 53, 45)"] { background: linear-gradient(135deg,#2A33C4 0%,#1A1D8C 55%,#12146B 100%) !important; }
[data-brand="cswa"] .fw-main button[style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main button[style*="background: rgb(15, 43, 37)"] { background: linear-gradient(135deg,#4A5CFF,#2328A8) !important; box-shadow: 0 6px 14px -8px rgba(58,72,230,0.8); }
[data-brand="cswa"] .fw-main section, [data-brand="cswa"] .fw-main [style*="border-radius: 16px"], [data-brand="cswa"] .fw-main [style*="border-radius: 18px"] { box-shadow: 0 10px 30px -22px rgba(35,40,168,0.45); }
[data-brand="cswa"] .fw-main [style*="color: rgb(154, 107, 34)"], [data-brand="cswa"] .fw-main [style*="color: rgb(201, 162, 74)"] { color: #4A5CFF !important; }
/* Sapphire & Platinum: royal sapphire with platinum-silver accents, cool and corporate (last, so it wins) */
[data-brand="cswa"] .fw-side { background: linear-gradient(180deg,#132C74 0%,#0D1E52 50%,#08122F 100%) !important; border-right: 1px solid rgba(214,220,229,0.14) !important; }
[data-brand="cswa"] .fw-side [style*="color: rgb(217, 181, 111)"], [data-brand="cswa"] .fw-side [style*="color: rgb(185, 196, 255)"] { color: #C9D2DF !important; }
[data-brand="cswa"] .fw-nav { color: #DCE2EC !important; }
[data-brand="cswa"] .fw-nav:hover { background: rgba(214,220,229,0.08) !important; }
[data-brand="cswa"] .fw-nav.on, [data-brand="cswa"] .fw-nav.on:hover { background: linear-gradient(90deg,rgba(214,220,229,0.20),rgba(214,220,229,0.05)) !important; color: #FFFFFF !important; box-shadow: inset 3px 0 0 #D6DCE5 !important; }
[data-brand="cswa"], [data-brand="cswa"] .fw-main, [data-brand="cswa"] .fw-main > div:first-child { background: linear-gradient(180deg,#EEF1F6 0%,#F5F7FA 40%,#F5F7FA 100%) !important; }
[data-brand="cswa"] .fw-topicons { background: #FFFFFF; border-bottom: 1px solid #DDE2EA; box-shadow: 0 6px 18px -14px rgba(13,30,82,0.45); }
[data-brand="cswa"] .fw-topicons a { color: #3A4660; }
[data-brand="cswa"] .fw-topicons a .ic { background: #ECEFF4; color: #132C74; border: 1px solid #DDE2EA; }
[data-brand="cswa"] .fw-topicons a:hover { background: #F1F3F7; color: #0D1E52; }
[data-brand="cswa"] .fw-topicons a:hover .ic { background: #E1E6EE; }
[data-brand="cswa"] .fw-topicons a.on { background: linear-gradient(135deg,#1A3A8F,#0D1E52) !important; color: #FFFFFF; box-shadow: 0 8px 18px -10px rgba(13,30,82,0.7) !important; }
[data-brand="cswa"] .fw-topicons a.on .ic { background: rgba(214,220,229,0.18); color: #E6EAF0; border-color: rgba(214,220,229,0.3); }
[data-brand="cswa"] .fw-main h1 { color: #0D1E52; }
[data-brand="cswa"] .fw-main [style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main [style*="background: rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(15, 43, 37)"], [data-brand="cswa"] .fw-main [style*="background: linear-gradient"][style*="rgb(18, 53, 45)"] { background: linear-gradient(135deg,#1A3A8F 0%,#0F2462 55%,#0A1638 100%) !important; }
[data-brand="cswa"] .fw-main button[style*="background: rgb(18, 53, 45)"], [data-brand="cswa"] .fw-main button[style*="background: rgb(15, 43, 37)"] { background: linear-gradient(135deg,#1A3A8F,#0D1E52) !important; box-shadow: 0 6px 14px -8px rgba(13,30,82,0.7); }
[data-brand="cswa"] .fw-main [style*="color: rgb(154, 107, 34)"], [data-brand="cswa"] .fw-main [style*="color: rgb(201, 162, 74)"] { color: #1A3A8F !important; }
[data-brand="cswa"] .fw-main [style*="color: rgb(232, 194, 122)"], [data-brand="cswa"] .fw-main [style*="color: rgb(217, 181, 111)"] { color: #C9D2DF !important; }
[data-brand="cswa"] .fw-main [style*="background: rgb(201, 162, 74)"], [data-brand="cswa"] .fw-main [style*="background: rgb(217, 181, 111)"] { background: linear-gradient(135deg,#E6EAF0,#B9C3D2) !important; color: #0D1E52 !important; }
[data-brand="cswa"] .fw-main section, [data-brand="cswa"] .fw-main [style*="border-radius: 16px"], [data-brand="cswa"] .fw-main [style*="border-radius: 18px"] { box-shadow: 0 12px 30px -24px rgba(13,30,82,0.5); }
[data-brand="cswa"] .fw-main [style*="border: 1px solid rgb(230, 223, 208)"] { border-color: #DDE2EA !important; }
[data-brand="cswa"] .fw-tip { background: #0D1E52; border-color: rgba(214,220,229,0.35); }
/* Home in Sapphire & Platinum: a dark sapphire page, light serif heading with a rule, platinum controls */
[data-brand="cswa"][data-page="home"], [data-brand="cswa"][data-page="home"] .fw-main, [data-brand="cswa"][data-page="home"] .fw-main > div:first-child { background: radial-gradient(900px 420px at 80% -10%, #16306F 0%, rgba(22,48,111,0) 65%), #0A1433 !important; color: #EEF1F6; }
[data-brand="cswa"][data-page="home"] .fw-topicons { background: rgba(13,26,69,0.92); border-bottom-color: rgba(214,220,229,0.12); }
[data-brand="cswa"][data-page="home"] .fw-topicons a { color: #C9D2DF; }
[data-brand="cswa"][data-page="home"] .fw-topicons a .ic { background: rgba(214,220,229,0.08); color: #E6EAF0; border-color: rgba(214,220,229,0.18); }
[data-brand="cswa"][data-page="home"] .fw-topicons a:hover { background: rgba(214,220,229,0.08); color: #FFFFFF; }
[data-brand="cswa"][data-page="home"] .fw-topicons a.on { background: linear-gradient(135deg,#E6EAF0,#B9C3D2) !important; color: #0B1433 !important; }
[data-brand="cswa"][data-page="home"] .fw-topicons a.on .ic { background: rgba(11,20,51,0.08); color: #0B1433; }
[data-brand="cswa"][data-page="home"] .fw-main h1 { color: #F4F6FA !important; font-weight: 400 !important; letter-spacing: -0.01em; }
[data-brand="cswa"][data-page="home"] .fw-main h1::after { content: ""; display: block; width: 90px; height: 1px; margin-top: 18px; background: #C9D2DF; opacity: 0.7; }
[data-brand="cswa"][data-page="home"] .hd-entry { background: #10204F !important; border-color: #24356B !important; box-shadow: 0 24px 50px -30px rgba(0,0,0,0.6) !important; }
[data-brand="cswa"][data-page="home"] .hd-entry [role="tablist"] { background: #0A1433 !important; border: 1px solid #24356B; border-radius: 999px !important; }
[data-brand="cswa"][data-page="home"] .hd-entry [role="tab"] { border-radius: 999px !important; color: #C9D2DF !important; }
[data-brand="cswa"][data-page="home"] .hd-entry [role="tab"][aria-selected="true"] { background: #D6DCE5 !important; color: #0B1433 !important; }
[data-brand="cswa"][data-page="home"] .hd-entry textarea { background: #0A1433 !important; border: 1px solid #24356B !important; border-radius: 12px; padding: 12px 14px !important; color: #EEF1F6 !important; }
[data-brand="cswa"][data-page="home"] .hd-entry textarea::placeholder { color: #7D89A3; }
[data-brand="cswa"][data-page="home"] .hd-entry > div:last-child > button:last-child { background: linear-gradient(135deg,#E6EAF0,#B9C3D2) !important; color: #0B1433 !important; box-shadow: none !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="background: rgb(255, 255, 255)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="background: rgb(255, 253, 248)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="background: rgb(251, 248, 241)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="background: rgb(247, 241, 227)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="background: rgb(238, 241, 251)"] { background: #10204F !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(16, 36, 31)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(18, 53, 45)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(31, 31, 158)"] { color: #EEF1F6 !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(94, 107, 102)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(107, 117, 112)"] { color: #A3AEC2 !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(11, 122, 85)"] { color: #5FD3A3 !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="color: rgb(180, 50, 31)"] { color: #FF8A78 !important; }
[data-brand="cswa"][data-page="home"] .fw-main [style*="border: 1px solid rgb(230, 223, 208)"], [data-brand="cswa"][data-page="home"] .fw-main [style*="border-left: 1px solid rgb(239, 232, 218)"] { border-color: #24356B !important; }
[data-brand="cswa"][data-page="home"] .fw-main select, [data-brand="cswa"][data-page="home"] .fw-main input { background: #10204F !important; color: #EEF1F6 !important; border-color: #24356B !important; }
[data-brand="cswa"][data-page="home"] .fw-main [role="group"][aria-label="GST filing status"] { border-color: #24356B !important; }
@media (max-width: 760px) { [data-brand="cswa"] .fw-tabs a.on { color: #1F1F9E; } [data-brand="cswa"] .fw-tabs a.plus { background: #1F1F9E; } }
`,
};
