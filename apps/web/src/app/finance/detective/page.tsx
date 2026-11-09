"use client";
// FreBook Accounting Detective — exceptions found in the books, bank reconciliation, missing documents and client
// follow-ups, correction proposals that post only after approval, and the tax-rule registry the checks use.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";
import { STATUS_LABEL, canMove, type ExStatus } from "@/lib/assurance/workflow";
import type { Suggestion } from "@/lib/assurance/bankRecon";
import type { TaxRule } from "@/lib/assurance/taxRules";

type Ex = { id: string; rule_id: string; category: string; priority: "high" | "medium" | "low"; confidence: string; txn_date: string | null; amount: number | null; ledger: string | null; party: string | null;
  title: string; description: string; evidence: { label: string; value: string; journalId?: string }[]; provision: string | null; suggested_action: string | null; journal_ids: string[];
  assigned_to: string | null; status: ExStatus; history: { at: string; from: string | null; to: string; note: string | null }[]; ai_note: string | null };
type Req = { id: string; exception_id: string | null; journal_id: string | null; party: string | null; txn_date: string | null; amount: number | null; doc_kind: string; message: string; status: string; validation: { ok: boolean; checks: { label: string; ok: boolean; detail: string }[] } | null; remind_count: number; last_reminded_at: string | null; assigned_to: string | null };
type Corr = { id: string; exception_id: string | null; journal_id: string; reason: string; lines: { account: string; dr: number; cr: number }[]; explanation: string; tax_note: string; status: string; proposed_at: string; decision_note: string | null; posted_journal_id: string | null };
type Overview = { summary: Record<string, number>; exceptions: Ex[]; requests: Req[]; corrections: Corr[]; rules: TaxRule[]; team: { email: string; role: string }[]; business: string; reminders: { due: number; overdue: number }; needsMigration?: boolean; error?: string };
type Group = { party: string; ids: string[]; count: number; contact: { phone?: string | null; email?: string | null } | null; whatsapp: { body: string } | null; email: { subject: string; body: string } | null };

