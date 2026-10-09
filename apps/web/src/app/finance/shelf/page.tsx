"use client";
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
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter(i => (rack === "all" || i.rack === rack) && (fy === "all" || i.fy === fy)
      && (!s || [i.title, i.doc_type, i.period, i.reference, i.authority, i.file_name, i.ai_summary, i.notes].some(x => x?.toLowerCase().includes(s))));
  }, [items, rack, fy, q]);

  const chip = (on: boolean): React.CSSProperties => ({ height: 34, padding: "0 12px", borderRadius: 9, border: `1px solid ${on ? C.primary : C.line}`, background: on ? C.soft : C.surface, color: on ? C.primary : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}>
      <style>{`.sh-racks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.sh-item:hover{border-color:${C.strong}!important}`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 34 }}>Shelf</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 15 }}>Every record in one place — returns, notices, statements, bills and registrations, by year.</p>
          </div>
          <select value={uploadRack} onChange={e => setUploadRack(e.target.value as RackKey | "auto")} aria-label="Where to file uploads" style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 14, color: C.ink, background: C.surface }}>
            <option value="auto">✨ AI files it for me</option>
            {RACKS.map(r => <option key={r.key} value={r.key}>File in: {r.label}</option>)}
          </select>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.csv,.json,.doc,.docx,.txt,.zip" style={{ display: "none" }} onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={!bizId || !!setup} style={{ height: 44, padding: "0 20px", borderRadius: 11, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: "pointer", opacity: setup ? 0.5 : 1 }}>＋ Add to shelf</button>
        </header>

        {setup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{setup}</div>}
        {drag && <div style={{ border: `2px dashed ${C.primary}`, borderRadius: 14, padding: 26, textAlign: "center", color: C.primary, fontWeight: 700, background: C.soft }}>Drop files to put them on the shelf</div>}
        {uploads.length > 0 && (
          <section aria-live="polite" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {uploads.slice(0, 6).map((u, i) => (
              <div key={i} style={{ fontSize: 13, color: u.state === "error" ? C.neg : u.state === "done" ? C.pos : C.muted }}>{u.state === "filing" ? "⏳" : u.state === "done" ? "✓" : "⚠"} <b>{u.name}</b> — {u.text}</div>
            ))}
          </section>
        )}

        {openNotices.length > 0 && (
          <section style={{ background: C.negSoft, border: "1px solid #E8A59B", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: C.neg }}>📮 {openNotices.length} open notice{openNotices.length > 1 ? "s" : ""}</b>
            <span style={{ fontSize: 13.5 }}>{openNotices.slice(0, 3).map(n => `${n.title}${n.reply_due ? ` (reply by ${day(n.reply_due)})` : ""}`).join(" · ")}</span>
            <button onClick={() => setRack("notices")} style={{ ...chip(false), marginLeft: "auto" }}>Open notices</button>
          </section>
        )}

        {/* Racks */}
        <div className="sh-racks">
          <button onClick={() => setRack("all")} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${rack === "all" ? C.primary : C.line}`, background: rack === "all" ? C.soft : C.surface, cursor: "pointer", color: C.ink }}>
            <div style={{ fontSize: 20 }}>🗄</div><div style={{ fontWeight: 800, marginTop: 4 }}>Whole shelf</div><div style={{ fontSize: 12.5, color: C.muted }}>{(items ?? []).filter(i => fy === "all" || i.fy === fy).length} files</div>
          </button>
          {RACKS.map(r => (
            <button key={r.key} onClick={() => setRack(r.key)} title={r.hint} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${rack === r.key ? C.primary : C.line}`, background: rack === r.key ? C.soft : C.surface, cursor: "pointer", color: C.ink, borderBottom: `4px solid ${rack === r.key ? C.primary : C.gold}` }}>
              <div style={{ fontSize: 20 }}>{ICON[r.key]}</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{r.label}</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{counts[r.key] ?? 0} file{counts[r.key] === 1 ? "" : "s"}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={chip(fy === "all")} onClick={() => setFy("all")}>All years</button>
          {fys.map(y => <button key={y} style={chip(fy === y)} onClick={() => setFy(y)}>FY {y}</button>)}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, ARN, DIN, notice no…" aria-label="Search the shelf" style={{ marginLeft: "auto", height: 38, minWidth: 240, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 14, background: C.surface, color: C.ink }} />
        </div>

        {/* Files */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items === null ? <div style={{ color: C.muted, padding: 20 }}>Opening the shelf…</div>
            : shown.length === 0 ? (
              <div style={{ background: C.surface, border: `1px dashed ${C.strong}`, borderRadius: 14, padding: 30, textAlign: "center", color: C.muted }}>
                {items.length === 0 ? <>The shelf is empty. Drop GST returns, ITR acknowledgements, notices, statements or certificates here — the AI files each one in the right rack and year.<br />Bank statements and bills you give FreBook, and GSTR-1 files you export, are filed here automatically.</> : "Nothing matches."}
              </div>
            ) : shown.map(it => {
              const overdue = it.reply_due && it.status === "open" && it.reply_due < today();
              return (
                <article key={it.id} className="sh-item" style={{ background: C.surface, border: `1px solid ${overdue ? "#E8A59B" : C.line}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{ICON[it.rack] ?? "📄"}</span>
                  <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 3 }}>
                    {editing === it.id
                      ? <input autoFocus defaultValue={it.title} onBlur={e => { setEditing(null); if (e.target.value.trim() && e.target.value !== it.title) patch(it.id, { title: e.target.value.trim() }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ fontSize: 15, fontWeight: 700, border: `1px solid ${C.strong}`, borderRadius: 8, padding: "3px 8px" }} />
                      : <button onClick={() => open(it)} style={{ all: "unset", cursor: "pointer", fontSize: 15, fontWeight: 700, color: C.ink }}>{it.title}</button>}
                    <div style={{ fontSize: 12.5, color: C.muted, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {it.doc_type && <span>{it.doc_type}</span>}
                      {it.period && <span>· {it.period}</span>}
                      {it.fy && <span>· FY {it.fy}</span>}
                      {it.reference && <span>· Ref {it.reference}</span>}
                      <span>· {SOURCE[it.source] ?? it.source} {day(it.created_at)}</span>
                      {it.size_bytes ? <span>· {kb(it.size_bytes)}</span> : null}
                    </div>
                    {it.ai_summary && <div style={{ fontSize: 13, color: C.ink, opacity: 0.85 }}>{it.ai_summary}</div>}
                    {it.notes && <div style={{ fontSize: 12.5, color: C.muted, fontStyle: "italic" }}>{it.notes}</div>}
                    {it.rack === "notices" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: overdue ? C.neg : C.warn }}>{it.reply_due ? `Reply by ${day(it.reply_due)}${overdue ? " — overdue" : ""}` : "No reply date"}</span>
                        <input type="date" aria-label="Reply-by date" value={it.reply_due ?? ""} onChange={e => patch(it.id, { reply_due: e.target.value || null })} style={{ border: `1px solid ${C.line}`, borderRadius: 7, padding: "2px 6px", fontSize: 12.5 }} />
                        {it.amount ? <span>· Demand ₹{Number(it.amount).toLocaleString("en-IN")}</span> : null}
                        <select value={it.status} onChange={e => patch(it.id, { status: e.target.value })} aria-label="Notice status" style={{ border: `1px solid ${C.line}`, borderRadius: 7, padding: "2px 6px", fontSize: 12.5 }}>
                          <option value="open">Open</option><option value="replied">Replied</option><option value="closed">Closed</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={it.rack} onChange={e => patch(it.id, { rack: e.target.value as RackKey })} aria-label="Move to rack" style={{ height: 32, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12.5, color: C.muted, background: C.surface }}>
                      {RACKS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                    <button onClick={() => open(it)} style={chip(false)}>Open</button>
                    <button onClick={() => open(it, true)} style={chip(false)}>Download</button>
                    <button onClick={() => setEditing(it.id)} aria-label="Rename" style={chip(false)}>✎</button>
                    <button onClick={() => remove(it)} aria-label="Remove" style={{ ...chip(false), color: C.neg }}>×</button>
                  </div>
                </article>
              );
            })}
        </section>

        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          Files are stored privately and opened through short-lived links. Automatic download of returns and notices straight from the GST and Income-tax portals needs a licensed GSP/ERI connection — until then, download them from the portal and drop them here; the AI reads the period, reference number and reply date for you.
        </p>
      </div>
    </div>
  );
}
