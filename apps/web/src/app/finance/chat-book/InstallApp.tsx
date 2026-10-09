"use client";
import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const APP_URL = "https://frework.online/frebook";

// "Phone app" for FreBook: install here when the browser allows it, and always show how to get it on a phone.
export default function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone) return null; // already running as the app

  const copy = async () => { try { await navigator.clipboard.writeText(APP_URL); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const row: React.CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.8rem", lineHeight: 1.5, color: "#141A3A" };

  return (
    <span style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ background: "#C99A4E", color: "#0F2B25", border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 700, fontSize: "0.76rem", cursor: "pointer", whiteSpace: "nowrap" }}>
        📱 Phone app
      </button>
      {open && (
        <span style={{ position: "absolute", right: 0, top: "120%", zIndex: 50, width: 300, background: "#FFFFFF", border: "1px solid #C9CEDF", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 18px 40px -18px rgba(20,26,58,0.35)" }}>
          <strong style={{ fontSize: "0.9rem", color: "#141A3A" }}>Get FreBook on your phone</strong>
          <span style={{ display: "flex", gap: 6 }}>
            <code style={{ flex: 1, background: "#F5F6FA", border: "1px solid #E1E4EE", borderRadius: 8, padding: "7px 9px", fontSize: "0.78rem", color: "#232A63" }}>frework.online/frebook</code>
            <button onClick={copy} style={{ border: "1px solid #C9CEDF", background: "#FFFFFF", borderRadius: 8, padding: "0 10px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", color: "#141A3A" }}>{copied ? "Copied" : "Copy"}</button>
          </span>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Open FreBook on my phone: ${APP_URL}`)}`} target="_blank" rel="noopener noreferrer" style={{ height: 38, borderRadius: 9, background: "#0B7A55", color: "#FFFFFF", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Send the link to my WhatsApp</a>
          <span style={row}><b>Android</b><span>Open the link in Chrome → ⋮ menu → <b>Install app</b>.</span></span>
          <span style={row}><b>iPhone</b><span>Open it in Safari → Share ⬆ → <b>Add to Home Screen</b>.</span></span>
          {evt
            ? <button onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }} style={{ height: 38, borderRadius: 9, border: "1px solid #232A63", background: "#FFFFFF", color: "#232A63", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>Install on this computer</button>
            : <span style={{ fontSize: "0.74rem", color: "#5A6080" }}>On this computer it&apos;s already installed or not supported — look for <b>Open in app</b> in the address bar.</span>}
        </span>
      )}
    </span>
  );
}
