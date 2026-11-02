"use client";
// 360° Audit — one checklist for the year: books integrity and cash / tax-law checks today; GSTR-1, GSTR-3B,
// GSTR-2B and 26AS / AIS (books against portal) come as further sections.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { useFinancialYear } from "@/lib/selectedFy";
import PageHero, { HeroAction, HeroFyPicker, HT, SERIF } from "@/components/finance/PageHero";
import type { AuditCheck, AuditStatus } from "@/lib/audit360";

type Report = { fy: { id: string; label: string }; checks: AuditCheck[]; score: number; counts: Record<AuditStatus, number> };

const TONE: Record<AuditStatus, { label: string; bg: string; fg: string; dot: string }> = {
  ok: { label: "Matched", bg: "#E3F3EC", fg: "#0B7A55", dot: "#12A06C" },
  warn: { label: "Check", bg: "#FBF1DA", fg: "#9A6B22", dot: "#D9A441" },
  fail: { label: "Problem", bg: "#FBE3DE", fg: "#B4321F", dot: "#D2492F" },
  na: { label: "Not checked", bg: "#EEF0EF", fg: "#6B7570", dot: "#A9B1AD" },
};
const SECTIONS: { key: AuditCheck["section"]; title: string; note: string }[] = [
  { key: "books", title: "Books integrity", note: "Do the books hold together — balanced, complete, nothing parked in suspense." },
  { key: "cash_law", title: "Cash and tax-law limits", note: "Cash transactions the Income-tax Act penalises or disallows." },
];
const COMING = ["GSTR-1 — sales in books vs portal", "GSTR-3B — tax paid and ITC claimed", "GSTR-2B — ITC in books vs suppliers' filings", "26AS / AIS — TDS and turnover vs books", "TDS you deducted and deposited"];
const inr = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function Audit360() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const { years, fy, setFy } = useFinancialYear(bizId);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

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

  useEffect(() => {
    if (!bizId || !fy) return;
    setBusy(true); setErr(""); setReport(null);
    fetch(`/api/finance/audit360?business_id=${bizId}&fy_id=${fy.id}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't run the audit."); else setReport(d as Report);
    }).catch(() => setErr("Couldn't run the audit.")).finally(() => setBusy(false));
  }, [bizId, fy, tick]);

  const flip = (id: string) => setOpen(s => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const c = report?.counts;
  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18, overflow: "hidden" };

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow={`360° audit · ${bizName || "your business"}${fy ? ` · FY ${fy.label.replace(/^FY\s*/i, "")}` : ""}`}
        title={busy ? "Auditing your books…" : report ? (report.counts.fail ? "Some things need fixing" : report.counts.warn ? "Mostly clean — a few things to check" : "Clean books") : "360° audit"}
        sub="Every check reads your posted entries. Nothing is changed."
        actions={<span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}><HeroFyPicker years={years} value={fy?.id ?? ""} onChange={setFy} /><HeroAction onClick={() => setTick(t => t + 1)} primary disabled={busy}>{busy ? "Running…" : "Run again"}</HeroAction></span>}
        tiles={report ? [
          { label: "Audit score", value: `${report.score}/100`, tone: report.score >= 85 ? "good" : report.score >= 60 ? "warn" : "bad" },
          { label: "Matched", value: String(c!.ok), tone: "good" },
          { label: "To check", value: String(c!.warn), tone: c!.warn ? "warn" : "plain" },
          { label: "Problems", value: String(c!.fail), tone: c!.fail ? "bad" : "plain" },
        ] : undefined} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        {err && <div role="alert" style={{ ...card, padding: "14px 18px", color: "#B4321F" }}>{err}</div>}
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
                const t = TONE[x.status], isOpen = open.has(x.id), more = x.items.length > 0;
                return (
                  <div key={x.id} style={{ borderTop: `1px solid ${HT.line}` }}>
                    <button type="button" onClick={() => more && flip(x.id)} aria-expanded={more ? isOpen : undefined}
                      style={{ width: "100%", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, alignItems: "start", padding: "14px 22px", background: "transparent", border: "none", textAlign: "left", cursor: more ? "pointer" : "default", font: "inherit", color: "inherit" }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: t.dot, marginTop: 7 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{x.title}</span>
                        <span style={{ fontSize: 14, color: "#2E3B36" }}>{x.summary}</span>
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

        {report && (
          <section style={{ ...card, padding: "18px 22px" }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontStyle: "italic" }}>Coming next — books against the portals</h2>
            <div style={{ fontSize: 13.5, color: HT.muted, margin: "4px 0 10px" }}>Each will show the figure in your books, the figure on the portal, and the difference.</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>{COMING.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