const inr = (n: number | null | undefined) => n == null ? "—" : "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const PRI = { high: { bg: "#FBE3DE", fg: "#B4321F", label: "High" }, medium: { bg: "#FBF1DA", fg: "#9A6B22", label: "Medium" }, low: { bg: "#E8EEF6", fg: "#3C5A85", label: "Low" } };
const CONF: Record<string, string> = { definite: "Definite — from the figures", likely: "Likely — a pattern, check it", requires_review: "Requires review — depends on facts not in FreBook" };
const CAT: Record<string, string> = { missing_entry: "Missing entry", missing_document: "Missing document", duplicate: "Possible duplicate", classification: "Classification", balance: "Balance", advance: "Advance", ageing: "Old outstanding", unusual: "Unusual amount", integrity: "Integrity", period: "Period", gst: "GST", tds: "TDS", income_tax: "Income tax", bank: "Bank" };
const FILTERS: { key: string; label: string; test: (e: Ex) => boolean }[] = [
  { key: "open", label: "Unresolved", test: e => !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "high", label: "High priority", test: e => e.priority === "high" && !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "docs", label: "Missing invoices & documents", test: e => ["missing_document", "missing_entry"].includes(e.category) && !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "bank", label: "Unbooked bank lines", test: e => e.category === "bank" && !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "dup", label: "Possible duplicates", test: e => e.category === "duplicate" && !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "tax", label: "GST & TDS", test: e => ["gst", "tds", "income_tax"].includes(e.category) && !["resolved", "rejected", "false_positive"].includes(e.status) },
  { key: "approval", label: "Awaiting approval", test: e => e.status === "awaiting_approval" },
  { key: "closed", label: "Resolved & closed", test: e => ["resolved", "rejected", "false_positive"].includes(e.status) },
];
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 16, padding: 18 };
const btn = (primary?: boolean): React.CSSProperties => ({ height: 34, padding: "0 14px", borderRadius: 999, border: primary ? "none" : `1px solid ${HT.line}`, background: primary ? HT.green : "#FFFFFF", color: primary ? "#FFFFFF" : HT.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" });

export default function Detective() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [tab, setTab] = useState<"issues" | "bank" | "docs" | "fix" | "rules">("issues");
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [filter, setFilter] = useState("open"); const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recon, setRecon] = useState<{ suggestions: Suggestion[]; counts: Record<string, number>; matched: { bank_journal_id: string; bank?: string; doc?: string; allocated: number }[] } | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [fixFor, setFixFor] = useState<Ex | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!id) { router.push("/finance/setup"); return; }
      setBizId(id);
    });
  }, [router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    const r = await fetch(`/api/finance/detective?business_id=${bizId}`); const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error ?? "Couldn't load."); else setData(d);
  }, [bizId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!bizId) return;
    if (tab === "bank" && !recon) fetch(`/api/finance/detective?business_id=${bizId}&view=recon`).then(r => r.json()).then(d => d.error ? setErr(d.error) : setRecon(d)).catch(() => setErr("Couldn't load reconciliation."));
    if (tab === "docs" && !groups) fetch(`/api/finance/detective?business_id=${bizId}&view=followup`).then(r => r.json()).then(d => setGroups(d.groups ?? [])).catch(() => null);
  }, [tab, bizId, recon, groups]);

  async function act(body: Record<string, unknown>, done?: string) {
    setErr(""); setMsg("");
    const r = await fetch("/api/finance/detective", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error ?? "That didn't work."); return null; }
    if (done) setMsg(done);
    await load(); return d;
  }
  async function scan() {
    setBusy("scan"); const d = await act({ action: "scan" }); setBusy("");
    if (d) { setMsg(`Scan of FY ${d.fy}: ${d.found} issue${d.found === 1 ? "" : "s"} found — ${d.added} new, ${d.updated} still open, ${d.autoResolved} cleared since the last scan.`); setRecon(null); setGroups(null); }
  }

  const list = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter)!; const s = q.trim().toLowerCase();
    return (data?.exceptions ?? []).filter(f.test).filter(e => !s || `${e.title} ${e.party ?? ""} ${e.ledger ?? ""} ${e.description}`.toLowerCase().includes(s));
  }, [data, filter, q]);
  const s = data?.summary ?? {};

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <style>{`.dt-row{transition:background .12s}.dt-row:hover{background:#FBF7EE}.dt-chip{height:32px;padding:0 13px;border-radius:999px;border:1px solid ${HT.line};background:#fff;font-size:13px;cursor:pointer;white-space:nowrap}.dt-chip.on{background:${HT.green};color:#fff;border-color:${HT.green}}
      .dt-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}@media(max-width:900px){.dt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid ${HT.gold};outline-offset:2px}`}</style>
      <PageHero eyebrow="FreBook · Assurance" title="Accounting" accent="Detective"
        sub="Finds missing entries, missing bills, duplicates, odd balances and GST/TDS risks in your books. Rules decide what's certain; anything that depends on facts FreBook doesn't have is marked for review. Nothing is changed without your approval."
        actions={<><HeroAction primary onClick={scan} disabled={!!busy || !!data?.needsMigration}>{busy === "scan" ? "Scanning the books…" : "Run scan"}</HeroAction><HeroAction href="/finance/audit360">360° audit</HeroAction></>}
        tiles={[
          { label: "Unresolved", value: s.unresolved ?? 0, sub: `${s.high ?? 0} high · ${s.medium ?? 0} medium · ${s.low ?? 0} low`, tone: (s.high ?? 0) > 0 ? "bad" : "plain" },
          { label: "Missing bills / entries", value: s.missingDocs ?? 0, tone: (s.missingDocs ?? 0) ? "warn" : "good" },
          { label: "Possible duplicates", value: s.duplicates ?? 0, tone: (s.duplicates ?? 0) ? "warn" : "good" },
          { label: "GST & TDS", value: s.tax ?? 0, tone: (s.tax ?? 0) ? "warn" : "good" },
          { label: "Awaiting approval", value: s.approvals ?? 0, sub: `${s.resolved ?? 0} resolved` },
        ]}
        tabs={[
          { label: "Issues", onClick: () => setTab("issues"), active: tab === "issues", count: s.unresolved },
          { label: "Bank reconciliation", onClick: () => setTab("bank"), active: tab === "bank" },
          { label: "Documents & follow-ups", onClick: () => setTab("docs"), active: tab === "docs", count: (data?.requests ?? []).filter(r => r.status === "open" || r.status === "insufficient").length },
          { label: "Corrections", onClick: () => setTab("fix"), active: tab === "fix", count: s.approvals },
          { label: "Tax rules", onClick: () => setTab("rules"), active: tab === "rules" },
        ]} />

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        {data?.needsMigration && <div role="alert" style={{ ...card, background: "#FBF1DA", borderColor: "#E8CF95" }}><b>One-time setup:</b> run <code>2026-11-09_assurance.sql</code> in Supabase → SQL editor. It adds five new tables and changes nothing in your books.</div>}
        {err && <div role="alert" style={{ ...card, background: "#FBE3DE", borderColor: "#EDB7AA", color: "#8A2A1A" }}>{err}</div>}
        {msg && <div role="status" style={{ ...card, background: "#E3F3EC", borderColor: "#B9DFCC", color: "#0B5E42" }}>{msg}</div>}

        {tab === "issues" && <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {FILTERS.map(f => <button key={f.key} className={`dt-chip${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>{f.label} · {(data?.exceptions ?? []).filter(f.test).length}</button>)}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search party, ledger…" aria-label="Search issues" style={{ marginLeft: "auto", height: 34, borderRadius: 999, border: `1px solid ${HT.line}`, padding: "0 14px", minWidth: 200, fontFamily: "inherit" }} />
          </div>
          {data && !data.exceptions.length && !data.needsMigration && <div style={{ ...card, textAlign: "center", padding: 40 }}><div style={{ fontSize: 20, fontStyle: "italic" }}>No scan yet</div><p style={{ color: HT.muted }}>Press <b>Run scan</b> to check this year's books.</p></div>}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {list.map(e => <IssueRow key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} team={data!.team} act={act} onFix={() => { setFixFor(e); }} />)}
            {data && data.exceptions.length > 0 && !list.length && <div style={{ padding: 30, textAlign: "center", color: HT.muted }}>Nothing in this view.</div>}
          </div>
        </>}

        {tab === "bank" && <BankTab recon={recon} act={async b => { const d = await act(b); if (d) setRecon(null); }} />}
        {tab === "docs" && <DocsTab bizId={bizId!} reqs={data?.requests ?? []} groups={groups} reminders={data?.reminders} act={act} reload={async () => { setGroups(null); await load(); }} />}
        {tab === "fix" && <FixTab corr={data?.corrections ?? []} act={act} />}
        {tab === "rules" && <RulesTab rules={data?.rules ?? []} act={act} />}
      </main>
      {fixFor && bizId && <ProposeFix bizId={bizId} ex={fixFor} onClose={() => setFixFor(null)} act={async b => { const d = await act(b, "Correction sent for approval — see Corrections."); if (d) setFixFor(null); }} />}
    </div>
  );
}

function IssueRow({ e, open, onToggle, team, act, onFix }: { e: Ex; open: boolean; onToggle: () => void; team: Overview["team"]; act: (b: Record<string, unknown>, done?: string) => Promise<unknown>; onFix: () => void }) {
  const p = PRI[e.priority]; const [note, setNote] = useState(""); const [explaining, setExplaining] = useState(false);
  const next = (["under_review", "awaiting_documents", "resolved", "false_positive", "rejected", "reopened"] as ExStatus[]).filter(t => canMove(e.status, t));
  return (
    <div className="dt-row" style={{ borderBottom: `1px solid ${HT.line}` }}>
      <button onClick={onToggle} aria-expanded={open} style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, padding: "14px 18px", width: "calc(100% - 36px)", alignItems: "center" }}>
        <span style={{ background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999, letterSpacing: "0.04em" }}>{p.label}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15.5, fontWeight: 700 }}>{e.title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: HT.muted, marginTop: 2 }}>{CAT[e.category] ?? e.category} · {e.txn_date ?? "—"}{e.party ? ` · ${e.party}` : ""}{e.assigned_to ? ` · ${e.assigned_to}` : ""}</span>
        </span>
        <span style={{ textAlign: "right" }}>
          <span style={{ display: "block", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{inr(e.amount)}</span>
          <span style={{ display: "block", fontSize: 12, color: HT.goldInk }}>{STATUS_LABEL[e.status]}</span>
        </span>
      </button>
      {open && <div style={{ padding: "0 18px 18px 18px", display: "grid", gap: 12 }}>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{e.description}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {e.evidence.map((x, i) => <span key={i} style={{ background: "#F3EDE1", borderRadius: 10, padding: "6px 10px", fontSize: 13 }}><b>{x.label}:</b> {x.journalId ? <Link href={`/finance/journals?id=${x.journalId}`}>{x.value}</Link> : x.value}</span>)}
        </div>
        <div style={{ fontSize: 13, color: HT.muted }}><b>Rule</b> {e.rule_id}{e.provision ? ` · ${e.provision}` : ""} · <b>Evidence</b> {CONF[e.confidence]}</div>
        {e.suggested_action && <div style={{ fontSize: 14 }}><b>Suggested:</b> {e.suggested_action}</div>}
        {e.ai_note ? <div style={{ background: "#EEF4F1", borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.55 }}><b>AI view (advice only):</b> {e.ai_note}</div>
          : <button style={{ ...btn(), justifySelf: "start" }} disabled={explaining} onClick={async () => { setExplaining(true); await act({ action: "explain", id: e.id }); setExplaining(false); }}>{explaining ? "Thinking…" : "Explain with AI"}</button>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={note} onChange={x => setNote(x.target.value)} placeholder="Note (needed to reject or mark false positive)" aria-label="Note" style={{ flex: "1 1 240px", height: 34, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontFamily: "inherit" }} />
          {next.map(t => <button key={t} style={btn(t === "resolved")} onClick={() => act({ action: "status", id: e.id, to: t, note }, `Marked ${STATUS_LABEL[t].toLowerCase()}.`)}>{STATUS_LABEL[t]}</button>)}
          {e.journal_ids.length > 0 && !["resolved", "rejected", "false_positive", "awaiting_approval"].includes(e.status) && <button style={btn(true)} onClick={onFix}>Propose correction</button>}
          <select aria-label="Assign to" value={e.assigned_to ?? ""} onChange={x => act({ action: "assign", id: e.id, email: x.target.value }, "Assigned.")} style={{ height: 34, borderRadius: 10, border: `1px solid ${HT.line}`, fontFamily: "inherit" }}>
            <option value="">Unassigned</option>{team.map(t => <option key={t.email} value={t.email}>{t.email} ({t.role})</option>)}
          </select>
        </div>
        {e.history?.length > 0 && <details><summary style={{ cursor: "pointer", fontSize: 13, color: HT.muted }}>History ({e.history.length})</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>{e.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("en-IN")}: {h.from ? `${STATUS_LABEL[h.from as ExStatus] ?? h.from} → ` : ""}{STATUS_LABEL[h.to as ExStatus] ?? h.to}{h.note ? ` — ${h.note}` : ""}</li>)}</ul></details>}
      </div>}
    </div>
  );
}

function BankTab({ recon, act }: { recon: { suggestions: Suggestion[]; counts: Record<string, number>; matched: { bank_journal_id: string; bank?: string; doc?: string; allocated: number }[] } | null; act: (b: Record<string, unknown>) => Promise<void> }) {
  const [cls, setCls] = useState("all");
  if (!recon) return <div style={card}>Comparing bank entries with invoices and bills…</div>;
  const LBL: Record<string, string> = { exact: "Exact match", probable: "Probable match", multiple: "Several possible", unmatched: "Unmatched", clarify: "Needs clarification" };
  const rows = recon.suggestions.filter(x => cls === "all" || x.cls === cls);
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={`dt-chip${cls === "all" ? " on" : ""}`} onClick={() => setCls("all")}>All · {recon.suggestions.length}</button>
      {Object.keys(LBL).map(k => <button key={k} className={`dt-chip${cls === k ? " on" : ""}`} onClick={() => setCls(k)}>{LBL[k]} · {recon.counts[k] ?? 0}</button>)}
    </div>
    <p style={{ margin: 0, color: HT.muted, fontSize: 14 }}>Each bank entry is compared with unpaid invoices and bills. Nothing is matched until you confirm, and you can unmatch any time.</p>
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map(sg => <div key={sg.line.journalId} style={card}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <b style={{ fontSize: 15.5 }}>{sg.line.direction === "in" ? "Received" : "Paid"} {inr(sg.line.amount)}</b>
          <span style={{ color: HT.muted, fontSize: 13 }}>{sg.line.date} · {sg.line.bank} · {sg.line.entryNo}{sg.line.party ? ` · ${sg.line.party}` : ""}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: sg.cls === "exact" ? "#0B7A55" : sg.cls === "unmatched" ? "#B4321F" : HT.goldInk }}>{LBL[sg.cls]}</span>
        </div>
        <div style={{ fontSize: 13, color: HT.muted, margin: "4px 0 8px" }}>{sg.line.narration.slice(0, 140)} — {sg.note}</div>
        {sg.candidates.map((c, i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: `1px dashed ${HT.line}`, paddingTop: 8, marginTop: 8 }}>
          <span style={{ fontWeight: 700 }}>{c.items.map(x => `${x.entryNo} (${inr(x.allocate)})`).join(" + ")}</span>
          <span style={{ fontSize: 12.5, color: HT.muted, flex: 1 }}>{c.evidence.map(e => `${e.factor}: ${e.detail}`).join(" · ")}{c.charges ? ` · charges ${inr(c.charges)}` : ""}</span>
          <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>score {c.score}</span>
          <button style={btn(true)} onClick={() => act({ action: "match", bank_journal_id: sg.line.journalId, amount: sg.line.amount, charges: c.charges, items: c.items, evidence: c.evidence })}>Confirm</button>
        </div>)}
      </div>)}
      {!rows.length && <div style={{ ...card, color: HT.muted }}>Nothing here.</div>}
    </div>
    {recon.matched.length > 0 && <div style={card}><b>Confirmed matches</b>
      {recon.matched.map((m, i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, fontSize: 14 }}>
        <span style={{ flex: 1 }}>{m.bank} ↔ {m.doc} · {inr(m.allocated)}</span>
        <button style={btn()} onClick={() => act({ action: "unmatch", bank_journal_id: m.bank_journal_id })}>Unmatch</button></div>)}</div>}
  </>;
}

function DocsTab({ bizId, reqs, groups, reminders, act, reload }: { bizId: string; reqs: Req[]; groups: Group[] | null; reminders?: { due: number; overdue: number }; act: (b: Record<string, unknown>, d?: string) => Promise<unknown>; reload: () => Promise<void> }) {
  const [up, setUp] = useState<string | null>(null); const [res, setRes] = useState<Record<string, string>>({});
  async function upload(id: string, f: File | undefined) {
    if (!f) return; setUp(id);
    const fd = new FormData(); fd.append("business_id", bizId); fd.append("request_id", id); fd.append("file", f);
    const r = await fetch(`/api/finance/detective?business_id=${bizId}`, { method: "POST", body: fd }); const d = await r.json().catch(() => ({}));
    setUp(null);
    setRes(x => ({ ...x, [id]: !r.ok ? (d.error ?? "Upload failed.") : d.status === "fulfilled" ? "✓ Checked and linked — request closed." : `Kept, but it doesn't match: ${(d.validation?.checks ?? []).filter((c: { ok: boolean }) => !c.ok).map((c: { label: string; detail: string }) => `${c.label} — ${c.detail}`).join("; ")}` }));
    await reload();
  }
  const open = reqs.filter(r => r.status === "open" || r.status === "insufficient");
  const wa = (phone: string | null | undefined, text: string) => `https://wa.me/${(phone ?? "").replace(/\D/g, "").replace(/^(?=\d{10}$)/, "91")}?text=${encodeURIComponent(text)}`;
  return <>
    {reminders && (reminders.due > 0 || reminders.overdue > 0) && <div style={{ ...card, background: "#FBF1DA", borderColor: "#E8CF95" }}>{reminders.due} request{reminders.due === 1 ? "" : "s"} due for a reminder{reminders.overdue ? `; ${reminders.overdue} overdue (over 10 days) — the assigned person should follow up` : ""}.</div>}
    <div style={card}>
      <b style={{ fontSize: 17 }}>Documents needed · {open.length}</b>
      {open.map(r => <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${HT.line}`, padding: "12px 0" }}>
        <div style={{ flex: "1 1 360px" }}>
          <div>{r.message}</div>
          <div style={{ fontSize: 12.5, color: HT.muted }}>{r.status === "insufficient" ? "Last upload didn't match · " : ""}{r.remind_count ? `Reminded ${r.remind_count}× · ` : ""}{r.assigned_to ?? "Unassigned"}</div>
          {r.validation && !r.validation.ok && <div style={{ fontSize: 12.5, color: "#B4321F" }}>{r.validation.checks.filter(c => !c.ok).map(c => `${c.label}: ${c.detail}`).join(" · ")}</div>}
          {res[r.id] && <div role="status" style={{ fontSize: 13, marginTop: 4 }}>{res[r.id]}</div>}
        </div>
        <label style={{ ...btn(true), display: "inline-flex", alignItems: "center" }}>{up === r.id ? "Checking…" : "Upload document"}<input type="file" accept=".pdf,image/*" hidden onChange={e => upload(r.id, e.target.files?.[0])} /></label>
        <button style={btn()} onClick={() => act({ action: "request_cancel", id: r.id }, "Request cancelled.")}>Not needed</button>
      </div>)}
      {!open.length && <p style={{ color: HT.muted }}>No documents outstanding. Run a scan to look for missing bills.</p>}
    </div>
    <div style={card}>
      <b style={{ fontSize: 17 }}>Follow-ups by client</b>
      <p style={{ color: HT.muted, fontSize: 13.5, margin: "4px 0 0" }}>One message per party with everything still needed. FreBook opens WhatsApp or your email with the text ready — you check it and press send. Nothing is sent automatically.</p>
      {!groups ? <p>Loading…</p> : groups.map(g => <div key={g.party} style={{ borderTop: `1px solid ${HT.line}`, padding: "12px 0", display: "grid", gap: 8 }}>
        <div><b>{g.party}</b> · {g.count} item{g.count > 1 ? "s" : ""}</div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#F8F4EA", borderRadius: 10, padding: 10, margin: 0, fontSize: 13.5 }}>{g.whatsapp?.body}</pre>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {g.whatsapp && <a style={{ ...btn(true), display: "inline-flex", alignItems: "center", textDecoration: "none" }} target="_blank" rel="noreferrer" href={wa(g.contact?.phone, g.whatsapp.body)} onClick={() => act({ action: "reminded", ids: g.ids })}>Open in WhatsApp{g.contact?.phone ? "" : " (choose contact)"}</a>}
          {g.email && <a style={{ ...btn(), display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={`mailto:${g.contact?.email ?? ""}?subject=${encodeURIComponent(g.email.subject)}&body=${encodeURIComponent(g.email.body)}`} onClick={() => act({ action: "reminded", ids: g.ids })}>Email draft</a>}
        </div>
      </div>)}
      {groups && !groups.length && <p style={{ color: HT.muted }}>No one to follow up with.</p>}
    </div>
  </>;
}

function FixTab({ corr, act }: { corr: Corr[]; act: (b: Record<string, unknown>, d?: string) => Promise<unknown> }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!corr.length) return <div style={{ ...card, color: HT.muted }}>No corrections yet. Open an issue and press <b>Propose correction</b>.</div>;
  return <div style={{ display: "grid", gap: 12 }}>{corr.map(c => <div key={c.id} style={card}>
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ fontSize: 16 }}>{c.reason}</b><span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: c.status === "posted" ? "#0B7A55" : c.status === "proposed" ? HT.goldInk : "#B4321F" }}>{c.status === "proposed" ? "Awaiting approval" : c.status[0].toUpperCase() + c.status.slice(1)}</span></div>
    <p style={{ margin: "6px 0" }}>{c.explanation}</p>
    <table style={{ borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums" }}><tbody>{c.lines.map((l, i) => <tr key={i}><td style={{ padding: "3px 12px 3px 0" }}>{l.dr ? "Dr" : "   Cr"} {l.account}</td><td style={{ textAlign: "right", padding: "3px 12px" }}>{l.dr ? inr(l.dr) : ""}</td><td style={{ textAlign: "right" }}>{l.cr ? inr(l.cr) : ""}</td></tr>)}</tbody></table>
    <p style={{ fontSize: 13.5, color: HT.muted }}><b>Tax effect:</b> {c.tax_note}</p>
    {c.decision_note && <p style={{ fontSize: 13.5 }}><b>Note:</b> {c.decision_note}</p>}
    {c.status === "proposed" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input value={notes[c.id] ?? ""} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} placeholder="Comment (needed to reject)" aria-label="Comment" style={{ flex: "1 1 240px", height: 34, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontFamily: "inherit" }} />
      <button style={btn(true)} onClick={() => act({ action: "decide", id: c.id, approve: true, note: notes[c.id] }, "Approved and posted as a new journal.")}>Approve & post</button>
      <button style={btn()} onClick={() => act({ action: "decide", id: c.id, approve: false, note: notes[c.id] }, "Rejected.")}>Reject</button>
    </div>}
  </div>)}</div>;
}

function RulesTab({ rules, act }: { rules: TaxRule[]; act: (b: Record<string, unknown>, d?: string) => Promise<unknown> }) {
  const [edit, setEdit] = useState<{ id: string; th: string; verified: string } | null>(null);
  const latest = [...new Map([...rules].sort((a, b) => a.version - b.version).map(r => [r.ruleId, r])).values()];
  return <div style={card}>
    <b style={{ fontSize: 17 }}>Tax rules used by the scan</b>
    <p style={{ color: HT.muted, fontSize: 13.5, margin: "4px 0 10px" }}>Each rule carries its provision, dates, limits and source. Changing a limit adds a new version for this business; earlier versions stay for history. "Not verified" means nobody has checked the rule against the current law in FreBook — please have your CA confirm.</p>
    <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
      <thead><tr style={{ textAlign: "left", color: HT.muted }}><th style={{ padding: 8 }}>Rule</th><th>Provision</th><th>Limits</th><th>From</th><th>Version</th><th>Verified</th><th /></tr></thead>
      <tbody>{latest.map(r => <tr key={r.ruleId} style={{ borderTop: `1px solid ${HT.line}`, verticalAlign: "top" }}>
        <td style={{ padding: 8 }}><b>{r.title}</b><div style={{ color: HT.muted, fontSize: 12 }}>{r.ruleId} · {r.area.toUpperCase()}</div></td>
        <td style={{ padding: 8, maxWidth: 260 }}>{r.provision}</td>
        <td style={{ padding: 8 }}>{Object.entries(r.thresholds).map(([k, v]) => `${k.replace(/_/g, " ")}: ${inr(v)}`).join(", ") || "—"}</td>
        <td style={{ padding: 8, whiteSpace: "nowrap" }}>{r.effectiveFrom}</td><td style={{ padding: 8 }}>v{r.version}{r.businessId ? " (yours)" : ""}</td>
        <td style={{ padding: 8, color: r.verifiedOn ? "#0B7A55" : "#B4321F" }}>{r.verifiedOn ?? "Not verified"}</td>
        <td style={{ padding: 8 }}><button style={btn()} onClick={() => setEdit({ id: r.ruleId, th: JSON.stringify(r.thresholds), verified: r.verifiedOn ?? "" })}>Change</button></td>
      </tr>)}</tbody></table></div>
    {edit && <div style={{ marginTop: 14, display: "grid", gap: 8, maxWidth: 560 }}>
      <b>New version of {edit.id}</b>
      <label style={{ fontSize: 13 }}>Limits (JSON)<input value={edit.th} onChange={e => setEdit({ ...edit, th: e.target.value })} style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${HT.line}`, padding: "0 8px", fontFamily: "monospace" }} /></label>
      <label style={{ fontSize: 13 }}>Verified on<input type="date" value={edit.verified} onChange={e => setEdit({ ...edit, verified: e.target.value })} style={{ height: 34, borderRadius: 8, border: `1px solid ${HT.line}`, padding: "0 8px", marginLeft: 8 }} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn(true)} onClick={async () => { let th; try { th = JSON.parse(edit.th); } catch { alert("Limits must be valid JSON, e.g. {\"amount\": 20000}"); return; } if (await act({ action: "rule_add", rule: { rule_id: edit.id, thresholds: th, verified_on: edit.verified || null } }, "Saved as a new version.")) setEdit(null); }}>Save new version</button>
        <button style={btn()} onClick={() => setEdit(null)}>Cancel</button>
      </div>
    </div>}
  </div>;
}

