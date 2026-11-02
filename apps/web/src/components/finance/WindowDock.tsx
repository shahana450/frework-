"use client";
// Floating windows inside FreBook — open a ledger, report or any page beside the one you're on, like a separate
// browser window: drag by the title bar, resize from the corner, minimise to the dock, maximise, close.
// Each window is the page itself (same site, same sign-in) shown without the menus. Kept for this browser tab.
import { useEffect, useRef, useState } from "react";

export const OPEN_WINDOW_EVENT = "fw:open-window";   // detail: { href: string; title?: string }
/** Open any FreBook page in a floating window */
export const openInWindow = (href: string, title?: string) => window.dispatchEvent(new CustomEvent(OPEN_WINDOW_EVENT, { detail: { href, title } }));

type Win = { id: string; href: string; title: string; x: number; y: number; w: number; h: number; min: boolean; max: boolean; z: number };
const KEY = "fw_windows";
const C = { bar: "#12352D", gold: "#C9A24A", paper: "#FFFDF8", line: "#D9CDB2" };
const embedHref = (href: string) => href + (href.includes("?") ? "&" : "?") + "embed=1";

export default function WindowDock() {
  const [wins, setWins] = useState<Win[]>([]);
  const top = useRef(10);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    try { const w = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Win[]; setWins(w); top.current = Math.max(10, ...w.map(x => x.z)); } catch { /* none */ }
    const on = (e: Event) => {
      const { href, title } = (e as CustomEvent).detail as { href: string; title?: string };
      setWins(ws => {
        const have = ws.find(w => w.href === href);
        if (have) return ws.map(w => w.id === have.id ? { ...w, min: false, z: ++top.current } : w);
        const n = ws.length, vw = window.innerWidth, vh = window.innerHeight;
        const w = Math.min(900, vw - 40), h = Math.min(620, vh - 120);
        return [...ws, { id: Math.random().toString(36).slice(2), href, title: title || href.replace(/^\/finance\/?/, "").split(/[?#]/)[0] || "Home",
          x: Math.max(10, Math.min(vw - w - 10, 80 + n * 28)), y: Math.max(10, Math.min(vh - h - 70, 70 + n * 28)), w, h, min: false, max: false, z: ++top.current }];
      });
    };
    window.addEventListener(OPEN_WINDOW_EVENT, on);
    return () => window.removeEventListener(OPEN_WINDOW_EVENT, on);
  }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(wins)); } catch { /* */ } }, [wins]);

  useEffect(() => {
    const move = (e: PointerEvent) => { const d = drag.current; if (!d) return; setWins(ws => ws.map(w => w.id === d.id ? { ...w, x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - d.dx)), y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - d.dy)) } : w)); };
    const up = () => { drag.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const set = (id: string, p: Partial<Win>) => setWins(ws => ws.map(w => w.id === id ? { ...w, ...p } : w));
  const focus = (id: string) => set(id, { z: ++top.current });
  const close = (id: string) => setWins(ws => ws.filter(w => w.id !== id));
  if (!wins.length) return null;

  const icon = (d: string) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d={d} /></svg>;
  const tbtn: React.CSSProperties = { width: 28, height: 26, border: "none", borderRadius: 7, background: "transparent", color: "#E8E2D2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <>
      {wins.filter(w => !w.min).map(w => {
        const box: React.CSSProperties = w.max ? { left: 8, top: 8, width: "calc(100vw - 16px)", height: "calc(100vh - 64px)" } : { left: w.x, top: w.y, width: w.w, height: w.h };
        return (
          <section key={w.id} role="dialog" aria-label={w.title} onPointerDown={() => focus(w.id)}
            ref={el => { if (el && !w.max) { el.onmouseup = () => { const r = el.getBoundingClientRect(); if (Math.abs(r.width - w.w) > 2 || Math.abs(r.height - w.h) > 2) set(w.id, { w: r.width, h: r.height }); }; } }}
            style={{ position: "fixed", ...box, zIndex: 8000 + w.z, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 30px 70px -30px rgba(15,43,37,0.6)", display: "flex", flexDirection: "column", overflow: "hidden", resize: w.max ? "none" : "both", minWidth: 320, minHeight: 200 }}>
            <header onPointerDown={e => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { id: w.id, dx: e.clientX - w.x, dy: e.clientY - w.y }; document.body.style.userSelect = "none"; }}
              onDoubleClick={() => set(w.id, { max: !w.max })}
              style={{ height: 36, flexShrink: 0, background: C.bar, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 6, padding: "0 6px 0 12px", cursor: w.max ? "default" : "move", userSelect: "none" }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold }} />
              <b style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>{w.title}</b>
              <button type="button" title="Open as a full page" aria-label="Open as a full page" style={tbtn} onClick={() => { close(w.id); window.location.href = w.href; }}>{icon("M14 4h6v6M20 4l-8 8M10 6H5v13h13v-5")}</button>
              <button type="button" title="Minimise" aria-label="Minimise" style={tbtn} onClick={() => set(w.id, { min: true })}>{icon("M6 18h12")}</button>
              <button type="button" title={w.max ? "Restore" : "Maximise"} aria-label={w.max ? "Restore" : "Maximise"} style={tbtn} onClick={() => set(w.id, { max: !w.max })}>{icon(w.max ? "M8 8h10v10H8zM6 16V6h10" : "M5 5h14v14H5z")}</button>
              <button type="button" title="Close" aria-label="Close" style={tbtn} onClick={() => close(w.id)}>{icon("M6 6l12 12M18 6L6 18")}</button>
            </header>
            {/* While dragging, the page underneath must not swallow the pointer */}
            <iframe src={embedHref(w.href)} title={w.title} style={{ flex: 1, border: "none", width: "100%", background: C.paper, pointerEvents: drag.current ? "none" : "auto" }} />
          </section>
        );
      })}
      {/* The dock: every window, minimised or not — click to bring it back */}
      <nav aria-label="Open windows" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 10, zIndex: 8999, display: "flex", gap: 6, padding: 6, borderRadius: 14, background: "rgba(18,53,45,0.94)", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)", maxWidth: "calc(100vw - 24px)", overflowX: "auto" }}>
        {wins.map(w => (
          <span key={w.id} style={{ display: "inline-flex", alignItems: "center", borderRadius: 10, background: w.min ? "transparent" : "rgba(201,162,74,0.22)", border: "1px solid rgba(255,255,255,0.16)" }}>
            <button type="button" onClick={() => set(w.id, w.min ? { min: false, z: ++top.current } : { min: true })} title={w.min ? "Show" : "Minimise"}
              style={{ height: 32, padding: "0 10px", border: "none", background: "transparent", color: "#FFFFFF", cursor: "pointer", fontSize: 12.5, fontWeight: 700, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>{w.title}</button>
            <button type="button" onClick={() => close(w.id)} aria-label={`Close ${w.title}`} style={{ ...tbtn, width: 24 }}>{icon("M7 7l10 10M17 7L7 17")}</button>
          </span>
        ))}
      </nav>
    </>
  );
}
