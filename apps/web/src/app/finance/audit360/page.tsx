"use client";
// 360° Audit — one checklist for the year: books integrity, cash / tax-law limits, and the books against the portals
// (GSTR-1, GSTR-3B, GSTR-2B, 26AS / AIS) plus TDS deducted. Portal files are read in this browser, kept on this
// device for the year, and sent only for the comparison — nothing is stored on the server or changed in the books.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { useFinancialYear } from "@/lib/selectedFy";
import PageHero, { HeroAction, HeroFyPicker, HT, SERIF } from "@/components/finance/PageHero";
import type { AuditCheck, AuditStatus } from "@/lib/audit360";
import { parseGstr1, parseGstr3b, parseGstr2b, parse26asRows, type PortalData } from "@/lib/auditPortal";

type Report = { fy: { id: string; label: string }; checks: AuditCheck[]; score: number; counts: Record<AuditStatus, number> };
type SourceKey = "gstr1" | "gstr3b" | "gstr2b" | "tds26as";

const TONE: Record<AuditStatus, { label: string; bg: string; fg: string; dot: string }> = {
  ok: { label: "Matched", bg: "#E3F3EC", fg: "#0B7A55", dot: "#12A06C" },
  warn: { label: "Check", bg: "#FBF1DA", fg: "#9A6B22", dot: "#D9A441" },
  fail: { label: "Problem", bg: "#FBE3DE", fg: "#B4321F", dot: "#D2492F" },
  na: { label: "Not checked", bg: "#EEF0EF", fg: "#6B7570", dot: "#A9B1AD" },
};
const SECTIONS: { key: AuditCheck["section"]; title: string; note: string }[] = [
  { key: "books", title: "Books integrity", note: "Do the books hold together — balanced, complete, nothing parked in suspense." },
  { key: "cash_law", title: "Cash and tax-law limits", note: "Cash transactions the Income-tax Act penalises or disallows." },
  { key: "gstr1", title: "GSTR-1 — sales", note: "Sales and output GST in the books against what was reported in GSTR-1." },
  { key: "gstr3b", title: "GSTR-3B — tax paid and ITC claimed", note: "What was declared and claimed in GSTR-3B against the books." },
  { key: "gstr2b", title: "GSTR-2B — input tax credit", note: "ITC in the books against what suppliers filed." },
  { key: "tds_received", title: "26AS / AIS — TDS and receipts", note: "TDS others deducted from payments to you, and the amounts they reported." },
  { key: "tds_deducted", title: "TDS you deducted", note: "TDS deducted from your payments, and whether it was deposited on time." },
];
const SOURCES: { key: SourceKey; title: string; how: string; accept: string; multi: boolean }[] = [
  { key: "gstr1", title: "GSTR-1", how: "GST portal → Returns → GSTR-1 → View → Download JSON — one file per month", accept: ".json", multi: true },
  { key: "gstr3b", title: "GSTR-3B", how: "GST portal → Returns → GSTR-3B → Download filed return (JSON) — one per month", accept: ".json", multi: true },
  { key: "gstr2b", title: "GSTR-2B", how: "GST portal → Returns → GSTR-2B → Download JSON — one per month", accept: ".json", multi: true },
  { key: "tds26as", title: "26AS / AIS", how: "Form 26AS as PDF (from TRACES), or 26AS / AIS exported to Excel / CSV", accept: ".pdf,.xlsx,.xls,.csv", multi: false },
];
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const readText = (f: File) => f.text();

