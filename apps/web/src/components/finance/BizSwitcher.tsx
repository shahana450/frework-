"use client";
// The sidebar's Active Business box as a drop-down: search and switch business without leaving the page you're on.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { setActiveBusiness, confirmBusinessSwitch, getActiveBusiness } from "@/lib/activeBusiness";

type Biz = { id: string; name: string; role?: string };

export default function BizSwitcher({ bizName }: { bizName: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Biz[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const activeId = getActiveBusiness().businessId;

  // Load the businesses the first time it opens
  useEffect(() => {
    if (!open || list) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/finance/businesses", { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } }).then(x => x.ok ? x.json() : null).catch(() => null) as { businesses: Biz[]; test: Biz[] } | null;
      setList(r ? [...r.businesses, ...r.test] : []);
    })();
  }, [open, list]);

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  async function pick(b: Biz) {
    if (b.id === activeId) { setOpen(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!(await confirmBusinessSwitch(user.id, b.id, b.name))) return;
    setBusy(b.id);
    setActiveBusiness(user.id, b.id, b.name);
    location.assign("/finance");   // a full load, so no page keeps the old business
  }

  const shown = (list ?? []).filter(b => b.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div ref={box} style={{ position: "relative", marginBottom: 6 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} title="Switch business"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textAlign: "left", background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(217,181,111,0.3)", borderRadius: 8, padding: "5px 8px", fontFamily: "inherit" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{bizName}</span>
        <span aria-hidden="true" style={{ fontSize: "0.65rem", color: "#D9B56F", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Your businesses" style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", width: 260, zIndex: 300, background: "#FFFDF8", border: "1px solid #E6DFD0", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,43,37,0.55)", overflow: "hidden", color: "#10241F" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #EFE8DA" }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search business…" aria-label="Search business"
              onKeyDown={e => { if (e.key === "Enter" && shown.length === 1) pick(shown[0]); }}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #E6DFD0", fontSize: 13, outline: "none", background: "#FFFFFF", color: "#10241F", fontFamily: "inherit" }} />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", padding: 4 }}>
            {!list && <div style={{ padding: 12, fontSize: 13, color: "#6B7570" }}>Loading…</div>}
            {list && !shown.length && <div style={{ padding: 12, fontSize: 13, color: "#6B7570" }}>No business matches “{q}”.</div>}
            {shown.map(b => {
              const on = b.id === activeId;
              return (
                <button key={b.id} type="button" role="option" aria-selected={on} onClick={() => pick(b)} disabled={!!busy}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13, background: on ? "#E3F3EC" : "transparent", color: "#10241F" }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = "#F3ECDD"; }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center", background: "#12352D", color: "#E8C27A", fontWeight: 800, fontSize: 11 }}>{b.name.trim()[0]?.toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: on ? 800 : 600 }}>{b.name}</span>
                  {busy === b.id ? <span style={{ fontSize: 11, color: "#6B7570" }}>Opening…</span> : on ? <span style={{ fontSize: 12, color: "#0B7A55", fontWeight: 800 }}>✓</span> : b.role && b.role !== "owner" ? <span style={{ fontSize: 10.5, color: "#6B7570" }}>{b.role}</span> : null}
                </button>
              );
            })}
          </div>
          <Link href="/finance/select-business" onClick={() => setOpen(false)} style={{ display: "block", padding: "9px 12px", borderTop: "1px solid #EFE8DA", fontSize: 12.5, fontWeight: 800, color: "#12352D", textDecoration: "none", background: "#FBF8F1" }}>All businesses →</Link>
        </div>
      )}
    </div>
  );
}
