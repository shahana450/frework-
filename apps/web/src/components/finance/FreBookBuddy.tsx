"use client";
// FreBook, the virtual accountant, floating on every finance page: gently bobs, glows, says hello now and then.
// Drag him anywhere with the mouse (or a finger) — the spot is remembered. Tap → FreBook chat. Hidden on FreBook itself
// and inside FreBook windows (the main page already shows him); "×" tucks him away for this tab.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LINES = ["Hi! Tell me what happened — I'll book it.", "Got a bill? Drop it on me.", "Ask me: How much do customers owe?", "Need GSTR-1? Just ask."];
const POS_KEY = "fb-buddy-pos";
type Pos = { x: number; y: number };   // distance from the right and bottom edges, px

export default function FreBookBuddy() {
  const path = usePathname() ?? "";
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [say, setSay] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    let inFrame = false; try { inFrame = window.self !== window.top; } catch { inFrame = true; }
    try { setHidden(inFrame || sessionStorage.getItem("fb-buddy-off") === "1"); } catch { setHidden(inFrame); }
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Pos | null; if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) setPos(clamp(p)); } catch { /* */ }
    const onResize = () => setPos(p => p ? clamp(p) : p);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // A short hello a few seconds after each page opens, then quiet
  useEffect(() => {
    setSay(null);
    let greeted = false; try { greeted = sessionStorage.getItem("fb-buddy-hi") === "1"; } catch { /* */ }
    if (greeted) return;   // one hello per session — then he stays quiet unless hovered
    const t1 = setTimeout(() => { setSay(LINES[Math.floor(Math.random() * LINES.length)]); try { sessionStorage.setItem("fb-buddy-hi", "1"); } catch { /* */ } }, 2500);
    const t2 = setTimeout(() => setSay(null), 8500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [path]);

  function clamp(p: Pos): Pos {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200, h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { x: Math.min(Math.max(p.x, 6), w - 80), y: Math.min(Math.max(p.y, 6), h - 80) };
  }
  function down(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: window.innerWidth - r.right, oy: window.innerHeight - r.bottom, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true; setSay(null);
    setPos(clamp({ x: d.ox - dx, y: d.oy - dy }));
  }
  function up() {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) { setPos(p => { if (p) try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* */ } return p; }); return; }
    window.location.assign("/finance/chat-book");
  }

  if (hidden || path.startsWith("/finance/chat-book")) return null;
  return (
    <div className="fbb" style={pos ? { right: pos.x, bottom: pos.y } : undefined} onMouseEnter={() => !drag.current && setSay("Hi! I'm FreBook AI, your AI accountant. Tap to chat, or drag me anywhere.")} onMouseLeave={() => setSay(null)}>
      <style>{`
        .fbb{position:fixed;right:22px;bottom:22px;z-index:150;display:flex;align-items:flex-end;gap:10px;pointer-events:none}
        .fbb>*{pointer-events:auto}
        .fbb-btn{position:relative;width:68px;height:68px;border-radius:50%;border:0;padding:0;cursor:grab;touch-action:none;background:#0B1F1A;animation:fbbBob 3.2s ease-in-out infinite}
        .fbb-btn:active{cursor:grabbing}
        .fbb-btn img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;animation:fbbTilt 6s ease-in-out infinite;pointer-events:none;-webkit-user-drag:none;user-select:none}
        .fbb-btn::before{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #5DCAA5;animation:fbbGlow 2.4s ease-in-out infinite}
        .fbb-btn::after{content:"";position:absolute;right:2px;bottom:4px;width:13px;height:13px;border-radius:50%;background:#1D9E75;border:2px solid #FFFFFF}
        .fbb-btn:focus-visible{outline:3px solid #C99A4E;outline-offset:4px}
        .fbb-say{max-width:230px;background:#FFFFFF;color:#10241F;border:1px solid #E6DFD0;border-radius:16px 16px 4px 16px;padding:9px 13px;font-size:13px;line-height:1.4;box-shadow:0 12px 30px -14px rgba(15,43,37,.45);margin-bottom:34px;animation:fbbPop .25s ease-out}
        .fbb-x{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:1px solid #E6DFD0;background:#FFFFFF;color:#5E6B66;font-size:12px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s}
        .fbb:hover .fbb-x,.fbb-x:focus-visible{opacity:1}
        @keyframes fbbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes fbbTilt{0%,80%,100%{transform:rotate(0)}85%{transform:rotate(-7deg)}90%{transform:rotate(6deg)}95%{transform:rotate(-3deg)}}
        @keyframes fbbGlow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes fbbPop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}
        @media (max-width:760px){.fbb:not([style]){bottom:96px;right:14px}.fbb-btn{width:56px;height:56px}.fbb-say{max-width:190px;margin-bottom:28px}}
        @media (prefers-reduced-motion:reduce){.fbb-btn,.fbb-btn img,.fbb-btn::before,.fbb-say{animation:none}}
        @media print{.fbb{display:none}}
      `}</style>
      {say && <div className="fbb-say" role="status">{say}</div>}
      <div style={{ position: "relative" }}>
        <button className="fbb-btn" aria-label="Open FreBook AI, your AI accountant (drag to move)"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.assign("/finance/chat-book"); } }}>
          <img src="/frebook-face.jpg" alt="" width={68} height={68} draggable={false} />
        </button>
        <button className="fbb-x" aria-label="Hide FreBook AI for now" onClick={() => { setHidden(true); try { sessionStorage.setItem("fb-buddy-off", "1"); } catch {} }}>×</button>
      </div>
    </div>
  );
}
