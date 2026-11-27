"use client";
// 360° Audit — one checklist for the year: books integrity, cash / tax-law limits, and the books against the portals
// (GSTR-1, GSTR-3B, GSTR-2B, 26AS / AIS) plus TDS deducted. Portal files are read in this browser, kept on this
// device for the year, and sent only for the comparison — nothing is stored on the server or changed in the books.
import { useEffect, useRef, useState } from "react";
import { auditReportDoc } from "@/lib/auditReportDoc";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { useFinancialYear } from "@/lib/selectedFy";
import PageHero, { HeroAction, HeroFyPicker, HT, SERIF } from "@/components/finance/PageHero";
import type { AuditCheck, AuditStatus, AuditItem } from "@/lib/audit360";
import { fixFor, itemFix } from "@/lib/auditFix";
import { useTally } from "@/lib/tallyConnection";
import { pushToTally } from "@/lib/tallyPushRun";
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
  { key: "ca", title: "CA review — accounts and records", note: "What an auditor checks beyond the tax law: balances, depreciation, provisions, capital items, personal expenses and supporting records." },
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
  // ── Corrections: rectification entries, sent to Tally when it's connected ──
  const tally = useTally({ autoConnect: false });
  const [ledgers, setLedgers] = useState<{ id: string; name: string }[]>([]);
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [fixing, setFixing] = useState("");
  const [fixMsg, setFixMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!bizId) return;
    supabase.from("fw_fin_chart_of_accounts").select("id,name").eq("business_id", bizId).eq("is_group", false).order("name").limit(2000).then(({ data }) => setLedgers((data ?? []) as { id: string; name: string }[]));
  }, [bizId]);
  async function sendToTally(list: { id: string; date: string; entryNo: string }[]): Promise<string> {
    if (!bizId || !list.length) return "";
    if (tally.status !== "connected" || !tally.company) return " Tally isn't connected — push it from Books when Tally is open.";
    const r = await pushToTally({ bizId, ids: list.map(x => x.id), dates: Object.fromEntries(list.map(x => [x.id, x.date])), company: tally.company, port: tally.port, educational: tally.educational });
    return r.ok ? ` Sent to Tally (${tally.company}).` : ` Not sent to Tally: ${r.message}`;
  }
  const fixDate = () => { const t = new Date().toLocaleDateString("en-CA"); return fy ? (t > fy.end_date ? fy.end_date : t < fy.start_date ? fy.start_date : t) : t; };
  async function moveSuspense(it: AuditItem) {
    const to = moveTo[it.account_id ?? ""]; if (!bizId || !to || !it.account_id || !it.amount) return;
    const target = ledgers.find(l => l.id === to)?.name ?? "the ledger";
    if (!window.confirm(`Post a rectification entry moving ₹${Math.round(it.amount).toLocaleString("en-IN")} from ${it.account} to ${target}?`)) return;
    setFixing(it.account_id); setFixMsg(null);
    const amt = it.amount, date = fixDate();
    const lines = it.side === "dr" ? [{ account_id: to, dr: amt, cr: 0 }, { account_id: it.account_id, dr: 0, cr: amt }] : [{ account_id: it.account_id, dr: amt, cr: 0 }, { account_id: to, dr: 0, cr: amt }];
    const r = await fetch("/api/finance/journals/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, mode: "post", date, type: "journal", narration: `Rectification (360° audit): ${it.account} balance moved to ${target}`, source: "audit_fix", lines, metadata: { audit_fix: "suspense_nil" } }) });
    const d = await r.json().catch(() => ({}));
    setFixing("");
    if (!r.ok) { setFixMsg({ ok: false, text: d.error ?? "Couldn't post the correction." }); return; }
    const t = await sendToTally([{ id: d.id, date, entryNo: d.entry_no }]);
    setFixMsg({ ok: true, text: `✓ Posted ${d.entry_no}.${t}` }); setTick(x => x + 1);
  }
  async function reverseEntry(it: AuditItem, why: string) {
    if (!bizId || !it.journal_id) return;
    if (!window.confirm(`Reverse ${it.entry_no}? A reversal entry cancels it; the original stays in the books for the audit trail.`)) return;
    setFixing(it.journal_id); setFixMsg(null);
    const r = await fetch("/api/finance/journals/reverse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, journal_id: it.journal_id, reason: why }) });
    const d = await r.json().catch(() => ({}));
    setFixing("");
    if (!r.ok) { setFixMsg({ ok: false, text: d.error ?? "Couldn't reverse the entry." }); return; }
    const t = await sendToTally([{ id: d.reversal_id, date: it.date ?? fixDate(), entryNo: d.reversal_entry_no }]);
    setFixMsg({ ok: true, text: `✓ ${it.entry_no} reversed by ${d.reversal_entry_no}.${t}` }); setTick(x => x + 1);
  }
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [portal, setPortal] = useState<PortalData>({});
  const [files, setFiles] = useState<Record<SourceKey, string[]>>({ gstr1: [], gstr3b: [], gstr2b: [], tds26as: [] });
  const [srcMsg, setSrcMsg] = useState<Record<string, string>>({});
  const [shelfMsg, setShelfMsg] = useState("");

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
  // Returns already on the Shelf (GSTR-1, 3B, 2B, 26AS) for this year → the portal side of the audit. Files the user
  // uploaded here keep priority; the Shelf fills whatever is missing.
  async function fromShelf(auto = false) {
    if (!bizId || !fy) return;
    setShelfMsg("Reading the returns on the Shelf…");
    const r = await fetch("/api/finance/audit360/shelf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, fy: fy.label }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setShelfMsg(d.error ?? "Couldn't read the Shelf."); return; }
    const got = (d.files ?? []) as { title: string; kind: string; ok: boolean }[];
    if (!got.length) { setShelfMsg(auto ? "" : "No GSTR, 2B or 26AS files on the Shelf for this year."); return; }
    const sp = (d.portal ?? {}) as PortalData;
    const merged: PortalData = JSON.parse(JSON.stringify(portal));
    if (sp.gstr1) merged.gstr1 = { months: { ...sp.gstr1.months, ...(merged.gstr1?.months ?? {}) }, b2b: merged.gstr1?.b2b?.length ? merged.gstr1.b2b : sp.gstr1.b2b };
    if (sp.gstr3b) merged.gstr3b = { months: { ...sp.gstr3b.months, ...(merged.gstr3b?.months ?? {}) } };
    if (sp.gstr2b) merged.gstr2b = { months: { ...sp.gstr2b.months, ...(merged.gstr2b?.months ?? {}) }, suppliers: merged.gstr2b?.suppliers?.length ? merged.gstr2b.suppliers : sp.gstr2b.suppliers };
    if (sp.tds26as && !merged.tds26as) merged.tds26as = sp.tds26as;
    const add = (k: SourceKey) => [...new Set([...(files[k] ?? []), ...got.filter(g => g.kind === k && g.ok).map(g => "Shelf: " + g.title)])];
    save(merged, { gstr1: add("gstr1"), gstr3b: add("gstr3b"), gstr2b: add("gstr2b"), tds26as: add("tds26as") });
    const bad = got.filter(g => !g.ok).length;
    setShelfMsg(`✓ Used ${got.length - bad} return${got.length - bad === 1 ? "" : "s"} from the Shelf${bad ? ` · ${bad} couldn't be read` : ""}.`);
  }
  // First visit for a year with nothing uploaded: use the Shelf automatically
  const shelfTried = useRef("");
  useEffect(() => {
    if (!memKey || shelfTried.current === memKey) return;
    const t = setTimeout(() => { shelfTried.current = memKey; if (!Object.keys(portal).length) void fromShelf(true); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memKey, portal]);

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
    const ws1 = XLSX.utils.aoa_to_sheet(sum);
    ws1["!cols"] = [{ wch: 26 }, { wch: 38 }, { wch: 13 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 70 }, { wch: 70 }];
    ws1["!freeze"] = { xSplit: 0, ySplit: 4 };
    for (const [addr, cell] of Object.entries(ws1)) if (!addr.startsWith("!") && typeof (cell as { v?: unknown }).v === "number" && /^[DEF]\d/.test(addr)) (cell as { z?: string }).z = "#,##,##0;[Red]-#,##,##0;\"\"";
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");
    const det = [["Section", "Check", "Entry", "Date", "Amount", "Detail"]];
    for (const c of report.checks) for (const it of c.items) det.push([SECTIONS.find(s => s.key === c.section)?.title ?? "", c.title, it.entry_no ?? "", it.date ?? "", it.amount ?? "", it.note] as never);
    const ws2 = XLSX.utils.aoa_to_sheet(det);
    ws2["!cols"] = [{ wch: 26 }, { wch: 38 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 90 }];
    for (const [addr, cell] of Object.entries(ws2)) if (!addr.startsWith("!") && typeof (cell as { v?: unknown }).v === "number" && /^E\d/.test(addr)) (cell as { z?: string }).z = "#,##,##0.00";
    XLSX.utils.book_append_sheet(wb, ws2, "Details");
    XLSX.writeFile(wb, `360-audit-${(bizName || "business").replace(/[^A-Za-z0-9]+/g, "-")}-FY${report.fy.label.replace(/^FY\s*/i, "")}.xlsx`);
  }

  function downloadDoc() {
    if (!report) return;
    const blob = auditReportDoc({ business: bizName || "Business", fy: `FY ${report.fy.label.replace(/^FY\s*/i, "")}`, score: report.score, counts: report.counts, checks: report.checks, sections: SECTIONS });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `360-audit-${(bizName || "business").replace(/[^A-Za-z0-9]+/g, "-")}-FY${report.fy.label.replace(/^FY\s*/i, "")}.doc`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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
          <HeroAction onClick={() => void fromShelf()} disabled={!fy}>📚 Use returns on the Shelf</HeroAction>
          <HeroAction onClick={downloadDoc} disabled={!report}>↓ Report (Word)</HeroAction>
          <HeroAction onClick={downloadReport} disabled={!report}>↓ Excel</HeroAction>
          <HeroAction onClick={() => setTick(t => t + 1)} primary disabled={busy}>{busy ? "Running…" : "Run again"}</HeroAction>
        </span>}
        overlap={report ? 90 : 0} />

      <style>{`.a3-wrap{max-width:1240px;margin:0 auto;padding:0 clamp(14px,3vw,28px) 70px;display:flex;flex-direction:column;gap:26px}
        .a3-score{display:grid;grid-template-columns:auto minmax(0,1fr);gap:32px;align-items:center;background:${HT.paper};border:1px solid ${HT.line};border-radius:26px;padding:28px 34px;box-shadow:0 24px 50px -30px rgba(16,36,31,.55)}
        @media(max-width:760px){.a3-score{grid-template-columns:1fr}}
        .a3-kp{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .a3-k{border-radius:16px;padding:16px 20px;border:1px solid ${HT.line}}
        .a3-nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
        .a3-nav a{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;border:1px solid ${HT.line};background:#FFFFFF;color:${HT.ink};text-decoration:none;font-size:15.5px}
        .a3-nav a:hover{border-color:${HT.gold}}
        .a3-card{background:${HT.paper};border:1px solid ${HT.line};border-radius:24px;overflow:hidden}
        .a3-head{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;padding:28px 32px 22px;border-bottom:1px solid ${HT.line}}
        .a3-head h2{margin:0;font-size:clamp(28px,3vw,36px);font-weight:400;font-style:italic}
        .a3-src{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;padding:24px 28px 28px}
        .a3-sc{border:1px solid ${HT.line};border-radius:18px;padding:20px 22px;display:flex;flex-direction:column;gap:12px;background:#FFFFFF}
        .a3-mo{display:inline-block;padding:4px 10px;border-radius:8px;background:#E6F1EC;color:#245E48;font-size:14px;margin:0 6px 6px 0}
        .a3-b{height:44px;padding:0 20px;border-radius:999px;border:1px solid #D9C79A;background:#FFFFFF;cursor:pointer;font:inherit;font-size:16px;color:${HT.ink}}
        .a3-b:hover{border-color:${HT.gold}}
        .a3-row{display:grid;grid-template-columns:6px minmax(0,1fr) auto;gap:22px;align-items:start;width:100%;padding:24px 32px 24px 0;background:transparent;border:none;text-align:left;font:inherit;color:inherit}
        .a3-row:hover{background:#FBF7EE}
        .a3-fig{display:inline-flex;flex-direction:column;padding:10px 16px;border-radius:12px;background:#F6F1E6;min-width:130px}
        .a3-fig small{font-size:13px;color:${HT.muted}}.a3-fig b{font-weight:400;font-size:18px}`}</style>
      <div className="a3-wrap">
        {report && c && (
          <section className="a3-score" style={{ marginTop: -90 }} aria-label="Audit score">
            <div style={{ position: "relative", width: 150, height: 150, justifySelf: "center" }}>
              <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="64" fill="none" stroke="#EFE8DA" strokeWidth="12" /><circle cx="75" cy="75" r="64" fill="none" stroke={report.score >= 85 ? "#2F7A57" : report.score >= 60 ? "#C9A24A" : "#B23A20"} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(report.score / 100) * 402} 402`} transform="rotate(-90 75 75)" /></svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><span><span style={{ display: "block", fontSize: 44, lineHeight: 1 }}>{report.score}</span><span style={{ fontSize: 14, color: HT.muted }}>out of 100</span></span></div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, letterSpacing: ".24em", textTransform: "uppercase", color: HT.goldInk }}>Audit score</div>
              <div style={{ fontSize: "clamp(22px,2.4vw,30px)", margin: "6px 0 16px" }}>{c.fail ? <>Fix the <i style={{ color: "#B23A20" }}>{c.fail} problem{c.fail === 1 ? "" : "s"}</i> first, then check the rest.</> : c.warn ? <>No problems. <i style={{ color: HT.goldInk }}>{c.warn} thing{c.warn === 1 ? "" : "s"} to check.</i></> : <>Everything <i style={{ color: "#2F7A57" }}>matches.</i></>}</div>
              <div className="a3-kp">
                {[["Matched", c.ok, "#2F7A57", "#EEF6F1"], ["To check", c.warn, "#9A6B22", "#FBF3E2"], ["Problems", c.fail, "#B23A20", "#FBEDE8"]].map(([l, v, fg, bg]) => (
                  <div key={String(l)} className="a3-k" style={{ background: Number(v) ? String(bg) : "#FFFFFF" }}><div style={{ fontSize: 15, color: HT.muted }}>{l}</div><div style={{ fontSize: 32, color: Number(v) ? String(fg) : HT.ink }}>{v}</div></div>
                ))}
              </div>
              <nav className="a3-nav" aria-label="Jump to a section">
                {SECTIONS.map(sec => { const l = report.checks.filter(x => x.section === sec.key); if (!l.length) return null; const bad = l.filter(x => x.status === "fail").length, w = l.filter(x => x.status === "warn").length;
                  return <a key={sec.key} href={`#sec-${sec.key}`}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: bad ? "#B23A20" : w ? "#C9A24A" : "#2F7A57" }} />{sec.title}</a>; })}
              </nav>
            </div>
          </section>
        )}
        {fixMsg && <div role="status" style={{ ...card, padding: "12px 18px", color: fixMsg.ok ? "#0B5E42" : "#B4321F" }}>{fixMsg.text}</div>}
        {shelfMsg && <div role="status" style={{ ...card, padding: "12px 18px", color: shelfMsg.startsWith("✓") ? "#0B5E42" : "#5E6B66" }}>{shelfMsg}</div>}
        {err && <div role="alert" style={{ ...card, padding: "14px 18px", color: "#B4321F" }}>{err}</div>}

        {/* Portal files */}
        <section className="a3-card" aria-labelledby="src-h">
          <div className="a3-head">
            <div style={{ marginRight: "auto" }}>
              <h2 id="src-h">Portal files</h2>
              <div style={{ fontSize: 16.5, color: HT.muted, marginTop: 6 }}>Download from the portal and add them here. They stay on this device for this year and are only used for the comparison.</div>
            </div>
            <span style={{ fontSize: 15.5, color: HT.muted }}>{SOURCES.filter(x => loadedMonths(x.key)).length} of {SOURCES.length} added</span>
          </div>
          <div className="a3-src">
            {SOURCES.map(s => {
              const loaded = loadedMonths(s.key);
              return (
                <div key={s.key} className="a3-sc">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 21, marginRight: "auto" }}>{s.title}</span>
                    <span style={{ fontSize: 13.5, padding: "4px 12px", borderRadius: 999, background: loaded ? "#E6F1EC" : "#F1EADB", color: loaded ? "#245E48" : HT.muted }}>{loaded ? "Added" : "Not added"}</span>
                  </div>
                  <div style={{ fontSize: 14.5, color: HT.muted, lineHeight: 1.55 }}>{s.how}</div>
                  {loaded && <div>{String(loaded).split(/,\s*/).map(m => <span key={m} className="a3-mo">{m}</span>)}</div>}
                  {srcMsg[s.key] && <div role="status" style={{ fontSize: 14, color: srcMsg[s.key] === "Reading…" ? HT.muted : "#B4321F" }}>{srcMsg[s.key]}</div>}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
                    <input ref={el => { inputs.current[s.key] = el; }} type="file" accept={s.accept} multiple={s.multi} style={{ display: "none" }} onChange={e => { void upload(s.key, e.target.files); e.target.value = ""; }} />
                    <button type="button" className="a3-b" style={loaded ? undefined : { background: "linear-gradient(160deg,#DDBE78,#C9A24A)", border: "none" }} onClick={() => inputs.current[s.key]?.click()}>{loaded ? (s.multi ? "Add months" : "Replace") : "Upload"}</button>
                    {loaded && <button type="button" className="a3-b" style={{ color: "#B4321F", borderColor: "#F0CFC5" }} onClick={() => clear(s.key)}>Clear</button>}
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
            <section key={s.key} id={`sec-${s.key}`} className="a3-card" style={{ scrollMarginTop: 20 }} aria-labelledby={`sec-h-${s.key}`}>
              <div className="a3-head">
                <div style={{ marginRight: "auto" }}>
                  <h2 id={`sec-h-${s.key}`}>{s.title}</h2>
                  <div style={{ fontSize: 16.5, color: HT.muted, marginTop: 6 }}>{s.note}</div>
                </div>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(["fail", "warn", "ok"] as const).map(k => { const n = list.filter(x => x.status === k).length; return n ? <span key={k} style={{ fontSize: 14, padding: "5px 12px", borderRadius: 999, background: TONE[k].bg, color: TONE[k].fg }}>{n} {TONE[k].label.toLowerCase()}</span> : null; })}</span>
              </div>
              {list.map(x => {
                const t = TONE[x.status], isOpen = open.has(x.id), more = x.items.length > 0, figs = x.portal != null;
                return (
                  <div key={x.id} style={{ borderTop: `1px solid ${HT.line}` }}>
                    <button type="button" onClick={() => more && flip(x.id)} aria-expanded={more ? isOpen : undefined} className="a3-row" style={{ cursor: more ? "pointer" : "default" }}>
                      <span aria-hidden="true" style={{ alignSelf: "stretch", borderRadius: "0 4px 4px 0", background: t.dot, minHeight: 40 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 20 }}>{x.title}</span>
                        <span style={{ fontSize: 16, color: "#3A4843", lineHeight: 1.55 }}>{x.summary}</span>
                        {figs && (
                          <span style={{ display: "flex", gap: 12, flexWrap: "wrap", fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
                            <span className="a3-fig"><small>Books</small><b>{inr(x.books ?? 0)}</b></span>
                            <span className="a3-fig"><small>Portal</small><b>{inr(x.portal ?? 0)}</b></span>
                            <span className="a3-fig" style={{ background: Math.abs(x.diff ?? 0) > 1 ? "#FBEDE8" : "#EEF6F1" }}><small>Difference</small><b style={{ color: Math.abs(x.diff ?? 0) > 1 ? "#B23A20" : "#2F7A57" }}>{inr(x.diff ?? 0)}</b></span>
                          </span>
                        )}
                        {x.law && <span style={{ fontSize: 14, color: HT.muted, fontStyle: "italic" }}>{x.law}</span>}
                        {(() => { const f = fixFor(x); return f ? (
                          <span style={{ marginTop: 8, padding: "12px 16px", borderRadius: 14, background: "#F8EEDA", border: "1px solid #EBD9B0", fontSize: 15, color: "#4A3A12", display: "block", lineHeight: 1.55 }}>
                            <b style={{ color: "#8A6420" }}>Suggested correction · </b>{f.text}
                            {f.href && <> <a href={f.href} onClick={e => e.stopPropagation()} style={{ color: "#8A6420", fontWeight: 700 }}>{f.cta} →</a></>}
                          </span>) : null; })()}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, padding: "6px 14px", borderRadius: 999, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label}</span>
                        {more && <span aria-hidden="true" style={{ color: HT.muted, fontSize: 14, whiteSpace: "nowrap" }}>{isOpen ? "Hide ▲" : `${x.items.length} ▼`}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 32px 22px 28px", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, fontVariantNumeric: "tabular-nums", background: "#FFFFFF", border: `1px solid ${HT.line}`, borderRadius: 14 }}>
                          <thead><tr style={{ color: HT.muted, textAlign: "left" }}><th style={{ padding: "6px 8px" }}>Entry</th><th style={{ padding: "6px 8px" }}>Date</th><th style={{ padding: "6px 8px" }}>What</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Amount</th><th style={{ padding: "6px 8px" }}>Correct</th></tr></thead>
                          <tbody>
                            {x.items.map((it, i) => (
                              <tr key={i} style={{ borderTop: `1px solid ${HT.line}` }}>
                                <td style={{ padding: "7px 8px" }}>{it.journal_id ? <Link href={`/finance/entry/${it.journal_id}`} style={{ color: HT.ink, fontWeight: 700 }}>{it.entry_no}</Link> : "—"}</td>
                                <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{it.date ?? "—"}</td>
                                <td style={{ padding: "7px 8px" }}>{it.note}</td>
                                <td style={{ padding: "7px 8px", textAlign: "right" }}>{it.amount ? inr(it.amount) : "—"}</td>
                                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{(() => {
                                  const k = itemFix(x.id, it), b: React.CSSProperties = { height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid #E6DFD0", background: "#FFFFFF", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: HT.ink };
                                  if (k === "reclass") return (<span style={{ display: "inline-flex", gap: 6 }}>
                                    <select aria-label="Move to ledger" value={moveTo[it.account_id!] ?? ""} onChange={e => setMoveTo(m => ({ ...m, [it.account_id!]: e.target.value }))} style={{ height: 30, borderRadius: 8, border: "1px solid #E6DFD0", maxWidth: 180, fontFamily: "inherit" }}>
                                      <option value="">Move to…</option>{ledgers.filter(l => l.id !== it.account_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                    <button type="button" disabled={!moveTo[it.account_id!] || fixing === it.account_id} onClick={() => moveSuspense(it)} style={{ ...b, background: "#12352D", color: "#FFFFFF", borderColor: "#12352D" }}>{fixing === it.account_id ? "Posting…" : "Move"}</button>
                                  </span>);
                                  if (k === "reverse") return <button type="button" disabled={fixing === it.journal_id} onClick={() => reverseEntry(it, x.id === "duplicates" ? "Duplicate entry (360° audit)" : "Wrong date (360° audit)")} style={b}>{fixing === it.journal_id ? "Reversing…" : "Reverse"}</button>;
                                  if (k === "open") return <Link href={`/finance/entry/${it.journal_id}`} style={{ ...b, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Open to fix</Link>;
                                  return <span style={{ color: HT.muted }}>—</span>;
                                })()}</td>
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