function ProposeFix({ bizId, ex, onClose, act }: { bizId: string; ex: Ex; onClose: () => void; act: (b: Record<string, unknown>) => Promise<void> }) {
  const [lines, setLines] = useState<{ account_id: string; name: string; dr: number; cr: number }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [reason, setReason] = useState(ex.title); const [amount, setAmount] = useState("");
  const jid = ex.journal_ids[0];
  useEffect(() => {
    (async () => {
      const [{ data: ls }, { data: acc }] = await Promise.all([
        supabase.from("fw_fin_journal_lines").select("account_id,dr_amount,cr_amount").eq("journal_id", jid),
        supabase.from("fw_fin_chart_of_accounts").select("id,name,type,is_group").eq("business_id", bizId).order("name"),
      ]);
      const all = ((acc ?? []) as { id: string; name: string; type: string; is_group?: boolean }[]).filter(a => !a.is_group);
      setAccounts(all);
      const nm = new Map(all.map(a => [a.id, a.name]));
      setLines(((ls ?? []) as { account_id: string; dr_amount: number; cr_amount: number }[]).map(l => ({ account_id: l.account_id, name: nm.get(l.account_id) ?? "?", dr: +l.dr_amount || 0, cr: +l.cr_amount || 0 })));
    })();
  }, [bizId, jid]);
  return <div role="dialog" aria-modal="true" aria-label="Propose a correction" style={{ position: "fixed", inset: 0, background: "rgba(16,36,31,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ ...card, width: "min(640px,100%)", display: "grid", gap: 10, fontFamily: SERIF }}>
      <b style={{ fontSize: 19 }}>Propose a correction</b>
      <p style={{ margin: 0, color: HT.muted, fontSize: 14 }}>The original entry stays as it is. A new journal moves the amount to the right ledger — posted only after an owner or accountant approves it.</p>
      <div style={{ fontSize: 14 }}>{lines.map((l, i) => <div key={i}>{l.dr ? "Dr" : "Cr"} {l.name} {inr(l.dr || l.cr)}</div>)}</div>
      <label style={{ fontSize: 13 }}>Move from<select value={from} onChange={e => setFrom(e.target.value)} style={{ width: "100%", height: 36, borderRadius: 8 }}><option value="">Choose the wrong ledger…</option>{[...new Map(lines.map(l => [l.account_id, l])).values()].map(l => <option key={l.account_id} value={l.account_id}>{l.name}</option>)}</select></label>
      <label style={{ fontSize: 13 }}>Move to<select value={to} onChange={e => setTo(e.target.value)} style={{ width: "100%", height: 36, borderRadius: 8 }}><option value="">Choose the right ledger…</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}</select></label>
      <label style={{ fontSize: 13 }}>Amount (blank = all of it)<input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${HT.line}`, padding: "0 8px" }} /></label>
      <label style={{ fontSize: 13 }}>Reason<input value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${HT.line}`, padding: "0 8px" }} /></label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={btn()} onClick={onClose}>Cancel</button>
        <button style={btn(true)} disabled={!from || !to} onClick={() => act({ action: "propose", exception_id: ex.id, journal_id: jid, from_id: from, to_id: to, amount: amount || undefined, reason })}>Send for approval</button>
      </div>
    </div>
  </div>;
}
