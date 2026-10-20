"use client";
import GstPortalDownload from "@/components/finance/GstPortalDownload";
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}>
      <style>{`
        .sh-racks{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
        .sh-rack{transition:transform .15s,box-shadow .15s,border-color .15s}
        .sh-rack:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(35,42,99,.10)}
        .sh-item{transition:border-color .15s,box-shadow .15s}
        .sh-item:hover{border-color:${C.strong}!important;box-shadow:0 6px 18px rgba(35,42,99,.07)}
        .sh-drop{transition:background .15s,border-color .15s}
        .sh-drop:hover{background:#FBFAF5!important;border-color:${C.gold}!important}
        .sh-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .sh-stat{transition:transform .15s,box-shadow .15s}.sh-stat:hover{transform:translateY(-2px);box-shadow:0 12px 26px -16px rgba(35,42,99,.35)}
        .sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
        .sh-grid .sh-item{flex-direction:column}
        .sh-grid .sh-item > div:last-child{width:100%;justify-content:flex-end}
        @media (prefers-reduced-motion:reduce){.sh-rack,.sh-stat,.sh-item{transition:none}}
        @media (max-width:980px){.sh-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:520px){.sh-stats{grid-template-columns:minmax(0,1fr)}}
        @keyframes sh-pulse{0%,100%{opacity:.55}50%{opacity:1}}
        .sh-skel{animation:sh-pulse 1.2s ease-in-out infinite}
        button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
      `}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 100px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Hero: title + drop zone */}
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 18, background: "linear-gradient(135deg,#1B2152 0%,#232A63 60%,#2E3680 100%)", borderRadius: 22, padding: 24, color: "#FFFFFF", position: "relative", overflow: "hidden" }} className="sh-hero">
          <style>{`@media (max-width:820px){.sh-hero{grid-template-columns:1fr!important}}`}</style>
          <div aria-hidden="true" style={{ position: "absolute", right: -60, top: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,162,74,.28),transparent 70%)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>Document shelf</span>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 38, lineHeight: 1.1, textWrap: "balance" }}>Every record, filed and findable.</h1>
            <p style={{ margin: 0, color: "#C9CEEA", fontSize: 15, lineHeight: 1.55, maxWidth: 460 }}>
              Drop {india ? "returns, notices, " : "notices, "}statements, bills and registrations. The AI reads each one, files it in the right rack and year, and pulls out the reference number and reply date.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {["Auto-filed by AI", "Private links", "Searchable by ref no."].map(t => (
                <span key={t} style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "#E6E8F4" }}>✓ {t}</span>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.csv,.json,.doc,.docx,.txt,.zip" style={{ display: "none" }} onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
            <button className="sh-drop" onClick={() => fileRef.current?.click()} disabled={!bizId || !!setup}
              style={{ flex: 1, minHeight: 150, borderRadius: 16, border: `2px dashed ${drag ? C.gold : "rgba(255,255,255,0.35)"}`, background: drag ? "rgba(201,162,74,0.16)" : "#FFFFFF", color: C.ink, cursor: setup ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 18, opacity: setup ? 0.6 : 1, font: "inherit" }}>
              <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: C.soft, display: "grid", placeItems: "center", color: C.primary }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
              </span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{drag ? "Drop to file them" : "Drop files here or click to add"}</span>
              <span style={{ fontSize: 12.5, color: C.muted }}>PDF, photos, Excel, Word, ZIP · up to 20 at a time</span>
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C9CEEA" }}>
              File into
              <select value={uploadRack} onChange={e => setUploadRack(e.target.value as RackKey | "auto")} aria-label="Where to file uploads" style={{ flex: 1, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", padding: "0 10px", fontSize: 13.5, color: C.ink, background: "#FFFFFF", fontWeight: 600 }}>
                <option value="auto">✨ Let the AI choose the rack</option>
                {racks.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        {setup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{setup}</div>}
        {uploads.length > 0 && (
          <section aria-live="polite" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {uploads.slice(0, 6).map((u, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, background: u.state === "error" ? C.negSoft : u.state === "done" ? C.posSoft : C.soft, color: u.state === "error" ? C.neg : u.state === "done" ? C.pos : C.primary }} className={u.state === "filing" ? "sh-skel" : ""}>{u.state === "filing" ? "…" : u.state === "done" ? "✓" : "!"}</span>
                <b style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</b>
                <span style={{ color: u.state === "error" ? C.neg : u.state === "done" ? C.pos : C.muted }}>{u.text}</span>
              </div>
            ))}
          </section>
        )}

        {/* At a glance */}
        <div className="sh-stats">
          {[
            { label: "Files on the shelf", value: (items ?? []).length, tone: C.primary, tint: "#E6E8F4", icon: "🗄", sub: totalBytes ? `${kb(totalBytes)} stored` : "Nothing stored yet" },
            { label: "Added this month", value: thisMonth, tone: C.pos, tint: C.posSoft, icon: "📥", sub: lastAdded ? `Last added ${day(lastAdded)}` : "Drop your first file above" },
            { label: "Open notices", value: openNotices.length, tone: openNotices.length ? C.warn : C.muted, tint: C.warnSoft, icon: "📮", sub: openNotices.length ? "Waiting for a reply" : "All clear" },
            { label: overdueN.length ? "Replies overdue" : "Replies due in 7 days", value: overdueN.length || soon.length, tone: overdueN.length ? C.neg : soon.length ? C.warn : C.muted, tint: overdueN.length ? C.negSoft : "#EEF0F5", icon: "⏰", sub: overdueN.length ? "Reply as soon as you can" : soon.length ? "Coming up this week" : "Nothing due" },
          ].map(s => (
            <div key={s.label} className="sh-stat" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", position: "relative", overflow: "hidden" }}>
              <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: s.tone, opacity: s.value ? 1 : 0.25 }} />
              <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: s.tint, display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, color: s.tone, fontVariantNumeric: "tabular-nums" }}>{items === null ? "–" : s.value}</div>
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 700, marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{items === null ? "" : s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {openNotices.length > 0 && (
          <section style={{ background: C.surface, border: `1px solid #E8A59B`, borderLeft: `5px solid ${C.neg}`, borderRadius: 14, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: C.neg }}>📮 {openNotices.length} open notice{openNotices.length > 1 ? "s" : ""} need a reply</b>
            <span style={{ fontSize: 13.5, color: C.ink }}>{openNotices.slice(0, 3).map(n => `${n.title}${n.reply_due ? ` (by ${day(n.reply_due)})` : ""}`).join(" · ")}</span>
            <button onClick={() => setRack("notices")} style={{ ...btn, marginLeft: "auto", borderColor: C.neg, color: C.neg }}>See notices →</button>
          </section>
        )}

        {/* Racks */}
        <div className="sh-racks">
          {[{ key: "all" as const, label: "Whole shelf", hint: "Everything" }, ...racks].map(r => {
            const on = rack === r.key;
            const n = r.key === "all" ? inYear.length : counts[r.key] ?? 0;
            const t = TINT[r.key];
            const last = (items ?? []).filter(i => r.key === "all" || i.rack === r.key).reduce<string | null>((m, i) => (!m || i.created_at > m ? i.created_at : m), null);
            return (
              <button key={r.key} className="sh-rack" onClick={() => setRack(r.key)} title={r.hint} aria-pressed={on}
                style={{ textAlign: "left", padding: "16px", borderRadius: 18, border: `1.5px solid ${on ? t.c : C.line}`, background: on ? `linear-gradient(150deg, ${t.c} 0%, ${C.primary} 140%)` : C.surface, cursor: "pointer", color: on ? "#FFFFFF" : C.ink, display: "flex", flexDirection: "column", gap: 8, font: "inherit", position: "relative", overflow: "hidden", boxShadow: on ? `0 14px 30px -14px ${t.c}` : "none" }}>
                {!on && <span aria-hidden="true" style={{ position: "absolute", right: -26, top: -26, width: 80, height: 80, borderRadius: "50%", background: t.b, opacity: 0.7 }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                  <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", fontSize: 20, background: on ? "rgba(255,255,255,0.16)" : t.b, border: on ? "1px solid rgba(255,255,255,0.2)" : "none" }}>{r.key === "all" ? "🗄" : ICON[r.key]}</span>
                  <span style={{ minWidth: 28, height: 24, padding: "0 9px", borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", background: on ? "#FFFFFF" : n ? t.b : "transparent", color: on ? t.c : n ? t.c : C.muted, border: n || on ? "none" : `1px solid ${C.line}` }}>{n}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15.5, position: "relative" }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: on ? "rgba(255,255,255,0.75)" : C.muted, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.hint}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: on ? "rgba(255,255,255,0.85)" : t.c, opacity: last ? 1 : 0.5 }}>{last ? `Updated ${day(last)}` : "Empty"}</div>
              </button>
            );
          })}
        </div>

        {/* GST rack: download returns from the portal (OTP), filed here by month */}
        {india && rack === "gst" && bizId && <GstPortalDownload bizId={bizId} onSaved={() => load(bizId)} />}

        {/* GST return calendar: a tick for every month whose return is on the shelf */}
        {india && (rack === "gst" || rack === "all") && calendar && (
          <section aria-label="GST return calendar" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>GST returns on the shelf · FY {calFy}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.pos, marginRight: 5 }} />On the shelf</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.soft, marginRight: 5, border: `1px solid ${C.line}` }} />Missing</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 4, minWidth: 620, width: "100%" }}>
                <thead><tr><th />{calendar.months.map(m => <th key={m.ym} style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>{m.label}</th>)}</tr></thead>
                <tbody>
                  {calendar.rows.map(r => (
                    <tr key={r.label}>
                      <th scope="row" style={{ textAlign: "left", fontSize: 12.5, fontWeight: 800, color: C.ink, whiteSpace: "nowrap", paddingRight: 8 }}>{r.label}</th>
                      {r.cells.map((ok, i) => (
                        <td key={i} title={`${r.label} ${calendar.months[i].label}: ${ok ? "on the shelf" : "missing"}`}
                          style={{ height: 30, borderRadius: 8, background: ok ? C.pos : C.soft, color: ok ? "#FFFFFF" : C.strong, textAlign: "center", fontSize: 13, fontWeight: 800 }}>{ok ? "✓" : "·"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={chip(fy === "all")} onClick={() => setFy("all")}>All years</button>
          {fys.map(y => <button key={y} style={chip(fy === y)} onClick={() => setFy(y)}>FY {y}</button>)}
          <span aria-hidden="true" style={{ width: 1, height: 22, background: C.line, margin: "0 2px" }} />
          {([["all", "All files"], ["PDF", "PDF"], ["XLS", "Excel"], ["IMG", "Images"]] as const).map(([k, l]) => <button key={k} style={chip(ftype === k)} onClick={() => setFtype(k)}>{l}</button>)}
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort files" style={{ height: 34, borderRadius: 999, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13, fontWeight: 700, color: C.ink, background: C.surface }}>
            <option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">Name A–Z</option><option value="size">Largest first</option>
          </select>
          <div role="radiogroup" aria-label="View" style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 999, overflow: "hidden" }}>
            {([["list", "☰ List"], ["grid", "▦ Grid"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={view === k} onClick={() => setView(k)} style={{ height: 32, padding: "0 12px", border: "none", background: view === k ? C.primary : C.surface, color: view === k ? "#FFFFFF" : C.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{l}</button>)}
          </div>
          <div style={{ marginLeft: "auto", position: "relative", minWidth: 260, flex: "0 1 340px" }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: 11 }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={india ? "Search title, ARN, DIN, notice no…" : "Search title, reference, notice no…"} aria-label="Search the shelf" style={{ width: "100%", boxSizing: "border-box", height: 38, borderRadius: 999, border: `1px solid ${C.line}`, padding: "0 14px 0 36px", fontSize: 14, background: C.surface, color: C.ink }} />
          </div>
        </div>

        {/* Files */}
        <section className={view === "grid" && shown.length ? "sh-grid" : undefined} style={view === "grid" && shown.length ? undefined : { display: "flex", flexDirection: "column", gap: 8 }}>
          {items === null ? [0, 1, 2].map(k => (
            <div key={k} className="sh-skel" style={{ height: 68, borderRadius: 14, background: C.surface, border: `1px solid ${C.line}` }} />
          )) : shown.length === 0 ? (
            <div style={{ background: C.surface, border: `1px dashed ${C.strong}`, borderRadius: 18, padding: "36px 24px", textAlign: "center", color: C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <span aria-hidden="true" style={{ fontSize: 34 }}>{rack === "all" ? "🗄" : ICON[rack]}</span>
              {items.length === 0 ? <>
                <b style={{ color: C.ink, fontSize: 16 }}>Your shelf is empty</b>
                <span style={{ maxWidth: 520, lineHeight: 1.55, fontSize: 14 }}>Drop {india ? "GST returns, ITR acknowledgements, " : ""}notices, statements or certificates above — each one is filed in the right rack and year. Bills and bank statements you give FreBook land here automatically.</span>
                <button onClick={() => fileRef.current?.click()} disabled={!bizId || !!setup} style={{ ...btn, height: 40, padding: "0 18px", background: C.primary, color: "#FFFFFF", border: "none", marginTop: 4 }}>＋ Add your first file</button>
              </> : <><b style={{ color: C.ink }}>Nothing here yet</b><span style={{ fontSize: 13.5 }}>{q ? "No file matches your search." : "No files in this rack for the chosen year."}</span></>}
            </div>
          ) : shown.map(it => {
            const overdue = it.reply_due && it.status === "open" && it.reply_due < today();
            const k = kind(it);
            return (
              <article key={it.id} className="sh-item" style={{ background: C.surface, border: `1px solid ${overdue ? "#E8A59B" : C.line}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ width: 44, height: 52, borderRadius: 9, background: k.b, color: k.c, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900, letterSpacing: "0.04em", flexShrink: 0, position: "relative" }}>
                  {k.t}<span style={{ position: "absolute", right: -4, bottom: -4, fontSize: 14 }}>{ICON[it.rack] ?? "📄"}</span>
                </span>
                <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 4 }}>
                  {editing === it.id
                    ? <input autoFocus defaultValue={it.title} onBlur={e => { setEditing(null); if (e.target.value.trim() && e.target.value !== it.title) patch(it.id, { title: e.target.value.trim() }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ fontSize: 15, fontWeight: 700, border: `1px solid ${C.strong}`, borderRadius: 8, padding: "3px 8px" }} />
                    : <button onClick={() => open(it)} style={{ all: "unset", cursor: "pointer", fontSize: 15, fontWeight: 700, color: C.ink }}>{it.title}</button>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
                    {it.doc_type && <span style={{ padding: "2px 8px", borderRadius: 999, background: C.soft, color: C.primary, fontWeight: 700 }}>{it.doc_type}</span>}
                    {it.fy && <span style={{ padding: "2px 8px", borderRadius: 999, background: "#FBF4E2", color: "#7A5A12", fontWeight: 700 }}>FY {it.fy}</span>}
                    {it.period && <span style={{ color: C.muted }}>{it.period}</span>}
                    {it.reference && <span style={{ color: C.muted }}>· Ref <b style={{ color: C.ink, fontWeight: 600 }}>{it.reference}</b></span>}
                    <span style={{ color: C.muted }}>· {SOURCE[it.source] ?? it.source} {day(it.created_at)}</span>
                    {it.size_bytes ? <span style={{ color: C.muted }}>· {kb(it.size_bytes)}</span> : null}
                  </div>
                  {it.ai_summary && <div style={{ fontSize: 13, color: C.ink, opacity: 0.85, lineHeight: 1.5 }}>{it.ai_summary}</div>}
                  {it.notes && <div style={{ fontSize: 12.5, color: C.muted, fontStyle: "italic" }}>{it.notes}</div>}
                  {it.rack === "notices" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: overdue ? C.negSoft : C.warnSoft, color: overdue ? C.neg : C.warn }}>{it.reply_due ? `Reply by ${day(it.reply_due)}${overdue ? " — overdue" : ""}` : "No reply date"}</span>
                      <input type="date" aria-label="Reply-by date" value={it.reply_due ?? ""} onChange={e => patch(it.id, { reply_due: e.target.value || null })} style={{ border: `1px solid ${C.line}`, borderRadius: 7, padding: "2px 6px", fontSize: 12.5 }} />
                      {it.amount ? <span>· Demand {cur()}{Number(it.amount).toLocaleString(activeMoney().locale)}</span> : null}
                      <select value={it.status} onChange={e => patch(it.id, { status: e.target.value })} aria-label="Notice status" style={{ border: `1px solid ${C.line}`, borderRadius: 7, padding: "2px 6px", fontSize: 12.5 }}>
                        <option value="open">Open</option><option value="replied">Replied</option><option value="closed">Closed</option>
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={it.rack} onChange={e => patch(it.id, { rack: e.target.value as RackKey })} aria-label="Move to rack" title="Move to another rack" style={{ height: 32, border: `1px solid ${C.line}`, borderRadius: 9, fontSize: 12.5, color: C.muted, background: C.surface, padding: "0 6px" }}>
                    {RACKS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <button onClick={() => open(it)} style={{ ...btn, background: C.primary, color: "#FFFFFF", border: "none" }}>Open</button>
                  <button onClick={() => open(it, true)} style={btn} aria-label="Download">⬇</button>
                  <button onClick={() => setEditing(it.id)} aria-label="Rename" title="Rename" style={btn}>✎</button>
                  <button onClick={() => remove(it)} aria-label="Remove" title="Remove" style={{ ...btn, color: C.neg }}>×</button>
                </div>
              </article>
            );
          })}
        </section>

        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, display: "flex", gap: 8 }}>
          <span aria-hidden="true">🔒</span>
          <span>Files are stored privately and opened through short-lived links.{india ? " GST returns can be downloaded from the portal on the GST rack (OTP from the GST portal). Notices and Income-tax documents: download them from the portal and drop them here — the AI reads the period, reference number and reply date for you." : ""}</span>
        </p>
      </div>
    </div>
  );
}
