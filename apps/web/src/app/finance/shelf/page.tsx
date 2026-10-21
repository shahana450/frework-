"use client";
import GstPortalDownload from "@/components/finance/GstPortalDownload";
import ItPortalFetch from "@/components/finance/ItPortalFetch";
import { cur, activeMoney, activeCountry } from "@/lib/money";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RACKS, type RackKey } from "@/lib/shelf";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Item = {
  id: string; rack: RackKey; fy: string | null; period: string | null; title: string; doc_type: string | null; file_name: string | null; mime: string | null;
  size_bytes: number | null; source: string; reference: string | null; authority: string | null; reply_due: string | null; amount: number | null;
  status: string; notes: string | null; ai_summary: string | null; created_at: string;
};

const C = { bg: "#F5F6FA", surface: "#FFFFFF", line: "#E1E4EE", strong: "#C9CEDF", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", soft: "#E6E8F4", gold: "#C9A24A", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const ICON: Record<RackKey, string> = { gst: "🧾", income_tax: "🏛", tds: "🔖", notices: "📮", bank: "🏦", bills: "📄", payroll: "👥", registrations: "📜", others: "🗂" };
// Each rack has its own colour: icon tile, active card and count badge
const TINT: Record<RackKey | "all", { c: string; b: string }> = {
  all: { c: "#232A63", b: "#E6E8F4" }, gst: { c: "#0B7A55", b: "#E3F6EE" }, income_tax: { c: "#1F5EFF", b: "#EAF2FF" }, tds: { c: "#C2410C", b: "#FFF1E8" },
  notices: { c: "#C2321F", b: "#FDECEA" }, bank: { c: "#0E7490", b: "#E0F5F9" }, bills: { c: "#7C3AED", b: "#F1EBFE" }, payroll: { c: "#B45309", b: "#FEF3E2" },
  registrations: { c: "#8A5A00", b: "#FFF4DB" }, others: { c: "#5A6080", b: "#EEF0F5" },
};
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const SOURCE: Record<string, string> = { upload: "Uploaded", frebook: "From FreBook", statement: "Bank statement", gstr1: "Auto-filed", system: "Auto-filed" };
const kb = (n: number | null) => !n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const day = (d: string) => new Date(d.length > 10 ? d : d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA");

export default function ShelfPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [setup, setSetup] = useState("");
  const [rack, setRack] = useState<RackKey | "all">("all");
  const [fy, setFy] = useState("all");
  const [q, setQ] = useState("");
  const [uploads, setUploads] = useState<{ name: string; state: "filing" | "done" | "error"; text: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploadRack, setUploadRack] = useState<RackKey | "auto">("auto");
  const [editing, setEditing] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "old" | "az" | "size">("new");
  const [ftype, setFtype] = useState<"all" | "PDF" | "XLS" | "IMG">("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (biz: string) => {
    const r = await fetch(`/api/finance/shelf?business_id=${biz}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setSetup(d.error ?? "Couldn't open the shelf."); setItems([]); return; }
    setSetup(d.setup_needed ?? ""); setItems(d.items ?? []);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("rack"); if (r && RACKS.some(x => x.key === r)) setRack(r as RackKey);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz); load(biz);
    });
  }, [router, load]);

  async function upload(files: FileList | File[]) {
    const list = [...files].slice(0, 20);
    for (const f of list) {
      setUploads(u => [{ name: f.name, state: "filing", text: uploadRack === "auto" ? "Reading and filing…" : "Saving…" }, ...u]);
      const fd = new FormData(); fd.append("business_id", bizId); fd.append("file", f); fd.append("rack", uploadRack);
      const r = await fetch("/api/finance/shelf", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      const rackLabel = RACKS.find(x => x.key === d.rack)?.label ?? "Others";
      setUploads(u => u.map(x => x.name === f.name && x.state === "filing" ? (r.ok
        ? { name: f.name, state: "done", text: `Filed in ${rackLabel}${d.fy ? ` · FY ${d.fy}` : ""} as “${d.title}”${d.reply_due ? ` · reply by ${day(d.reply_due)}` : ""}` }
        : { name: f.name, state: "error", text: d.error ?? "Couldn't save." }) : x));
    }
    load(bizId);
  }

  async function patch(id: string, p: Partial<Item>) {
    setItems(list => list?.map(i => i.id === id ? { ...i, ...p } : i) ?? null);
    await fetch("/api/finance/shelf", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, id, ...p }) });
  }
  async function remove(it: Item) {
    if (!window.confirm(`Remove “${it.title}” from the shelf?`)) return;
    await fetch(`/api/finance/shelf?business_id=${bizId}&id=${it.id}`, { method: "DELETE" });
    setItems(list => list?.filter(i => i.id !== it.id) ?? null);
  }
  async function open(it: Item, download = false) {
    const w = download ? null : window.open("", "_blank");
    const r = await fetch(`/api/finance/shelf?business_id=${bizId}&download=${it.id}${download ? "" : "&inline=1"}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { w?.close(); alert(d.error ?? "Couldn't open the file."); return; }
    if (w) w.location.href = d.url; else window.location.href = d.url;
  }

  const fys = useMemo(() => [...new Set((items ?? []).map(i => i.fy).filter(Boolean) as string[])].sort().reverse(), [items]);
  const counts = useMemo(() => Object.fromEntries(RACKS.map(r => [r.key, (items ?? []).filter(i => i.rack === r.key && (fy === "all" || i.fy === fy)).length])), [items, fy]);
  const openNotices = (items ?? []).filter(i => i.rack === "notices" && i.status === "open");
  const typeOf = (i: Item) => { const n = (i.file_name ?? i.mime ?? "").toLowerCase(); return /pdf/.test(n) ? "PDF" : /xls|csv|sheet/.test(n) ? "XLS" : /png|jpe?g|webp|heic|image/.test(n) ? "IMG" : "OTHER"; };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (items ?? []).filter(i => (rack === "all" || i.rack === rack) && (fy === "all" || i.fy === fy) && (ftype === "all" || typeOf(i) === ftype)
      && (!s || [i.title, i.doc_type, i.period, i.reference, i.authority, i.file_name, i.ai_summary, i.notes].some(x => x?.toLowerCase().includes(s))));
    const by = { new: (a: Item, b: Item) => b.created_at.localeCompare(a.created_at), old: (a: Item, b: Item) => a.created_at.localeCompare(b.created_at),
      az: (a: Item, b: Item) => a.title.localeCompare(b.title), size: (a: Item, b: Item) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0) }[sort];
    return [...list].sort(by);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rack, fy, q, ftype, sort]);
  // GST return calendar for one financial year: which months have GSTR-1 / 3B / 2B on the shelf
  const calFy = fy !== "all" ? fy : (fys[0] ?? null);
  const calendar = useMemo(() => {
    if (!calFy) return null;
    const y0 = Number(calFy.slice(0, 4)); if (!y0) return null;
    const months = MONTHS.map((m, i) => ({ label: m, ym: `${i < 9 ? y0 : y0 + 1}-${String(((i + 3) % 12) + 1).padStart(2, "0")}` }));
    const has = (form: RegExp, ym: string) => (items ?? []).some(i => i.rack === "gst" && i.period?.startsWith(ym) && form.test(`${i.doc_type ?? ""} ${i.title}`));
    return { months, rows: [["GSTR-1", /GSTR-?1(?!\d)/i], ["GSTR-3B", /GSTR-?3B/i], ["GSTR-2B", /GSTR-?2B/i]].map(([label, re]) => ({ label: label as string, cells: months.map(m => has(re as RegExp, m.ym)) })) };
  }, [items, calFy]);
  const totalBytes = (items ?? []).reduce((s, i) => s + (i.size_bytes ?? 0), 0);
  const lastAdded = (items ?? []).reduce<string | null>((m, i) => (!m || i.created_at > m ? i.created_at : m), null);

  const chip = (on: boolean): React.CSSProperties => ({ height: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? C.primary : C.line}`, background: on ? C.primary : C.surface, color: on ? "#FFFFFF" : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" });
  const btn: React.CSSProperties = { height: 32, padding: "0 11px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.surface, color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" };

  // Indian tax racks only for Indian businesses
  const india = activeCountry() === "IN";
  const racks = RACKS.filter(r => india || !["gst", "income_tax", "tds"].includes(r.key));
  const inYear = (items ?? []).filter(i => fy === "all" || i.fy === fy);
  const soon = openNotices.filter(n => n.reply_due && n.reply_due >= today() && n.reply_due <= new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA"));
  const overdueN = openNotices.filter(n => n.reply_due && n.reply_due < today());
  const thisMonth = (items ?? []).filter(i => i.created_at.slice(0, 7) === today().slice(0, 7)).length;
  const kind = (it: Item) => {
    const n = (it.file_name ?? it.mime ?? "").toLowerCase();
    if (/pdf/.test(n)) return { t: "PDF", c: "#C2321F", b: "#FDECEA" };
    if (/png|jpe?g|webp|heic|image/.test(n)) return { t: "IMG", c: "#1F5EFF", b: "#EAF2FF" };
    if (/xls|csv|sheet/.test(n)) return { t: "XLS", c: "#0B7A55", b: "#E3F6EE" };
    if (/doc|word/.test(n)) return { t: "DOC", c: "#3B4BC4", b: "#ECEEFB" };
    if (/zip/.test(n)) return { t: "ZIP", c: "#8A5A00", b: "#FFF4DB" };
    return { t: "FILE", c: C.muted, b: C.soft };
  };

  const rackList = [{ key: "all" as const, label: "Whole shelf", hint: "Everything" }, ...racks];
  const current = rackList.find(r => r.key === rack) ?? rackList[0];
  const curTint = TINT[current.key];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}>
      <style>{`
        .sh-wrap{max-width:1240px;margin:0 auto;padding:22px 20px 90px;display:flex;flex-direction:column;gap:16px}
        .sh-body{display:grid;grid-template-columns:232px minmax(0,1fr);gap:20px;align-items:start}
        .sh-side{position:sticky;top:16px;display:flex;flex-direction:column;gap:2px;background:${C.surface};border:1px solid ${C.line};border-radius:18px;padding:8px}
        .sh-nav{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:12px;border:none;background:transparent;cursor:pointer;font:inherit;color:${C.ink};text-align:left;transition:background .12s}
        .sh-nav:hover{background:${C.bg}}
        .sh-nav[aria-pressed=true]{background:${C.soft}}
        .sh-row{transition:background .12s}
        .sh-row:hover{background:#FAFBFE}
        .sh-row .sh-acts{opacity:.55;transition:opacity .12s}
        .sh-row:hover .sh-acts,.sh-row:focus-within .sh-acts{opacity:1}
        .sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
        .sh-grid .sh-row{flex-direction:column;align-items:stretch;border:1px solid ${C.line}!important;border-radius:14px}
        .sh-grid .sh-acts{opacity:1;justify-content:flex-end}
        @media (max-width:900px){
          .sh-body{grid-template-columns:minmax(0,1fr)}
          .sh-side{position:static;flex-direction:row;overflow-x:auto;padding:6px}
          .sh-nav{width:auto;white-space:nowrap;flex-shrink:0}
          .sh-nav .sh-hint{display:none}
        }
        @keyframes sh-pulse{0%,100%{opacity:.55}50%{opacity:1}}
        .sh-skel{animation:sh-pulse 1.2s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.sh-nav,.sh-row,.sh-row .sh-acts{transition:none}.sh-skel{animation:none}}
        button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
      `}</style>

      {/* Drop anywhere: a full-page target while dragging */}
      {drag && (
        <div aria-hidden="true" style={{ position: "fixed", inset: 12, zIndex: 60, borderRadius: 24, border: `3px dashed ${C.gold}`, background: "rgba(35,42,99,0.78)", display: "grid", placeItems: "center", color: "#FFFFFF", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: 34 }}>Drop to file them</div>
            <div style={{ marginTop: 6, color: "#C9CEEA" }}>{uploadRack === "auto" ? "The AI reads each one and picks the rack and year" : `Into ${RACKS.find(r => r.key === uploadRack)?.label}`}</div>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.csv,.json,.doc,.docx,.txt,.zip" style={{ display: "none" }} onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />

      <div className="sh-wrap">
        {/* Header: title, search, upload */}
        <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ marginRight: "auto" }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 32, lineHeight: 1.1 }}>Shelf</h1>
            <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4 }}>
              {items === null ? "Loading…" : <>{(items ?? []).length} files · {kb(totalBytes) || "0 KB"} · {thisMonth} added this month{lastAdded ? ` · last ${day(lastAdded)}` : ""}</>}
            </div>
          </div>
          <div style={{ position: "relative", flex: "0 1 320px", minWidth: 220 }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 13, top: 12 }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input id="sh-search" value={q} onChange={e => setQ(e.target.value)} placeholder={india ? "Search title, ARN, DIN, notice no…" : "Search title, reference, notice no…"} aria-label="Search the shelf" style={{ width: "100%", boxSizing: "border-box", height: 40, borderRadius: 12, border: `1px solid ${C.line}`, padding: "0 14px 0 38px", fontSize: 14, background: C.surface, color: C.ink }} />
          </div>
          <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 20px -12px rgba(35,42,99,.6)" }}>
            <button onClick={() => fileRef.current?.click()} disabled={!bizId || !!setup} style={{ height: 40, padding: "0 16px", border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
              Upload
            </button>
            <select id="sh-into" value={uploadRack} onChange={e => setUploadRack(e.target.value as RackKey | "auto")} aria-label="Where to file uploads" title="Where uploads go" style={{ height: 40, border: "none", borderLeft: "1px solid rgba(255,255,255,0.2)", background: "#2E3680", color: "#FFFFFF", fontSize: 13, fontWeight: 700, padding: "0 8px", cursor: "pointer" }}>
              <option value="auto">✨ AI files it</option>
              {racks.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        </header>

        {setup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{setup}</div>}

        {uploads.length > 0 && (
          <section aria-live="polite" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {uploads.slice(0, 5).map((u, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, minWidth: 0 }}>
                <span aria-hidden="true" className={u.state === "filing" ? "sh-skel" : ""} style={{ width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 11, fontWeight: 800, background: u.state === "error" ? C.negSoft : u.state === "done" ? C.posSoft : C.soft, color: u.state === "error" ? C.neg : u.state === "done" ? C.pos : C.primary }}>{u.state === "filing" ? "…" : u.state === "done" ? "✓" : "!"}</span>
                <b style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</b>
                <span style={{ color: u.state === "error" ? C.neg : u.state === "done" ? C.pos : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.text}</span>
              </div>
            ))}
          </section>
        )}

        {/* Notices needing a reply: the one thing that may need action */}
        {openNotices.length > 0 && (
          <section style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, background: overdueN.length ? C.negSoft : C.warnSoft, color: overdueN.length ? C.neg : C.warn }}>
            <b>{overdueN.length ? `${overdueN.length} notice${overdueN.length > 1 ? "s" : ""} overdue` : `${openNotices.length} open notice${openNotices.length > 1 ? "s" : ""}`}{soon.length ? ` · ${soon.length} due this week` : ""}</b>
            <span style={{ fontSize: 13.5, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{openNotices.slice(0, 3).map(n => `${n.title}${n.reply_due ? ` (by ${day(n.reply_due)})` : ""}`).join(" · ")}</span>
            <button onClick={() => setRack("notices")} style={{ ...btn, borderColor: "currentColor", color: "inherit", background: "transparent" }}>Review →</button>
          </section>
        )}

        <div className="sh-body">
          {/* Racks */}
          <nav className="sh-side" aria-label="Racks">
            {rackList.map(r => {
              const on = rack === r.key;
              const n = r.key === "all" ? inYear.length : counts[r.key] ?? 0;
              const t = TINT[r.key];
              return (
                <button key={r.key} className="sh-nav" onClick={() => setRack(r.key)} aria-pressed={on} title={r.hint}>
                  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", fontSize: 15, background: on ? t.c : t.b, flexShrink: 0, filter: on ? "none" : "saturate(.9)" }}>{r.key === "all" ? "🗄" : ICON[r.key]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: on ? 800 : 600 }}>{r.label}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: n ? (on ? t.c : C.muted) : C.strong }}>{n}</span>
                </button>
              );
            })}
          </nav>

          {/* Rack content */}
          <main style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ width: 6, height: 34, borderRadius: 3, background: curTint.c }} />
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{current.label}</h2>
                <div style={{ fontSize: 13, color: C.muted }}>{current.hint}</div>
              </div>
            </div>

            {/* Kept mounted while you look at other racks, so a login or download in progress isn't lost; only hidden */}
            {india && bizId && <div hidden={rack !== "gst"}><GstPortalDownload bizId={bizId} onSaved={() => load(bizId)} /></div>}
            {india && bizId && <div hidden={rack !== "income_tax" && rack !== "notices"}><ItPortalFetch bizId={bizId} onSaved={() => load(bizId)} /></div>}

            {india && rack === "gst" && calendar && (
              <section aria-label="GST return calendar" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Returns on the shelf · FY {calFy}</div>
                  <div style={{ fontSize: 12, color: C.muted }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: C.pos, marginRight: 5 }} />on the shelf · <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: C.soft, margin: "0 5px 0 6px", border: `1px solid ${C.line}` }} />missing</div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "separate", borderSpacing: 4, minWidth: 600, width: "100%" }}>
                    <thead><tr><th />{calendar.months.map(m => <th key={m.ym} style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>{m.label}</th>)}</tr></thead>
                    <tbody>
                      {calendar.rows.map(r => (
                        <tr key={r.label}>
                          <th scope="row" style={{ textAlign: "left", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", paddingRight: 8 }}>{r.label}</th>
                          {r.cells.map((ok, i) => <td key={i} title={`${r.label} ${calendar.months[i].label}: ${ok ? "on the shelf" : "missing"}`} style={{ height: 26, borderRadius: 7, background: ok ? C.pos : C.soft, color: ok ? "#FFFFFF" : C.strong, textAlign: "center", fontSize: 12, fontWeight: 800 }}>{ok ? "✓" : ""}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select id="sh-fy" value={fy} onChange={e => setFy(e.target.value)} aria-label="Financial year" style={{ height: 34, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13, fontWeight: 700, color: C.ink, background: C.surface }}>
                <option value="all">All years</option>
                {fys.map(y => <option key={y} value={y}>FY {y}</option>)}
              </select>
              <div role="radiogroup" aria-label="File type" style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
                {([["all", "All"], ["PDF", "PDF"], ["XLS", "Excel"], ["IMG", "Images"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={ftype === k} onClick={() => setFtype(k)} style={{ height: 32, padding: "0 12px", border: "none", background: ftype === k ? C.soft : "transparent", color: ftype === k ? C.primary : C.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{l}</button>)}
              </div>
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: C.muted }}>{items ? `${shown.length} file${shown.length === 1 ? "" : "s"}` : ""}</span>
              <select id="sh-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort files" style={{ height: 34, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 8px", fontSize: 13, fontWeight: 600, color: C.ink, background: C.surface }}>
                <option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">Name A–Z</option><option value="size">Largest first</option>
              </select>
              <div role="radiogroup" aria-label="View" style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
                {([["list", "☰"], ["grid", "▦"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={view === k} aria-label={k === "list" ? "List view" : "Grid view"} onClick={() => setView(k)} style={{ height: 32, width: 36, border: "none", background: view === k ? C.primary : "transparent", color: view === k ? "#FFFFFF" : C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{l}</button>)}
              </div>
            </div>

            {/* Files */}
            {items === null ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[0, 1, 2].map(k => <div key={k} className="sh-skel" style={{ height: 64, borderRadius: 14, background: C.surface, border: `1px solid ${C.line}` }} />)}</div>
            ) : shown.length === 0 ? (
              <button onClick={() => fileRef.current?.click()} disabled={!bizId || !!setup} style={{ font: "inherit", cursor: "pointer", background: C.surface, border: `1.5px dashed ${C.strong}`, borderRadius: 18, padding: "44px 24px", textAlign: "center", color: C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span aria-hidden="true" style={{ width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center", fontSize: 26, background: curTint.b }}>{rack === "all" ? "🗄" : ICON[rack]}</span>
                <b style={{ color: C.ink, fontSize: 16 }}>{items.length === 0 ? "Your shelf is empty" : q ? "No file matches your search" : "Nothing here yet"}</b>
                <span style={{ maxWidth: 460, lineHeight: 1.55, fontSize: 13.5 }}>{q ? "Try another word, or clear the search." : "Drop files anywhere on this page, or click here to choose them. The AI reads each one and files it in the right rack and year."}</span>
              </button>
            ) : (
              <section className={view === "grid" ? "sh-grid" : undefined} style={view === "grid" ? undefined : { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                {shown.map((it, idx) => {
                  const overdue = it.reply_due && it.status === "open" && it.reply_due < today();
                  const k = kind(it);
                  const sel: React.CSSProperties = { height: 30, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.muted, background: C.surface, padding: "0 4px" };
                  return (
                    <article key={it.id} className="sh-row" style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", borderTop: view === "list" && idx ? `1px solid ${C.line}` : "none", background: view === "grid" ? C.surface : undefined, flexWrap: "wrap" }}>
                      <span aria-hidden="true" style={{ width: 40, height: 46, borderRadius: 9, background: k.b, color: k.c, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 900, letterSpacing: "0.04em", flexShrink: 0 }}>{k.t}</span>
                      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 3 }}>
                        {editing === it.id
                          ? <input autoFocus defaultValue={it.title} onBlur={e => { setEditing(null); if (e.target.value.trim() && e.target.value !== it.title) patch(it.id, { title: e.target.value.trim() }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ fontSize: 14.5, fontWeight: 700, border: `1px solid ${C.strong}`, borderRadius: 8, padding: "3px 8px" }} />
                          : <button onClick={() => open(it)} style={{ all: "unset", cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</button>}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: C.muted }}>
                          {rack === "all" && <span style={{ fontWeight: 700, color: TINT[it.rack]?.c }}>{RACKS.find(r => r.key === it.rack)?.label}</span>}
                          {it.fy && <span style={{ padding: "1px 7px", borderRadius: 999, background: "#FBF4E2", color: "#7A5A12", fontWeight: 700 }}>FY {it.fy}</span>}
                          {it.doc_type && <span>{it.doc_type}</span>}
                          {it.reference && <span>· Ref <b style={{ color: C.ink, fontWeight: 600 }}>{it.reference}</b></span>}
                          <span>· {day(it.created_at)}{it.size_bytes ? ` · ${kb(it.size_bytes)}` : ""}</span>
                        </div>
                        {it.ai_summary && <div style={{ fontSize: 12.5, color: C.ink, opacity: 0.8, lineHeight: 1.45 }}>{it.ai_summary}</div>}
                        {it.rack === "notices" && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 3, fontSize: 12.5 }}>
                            <span style={{ fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: it.status !== "open" ? C.posSoft : overdue ? C.negSoft : C.warnSoft, color: it.status !== "open" ? C.pos : overdue ? C.neg : C.warn }}>{it.status !== "open" ? (it.status === "replied" ? "Replied" : "Closed") : it.reply_due ? `Reply by ${day(it.reply_due)}${overdue ? " — overdue" : ""}` : "No reply date"}</span>
                            {it.amount ? <span style={{ fontWeight: 700 }}>Demand {cur()}{Number(it.amount).toLocaleString(activeMoney().locale)}</span> : null}
                            <input type="date" aria-label="Reply-by date" value={it.reply_due ?? ""} onChange={e => patch(it.id, { reply_due: e.target.value || null })} style={{ ...sel, padding: "0 6px" }} />
                            <select value={it.status} onChange={e => patch(it.id, { status: e.target.value })} aria-label="Notice status" style={sel}>
                              <option value="open">Open</option><option value="replied">Replied</option><option value="closed">Closed</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="sh-acts" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={it.fy ?? ""} onChange={e => patch(it.id, { fy: e.target.value || null })} aria-label="Financial year" title="Financial year" style={sel}>
                          <option value="">No FY</option>
                          {Array.from({ length: 10 }, (_, n) => { const y = new Date().getFullYear() - n; return `${y}-${String(y + 1).slice(2)}`; }).map(v => <option key={v} value={v}>FY {v}</option>)}
                        </select>
                        <select value={it.rack} onChange={e => patch(it.id, { rack: e.target.value as RackKey })} aria-label="Move to rack" title="Move to another rack" style={sel}>
                          {RACKS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                        <button onClick={() => open(it)} style={{ ...btn, height: 30, background: C.primary, color: "#FFFFFF", border: "none" }}>Open</button>
                        <button onClick={() => open(it, true)} style={{ ...btn, height: 30 }} aria-label="Download" title="Download">⬇</button>
                        <button onClick={() => setEditing(it.id)} aria-label="Rename" title="Rename" style={{ ...btn, height: 30 }}>✎</button>
                        <button onClick={() => remove(it)} aria-label="Remove" title="Remove" style={{ ...btn, height: 30, color: C.neg }}>×</button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: 0 }}>🔒 Files are private and open through short-lived links. Drop files anywhere on this page to add them.</p>
          </main>
        </div>
      </div>
    </div>
  );
}
