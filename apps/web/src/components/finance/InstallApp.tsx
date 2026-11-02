"use client";
// "Install FreBook" — FreBook as an app on the phone or computer (home-screen icon, opens in its own window).
// Chrome / Edge / Android: the browser's install prompt. iPhone / iPad: Share → Add to Home Screen (Safari has no prompt).
// Hidden once installed, or for 30 days after "Not now".
import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const SNOOZE = "fw_install_snooze";

export default function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Every finance page points at the FreBook app manifest
    if (!document.querySelector('link[rel="manifest"][href="/frebook.webmanifest"]')) {
      document.querySelectorAll('link[rel="manifest"]').forEach(l => l.remove());
      const l = document.createElement("link"); l.rel = "manifest"; l.href = "/frebook.webmanifest"; document.head.appendChild(l);
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let snoozed = false;
    try { snoozed = Date.now() - Number(localStorage.getItem(SNOOZE) ?? 0) < 30 * 86400000; } catch { /* */ }
    if (standalone || snoozed || window.self !== window.top) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setShow(true); return; }
    const on = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); setShow(true); };
    const done = () => setShow(false);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (!show) return null;
  const snooze = () => { try { localStorage.setItem(SNOOZE, String(Date.now())); } catch { /* */ } setShow(false); };
  const install = async () => { if (!evt) return; await evt.prompt(); const c = await evt.userChoice.catch(() => null); if (c?.outcome === "accepted") setShow(false); setEvt(null); };

  return (
    <div role="region" aria-label="Install FreBook" style={{ position: "fixed", right: 16, bottom: 16, zIndex: 7000, maxWidth: 340, background: "#12352D", color: "#FFFFFF", borderRadius: 16, padding: "14px 16px", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
      <b style={{ fontSize: 15 }}>Install FreBook</b>
      <span style={{ color: "#C9D3CE", lineHeight: 1.45 }}>
        {ios ? <>Tap <b style={{ color: "#FFFFFF" }}>Share</b> <span aria-hidden="true">⬆︎</span>, then <b style={{ color: "#FFFFFF" }}>Add to Home Screen</b> — FreBook opens like an app.</> : "An icon on your phone or desktop; FreBook opens in its own window, like an app."}
      </span>
      <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={snooze} style={{ height: 34, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#FFFFFF", cursor: "pointer", fontFamily: "inherit" }}>Not now</button>
        {!ios && <button type="button" onClick={install} style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "none", background: "#C9A24A", color: "#10241F", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Install</button>}
      </span>
    </div>
  );
}
