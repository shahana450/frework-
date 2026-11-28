"use client";
// Tax & finance news running along the top of Home, like the website's ticker but in FreBook's green and gold.
// Headlines come from /api/tax-news (the same feed as the website); a few due-date reminders show until it loads.
// Scrolls continuously, pauses on hover / focus, stops for people who prefer reduced motion.
import { useEffect, useState } from "react";

type News = { id: string; category: string; title: string; url: string };
const FALLBACK: News[] = [
  { id: "f1", category: "GST", title: "GSTR-3B due on the 20th for monthly filers — match ITC with GSTR-2B before filing", url: "" },
  { id: "f2", category: "GST", title: "GSTR-1 due on the 11th (monthly) — IFF by the 13th for QRMP filers", url: "" },
  { id: "f3", category: "Income Tax", title: "TDS payment for the month is due by the 7th of the next month", url: "" },
  { id: "f4", category: "Compliance", title: "MSME suppliers: pay within 45 days or the expense is disallowed under section 43B(h)", url: "" },
  { id: "f5", category: "GST", title: "E-invoicing mandatory for B2B invoices above ₹5 crore turnover — IRN from the IRP", url: "" },
];
const DOT: Record<string, string> = { GST: "#8FE3C0", "Income Tax": "#E9C27A", Compliance: "#F3B8A6", General: "#C9D3CE" };

export default function NewsTicker() {
  const [items, setItems] = useState<News[]>(FALLBACK);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("fw_news_off") === "1") setHidden(true); } catch { /* */ }
    fetch("/api/tax-news").then(r => r.ok ? r.json() : null).then((d: { items?: News[] } | null) => {
      const list = (d?.items ?? []).filter(i => i.title).slice(0, 14).map(i => ({ ...i, title: i.title.replace(/\s[-–]\s[^-–]{2,40}$/, "") }));
      if (list.length) setItems(list);
    }).catch(() => null);
  }, []);
  if (hidden) return null;
  // The list twice, so the loop joins without a gap
  const run = [...items, ...items];
  return (
    <div className="nt" role="region" aria-label="Tax and finance news">
      <style>{CSS}</style>
      <span className="nt-tag"><span className="nt-live" aria-hidden="true" />Live <b>· Tax & finance news</b></span>
      <div className="nt-win">
        <div className="nt-track" style={{ animationDuration: `${Math.max(40, items.length * 9)}s` }}>
          {run.map((n, i) => {
            const inner = <><span className="nt-cat" style={{ color: DOT[n.category] ?? DOT.General }}>{n.category}</span><span>{n.title}</span></>;
            return n.url
              ? <a key={`${n.id}-${i}`} href={n.url} target="_blank" rel="noopener noreferrer" className="nt-item" aria-hidden={i >= items.length || undefined} tabIndex={i >= items.length ? -1 : undefined}>{inner}<span className="nt-ext" aria-hidden="true">↗</span></a>
              : <span key={`${n.id}-${i}`} className="nt-item" aria-hidden={i >= items.length || undefined}>{inner}</span>;
          })}
        </div>
      </div>
      <button className="nt-x" aria-label="Hide news for now" onClick={() => { setHidden(true); try { sessionStorage.setItem("fw_news_off", "1"); } catch { /* */ } }}>×</button>
    </div>
  );
}

const CSS = `
.nt{position:relative;display:flex;align-items:center;gap:0;height:46px;border-radius:16px;overflow:hidden;background:linear-gradient(100deg,#0B231D 0%,#12352D 55%,#1A3F35 100%);border:1px solid rgba(233,194,122,.28);box-shadow:0 14px 30px -22px rgba(6,26,22,.8);color:#EEF2F0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.nt::before{content:"";position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,transparent,#C9A24A 30%,#F0D392 50%,#C9A24A 70%,transparent)}
.nt-tag{flex-shrink:0;display:flex;align-items:center;gap:8px;height:100%;padding:0 16px 0 14px;background:linear-gradient(150deg,#F0D392,#C9A24A);color:#10241F;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);padding-right:26px}
.nt-tag b{font-weight:700;letter-spacing:.06em;text-transform:none;font-size:13px}
.nt-live{width:8px;height:8px;border-radius:50%;background:#B4321F;box-shadow:0 0 0 0 rgba(180,50,31,.6);animation:ntPulse 1.6s ease-out infinite}
.nt-win{flex:1;min-width:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 94%,transparent)}
.nt-track{display:inline-flex;align-items:center;gap:40px;white-space:nowrap;padding-left:20px;animation:ntRun linear infinite}
.nt:hover .nt-track,.nt:focus-within .nt-track{animation-play-state:paused}
.nt-item{display:inline-flex;align-items:center;gap:10px;font-size:14.5px;color:#EEF2F0;text-decoration:none}
a.nt-item:hover{color:#F0D392}
.nt-cat{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.nt-item+.nt-item::before{content:"◆";color:rgba(233,194,122,.55);font-size:9px;margin-right:30px}
.nt-ext{color:#C9A24A;font-size:12px}
.nt-x{flex-shrink:0;width:38px;height:100%;border:none;background:transparent;color:#8FA39B;font-size:20px;cursor:pointer}
.nt-x:hover{color:#FFFFFF}
.nt a:focus-visible,.nt button:focus-visible{outline:2px solid #F0D392;outline-offset:-2px}
@keyframes ntRun{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes ntPulse{0%{box-shadow:0 0 0 0 rgba(180,50,31,.6)}70%{box-shadow:0 0 0 8px rgba(180,50,31,0)}100%{box-shadow:0 0 0 0 rgba(180,50,31,0)}}
@media (max-width:640px){.nt{height:42px;border-radius:14px}.nt-tag b{display:none}.nt-tag{padding:0 22px 0 12px}.nt-item{font-size:13.5px}}
@media (prefers-reduced-motion:reduce){.nt-track{animation:none}.nt-win{overflow-x:auto}.nt-live{animation:none}}
`;
