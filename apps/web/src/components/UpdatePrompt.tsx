"use client";
import { useEffect, useState } from "react";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const EVERY = 5 * 60 * 1000;

// Shows "A new version is ready — Update" when we deploy while the app is open.
// Checks on start, every 5 minutes, and whenever the app comes back to the foreground.
export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (MINE === "dev") return;
    let alive = true, last = 0;
    const check = async () => {
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build } = await r.json();
        if (alive && build && build !== "dev" && build !== MINE) setReady(true);
      } catch { /* offline — try again later */ }
    };
    check();
    const id = setInterval(check, EVERY);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  if (!ready || hidden) return null;
  return (
    <div role="status" style={{ position: "fixed", left: "50%", bottom: "calc(96px + env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 1000, width: "min(440px, calc(100vw - 32px))", background: "#232A63", color: "#FFFFFF", borderRadius: 16, padding: "12px 12px 12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 18px 40px -14px rgba(20,26,58,0.6)", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}><b>A new version of FreBook is ready.</b><br /><span style={{ color: "#C8D2F2", fontSize: 12.5 }}>Update to get the latest changes — your books are safe.</span></span>
      <button onClick={() => setHidden(true)} style={{ background: "transparent", border: "none", color: "#C8D2F2", fontSize: 13, cursor: "pointer", padding: "8px 6px" }}>Later</button>
      <button onClick={() => window.location.reload()} style={{ height: 40, padding: "0 16px", borderRadius: 11, border: "none", background: "#FFFFFF", color: "#232A63", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Update</button>
    </div>
  );
}