export default function Audit360() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const { years, fy, setFy } = useFinancialYear(bizId);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [portal, setPortal] = useState<PortalData>({});
  const [files, setFiles] = useState<Record<SourceKey, string[]>>({ gstr1: [], gstr3b: [], gstr2b: [], tds26as: [] });
  const [srcMsg, setSrcMsg] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const memKey = bizId && fy ? `fw_audit_portal:${bizId}:${fy.id}` : "";

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!id) { router.push("/finance/setup"); return; }
      setBizId(id);
      const { data } = await supabase.from("fw_fin_businesses").select("name").eq("id", id).maybeSingle();
      setBizName(data?.name ?? "");
    });
  }, [router]);

  // Portal files uploaded earlier for this business and year (this device only)
  useEffect(() => {
    if (!memKey) return;
    try { const m = JSON.parse(localStorage.getItem(memKey) ?? "null"); setPortal(m?.portal ?? {}); setFiles(m?.files ?? { gstr1: [], gstr3b: [], gstr2b: [], tds26as: [] }); }
    catch { setPortal({}); }
  }, [memKey]);
  const save = (p: PortalData, f: Record<SourceKey, string[]>) => { setPortal(p); setFiles(f); try { if (memKey) localStorage.setItem(memKey, JSON.stringify({ portal: p, files: f })); } catch { /* full or private */ } setTick(t => t + 1); };

  useEffect(() => {
    if (!bizId || !fy) return;
    setBusy(true); setErr("");
    fetch("/api/finance/audit360", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, fy_id: fy.id, portal }) }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't run the audit."); else setReport(d as Report);
    }).catch(() => setErr("Couldn't run the audit.")).finally(() => setBusy(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, fy, tick]);

  async function upload(key: SourceKey, list: FileList | null) {
    if (!list?.length) return;
    setSrcMsg(m => ({ ...m, [key]: "Reading…" }));
    try {
      const p: PortalData = JSON.parse(JSON.stringify(portal));
      const names = [...files[key]];
      for (const f of Array.from(list)) {
        if (key === "gstr1") p.gstr1 = parseGstr1(JSON.parse(await readText(f)), p.gstr1);
        else if (key === "gstr3b") p.gstr3b = parseGstr3b(JSON.parse(await readText(f)), p.gstr3b);
        else if (key === "gstr2b") p.gstr2b = parseGstr2b(JSON.parse(await readText(f)), p.gstr2b);
        else if (/\.pdf$/i.test(f.name)) {
          const fd = new FormData(); fd.append("file", f); fd.append("kind", "26as"); if (bizId) fd.append("business_id", bizId);
          const r = await fetch("/api/finance/tax-docs", { method: "POST", body: fd });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error ?? "Couldn't read the 26AS PDF.");
          p.tds26as = { deductors: ((d.form26as?.deductors ?? []) as { name: string; tan: string; paid: number; tds: number }[]).map(x => ({ name: x.name, tan: x.tan, paid: x.paid, tds: x.tds })) };
          names.length = 0;
        } else {
          const XLSX = await import("xlsx");
          const wb = /\.csv$/i.test(f.name) ? XLSX.read(await readText(f), { type: "string" }) : XLSX.read(await f.arrayBuffer(), { type: "array" });
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
          p.tds26as = parse26asRows(rows); names.length = 0;
        }
        names.push(f.name);
      }
      save(p, { ...files, [key]: [...new Set(names)] });
      setSrcMsg(m => ({ ...m, [key]: "" }));
    } catch (e) { setSrcMsg(m => ({ ...m, [key]: e instanceof Error ? e.message : "Couldn't read that file." })); }
  }
  const clear = (key: SourceKey) => { const p = { ...portal }; delete p[key]; save(p, { ...files, [key]: [] }); };
  const loadedMonths = (key: SourceKey) => key === "tds26as" ? (portal.tds26as ? `${portal.tds26as.deductors.length} deductors` : "") : Object.keys((portal[key] as { months?: object } | undefined)?.months ?? {}).sort().map(ym => new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })).join(", ");

  async function downloadReport() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const sum = [["360° audit", bizName, `FY ${report.fy.label.replace(/^FY\s*/i, "")}`], ["Score", `${report.score}/100`], [], ["Section", "Check", "Result", "Books", "Portal", "Difference", "Finding", "Law / rule"]];
    for (const s of SECTIONS) for (const c of report.checks.filter(x => x.section === s.key))
      sum.push([s.title, c.title, TONE[c.status].label, c.books ?? "", c.portal ?? "", c.diff ?? "", c.summary, c.law ?? ""] as never);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "Summary");
    const det = [["Section", "Check", "Entry", "Date", "Amount", "Detail"]];
    for (const c of report.checks) for (const it of c.items) det.push([SECTIONS.find(s => s.key === c.section)?.title ?? "", c.title, it.entry_no ?? "", it.date ?? "", it.amount ?? "", it.note] as never);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "Details");
    XLSX.writeFile(wb, `360-audit-${(bizName || "business").replace(/[^A-Za-z0-9]+/g, "-")}-FY${report.fy.label.replace(/^FY\s*/i, "")}.xlsx`);
  }

  const flip = (id: string) => setOpen(s => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const c = report?.counts;
  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18, overflow: "hidden" };
  const btn: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${HT.line}`, background: "#FFFFFF", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: HT.ink };

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow={`360° audit · ${bizName || "your business"}${fy ? ` · FY ${fy.label.replace(/^FY\s*/i, "")}` : ""}`}
        title={busy && !report ? "Auditing your books…" : report ? (report.counts.fail ? "Some things need fixing" : report.counts.warn ? "Mostly clean — a few things to check" : "Clean books") : "360° audit"}
        sub="Every check reads your posted entries; portal files are compared, not stored. Nothing is changed."
        actions={<span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
          <HeroFyPicker years={years} value={fy?.id ?? ""} onChange={setFy} />
          <HeroAction onClick={downloadReport} disabled={!report}>↓ Audit report (Excel)</HeroAction>
          <HeroAction onClick={() => setTick(t => t + 1)} primary disabled={busy}>{busy ? "Running…" : "Run again"}</HeroAction>
        </span>}
        tiles={report ? [
          { label: "Audit score", value: `${report.score}/100`, tone: report.score >= 85 ? "good" : report.score >= 60 ? "warn" : "bad" },
          { label: "Matched", value: String(c!.ok), tone: "good" },
          { label: "To check", value: String(c!.warn), tone: c!.warn ? "warn" : "plain" },
          { label: "Problems", value: String(c!.fail), tone: c!.fail ? "bad" : "plain" },
        ] : undefined} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        {err && <div role="alert" style={{ ...card, padding: "14px 18px", color: "#B4321F" }}>{err}</div>}

        {/* Portal files */}
        <section style={card} aria-labelledby="src-h">
          <div style={{ padding: "18px 22px 12px", borderBottom: `1px solid ${HT.line}` }}>
            <h2 id="src-h" style={{ margin: 0, fontSize: 22, fontWeight: 400, fontStyle: "italic" }}>Portal files</h2>
            <div style={{ fontSize: 13.5, color: HT.muted, marginTop: 2 }}>Download from the portal and add them here. They stay on this device for this year and are only used for the comparison.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
            {SOURCES.map(s => {
              const loaded = loadedMonths(s.key);
              return (
                <div key={s.key} style={{ padding: "16px 22px", borderTop: `1px solid ${HT.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: loaded ? "#12A06C" : "#C9C2B2" }} />
                    <b style={{ fontSize: 16 }}>{s.title}</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: HT.muted, lineHeight: 1.45 }}>{s.how}</div>
                  {loaded && <div style={{ fontSize: 13, color: "#0B7A55" }}>Loaded: {loaded}</div>}
                  {srcMsg[s.key] && <div role="status" style={{ fontSize: 13, color: srcMsg[s.key] === "Reading…" ? HT.muted : "#B4321F" }}>{srcMsg[s.key]}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input ref={el => { inputs.current[s.key] = el; }} type="file" accept={s.accept} multiple={s.multi} style={{ display: "none" }} onChange={e => { void upload(s.key, e.target.files); e.target.value = ""; }} />
                    <button type="button" style={btn} onClick={() => inputs.current[s.key]?.click()}>{loaded ? (s.multi ? "Add months" : "Replace") : "Upload"}</button>
                    {loaded && <button type="button" style={{ ...btn, color: "#B4321F" }} onClick={() => clear(s.key)}>Clear</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {busy && !report && <div style={{ ...card, padding: 22, fontStyle: "italic", color: HT.muted }}>Reading every entry for the year…</div>}

        {report && SECTIONS.map(s => {
          const list = report.checks.filter(x => x.section === s.key);
          if (!list.length) return null;
          return (
            <section key={s.key} style={card} aria-labelledby={`sec-${s.key}`}>
              <div style={{ padding: "18px 22px 12px", borderBottom: `1px solid ${HT.line}` }}>
                <h2 id={`sec-${s.key}`} style={{ margin: 0, fontSize: 22, fontWeight: 400, fontStyle: "italic" }}>{s.title}</h2>
                <div style={{ fontSize: 13.5, color: HT.muted, marginTop: 2 }}>{s.note}</div>
              </div>
              {list.map(x => {
                const t = TONE[x.status], isOpen = open.has(x.id), more = x.items.length > 0, figs = x.portal != null;
                return (
                  <div key={x.id} style={{ borderTop: `1px solid ${HT.line}` }}>
                    <button type="button" onClick={() => more && flip(x.id)} aria-expanded={more ? isOpen : undefined}
                      style={{ width: "100%", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, alignItems: "start", padding: "14px 22px", background: "transparent", border: "none", textAlign: "left", cursor: more ? "pointer" : "default", font: "inherit", color: "inherit" }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: t.dot, marginTop: 7 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{x.title}</span>
                        <span style={{ fontSize: 14, color: "#2E3B36" }}>{x.summary}</span>
                        {figs && (
                          <span style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                            <span><span style={{ color: HT.muted }}>Books </span><b>{inr(x.books ?? 0)}</b></span>
                            <span><span style={{ color: HT.muted }}>Portal </span><b>{inr(x.portal ?? 0)}</b></span>
                            <span><span style={{ color: HT.muted }}>Difference </span><b style={{ color: Math.abs(x.diff ?? 0) > 1 ? "#B4321F" : "#0B7A55" }}>{inr(x.diff ?? 0)}</b></span>
                          </span>
                        )}
                        {x.law && <span style={{ fontSize: 12, color: HT.muted, fontStyle: "italic" }}>{x.law}</span>}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label}</span>
                        {more && <span aria-hidden="true" style={{ color: HT.muted, fontSize: 12 }}>{isOpen ? "▲" : `${x.items.length} ▼`}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 22px 16px 46px", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
                          <thead><tr style={{ color: HT.muted, textAlign: "left" }}><th style={{ padding: "6px 8px" }}>Entry</th><th style={{ padding: "6px 8px" }}>Date</th><th style={{ padding: "6px 8px" }}>What</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Amount</th></tr></thead>
                          <tbody>
                            {x.items.map((it, i) => (
                              <tr key={i} style={{ borderTop: `1px solid ${HT.line}` }}>
                                <td style={{ padding: "7px 8px" }}>{it.journal_id ? <Link href={`/finance/journals?id=${it.journal_id}`} style={{ color: HT.ink, fontWeight: 700 }}>{it.entry_no}</Link> : "—"}</td>
                                <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{it.date ?? "—"}</td>
                                <td style={{ padding: "7px 8px" }}>{it.note}</td>
                                <td style={{ padding: "7px 8px", textAlign: "right" }}>{it.amount ? inr(it.amount) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
