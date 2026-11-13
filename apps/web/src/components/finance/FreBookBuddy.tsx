"use client";
// FreBook, the virtual accountant, floating on every finance page: gently bobs, glows, says hello now and then.
// Tap → FreBook chat. Hidden on FreBook itself; "×" tucks him away for this tab.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LINES = ["Hi! Tell me what happened — I'll book it.", "Got a bill? Drop it on me.", "Ask me: How much do customers owe?", "Need GSTR-1? Just ask."];

export default function FreBookBuddy() {
  const path = usePathname() ?? "";
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [say, setSay] = useState<string | null>(null);

  useEffect(() => { try { setHidden(sessionStorage.getItem("fb-buddy-off") === "1"); } catch { setHidden(false); } }, []);
  // A short hello a few seconds after each page opens, then quiet
  useEffect(() => {
    setSay(null);
    const t1 = setTimeout(() => setSay(LINES[Math.floor(Math.random() * LINES.length)]), 2500);
    const t2 = setTimeout(() => setSay(null), 8500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [path]);

  if (hidden || path.startsWith("/finance/chat-book")) return null;
  return (
    <div className="fbb" onMouseEnter={() => setSay("Hi! I'm FreBook, your virtual accountant. Tap to chat.")} onMouseLeave={() => setSay(null)}>
      <style>{`
        .fbb{position:fixed;right:22px;bottom:22px;z-index:150;display:flex;align-items:flex-end;gap:10px;pointer-events:none}
        .fbb>*{pointer-events:auto}
        .fbb-btn{position:relative;width:68px;height:68px;border-radius:50%;border:0;padding:0;cursor:pointer;background:#0B1F1A;animation:fbbBob 3.2s ease-in-out infinite}
        .fbb-btn img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;animation:fbbTilt 6s ease-in-out infinite}
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
        @media (max-width:760px){.fbb{bottom:96px;right:14px}.fbb-btn{width:56px;height:56px}.fbb-say{max-width:190px;margin-bottom:28px}}
        @media (prefers-reduced-motion:reduce){.fbb-btn,.fbb-btn img,.fbb-btn::before,.fbb-say{animation:none}}
        @media print{.fbb{display:none}}
      `}</style>
      {say && <div className="fbb-say" role="status">{say}</div>}
      <div style={{ position: "relative" }}>
        <button className="fbb-btn" aria-label="Open FreBook, your virtual accountant" onClick={() => router.push("/finance/chat-book")}>
          <img src="/frebook-face.jpg" alt="" width={68} height={68} />
        </button>
        <button className="fbb-x" aria-label="Hide FreBook for now" onClick={() => { setHidden(true); try { sessionStorage.setItem("fb-buddy-off", "1"); } catch {} }}>×</button>
      </div>
    </div>
  );
}
