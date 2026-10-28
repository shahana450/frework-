"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { saveEntry, NeedsHeadsError } from "@/lib/postEntry";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import { readActiveBusiness } from "@/lib/activeBusiness";

type SugLine = { account_name: string; dr: number; cr: number };
type Dup = { kind: string; message: string; ref?: string };
type Details = {
  action?: string; rule?: string | null; reason?: string | null; history_evidence?: string | null; confidence?: number;
  account_confidence?: number | null; counter_account?: string | null; alternatives?: string[]; warnings?: string[];
  question?: string | null; gst?: { applicable: boolean; rate: number; taxable_value: number; cgst: number; sgst: number; igst: number; transaction_type: string | null };
  tds?: { applicable: boolean; section: string | null; rate: number; amount: number; net_payment: number };
  payment_mode?: string | null; date?: string; party?: string | null; duplicates?: Dup[];
  source_row?: string; bank_ledger?: string;
};
type Summary = {
  vendor?: string | null; customer?: string | null; amount?: number; base_amount?: number; gst_amount?: number; cgst?: number; sgst?: number; igst?: number;
  date?: string | null; invoice_no?: string | null; gstin_supplier?: string | null; gstin_buyer?: string | null; items?: unknown[]; review?: Details; bank_ledger?: string;
};
type Suggestion = {
  id: string; created_at: string; suggested_type: string; suggested_narration: string; suggested_lines: SugLine[];
  confidence: number; status: string; document_id: string; details?: Details | null;
  fw_fin_documents: { file_name: string; file_url: string | null; doc_type: string | null; ai_summary: Summary | null } | null;
};

const BG = "#F4EFE4", CARD = "#FFFFFF", BORDER = "rgba(16,36,31,0.11)";
const TEXT = "#10241F", MUTED = "rgba(16,36,31,0.75)", GOLD = "#12352D", GREEN = "#0B7A55", RED = "#B4321F", AMBER = "#9A6B22", BLUE = "#12352D", PURPLE = "#5B4BC4";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
const money = (n: number) => cur() + (n ?? 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TYPE_LABEL: Record<string, string> = { sales: "Sale", purchase: "Purchase", payment: "Payment / Expense", receipt: "Receipt", journal: "Journal", contra: "Transfer", credit_note: "Credit Note", debit_note: "Debit Note" };

const detailsOf = (s: Suggestion): Details => s.details ?? (s.fw_fin_documents?.doc_type !== "bank_statement" ? s.fw_fin_documents?.ai_summary?.review : undefined) ?? {};
const totalOf = (lines: SugLine[]) => lines.reduce((a, l) => a + (Number(l.dr) || 0), 0);
const isBalanced = (lines: SugLine[]) => Math.abs(totalOf(lines) - lines.reduce((a, l) => a + (Number(l.cr) || 0), 0)) < 0.01 && totalOf(lines) > 0;

export default function AIReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [bizId, setBizId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, SugLine[]>>({});
  const [narr, setNarr] = useState<Record<string, string>>({});
  const [heads, setHeads] = useState<Record<string, { account: string; suggested: string }[]>>({});
  const [chosenHeads, setChosenHeads] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "accepted" | "rejected">("pending");
  const [bulkMsg, setBulkMsg] = useState("");

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    const cols = (withDetails: boolean) => `id,created_at,suggested_type,suggested_narration,suggested_lines,confidence,status,document_id${withDetails ? ",details" : ""},fw_fin_documents(file_name,file_url,doc_type,ai_summary)`;
    let { data, error } = await supabase.from("fw_fin_ai_suggestions").select(cols(true)).eq("business_id", bid).order("created_at", { ascending: false }).limit(500);
    if (error && /details/.test(error.message)) ({ data, error } = await supabase.from("fw_fin_ai_suggestions").select(cols(false)).eq("business_id", bid).order("created_at", { ascending: false }).limit(500));
    setItems((data as unknown as Suggestion[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved); load(saved);
    });
  }, [load, router]);

  const linesOf = (s: Suggestion) => lines[s.id] ?? s.suggested_lines ?? [];
  const isReady = (s: Suggestion) => {
    const d = detailsOf(s);
    return s.status === "pending" && (s.confidence ?? 0) >= 0.9 && !(d.duplicates?.length) && !d.question && isBalanced(linesOf(s));
  };

  async function openDocument(s: Suggestion) {
    const url = s.fw_fin_documents?.file_url ?? "";
    const path = url.includes("/fw-finance-docs/") ? url.split("/fw-finance-docs/")[1] : url;
    const { data } = await supabase.storage.from("fw-finance-docs").createSignedUrl(decodeURIComponent(path), 600);
    window.open(data?.signedUrl ?? url, "_blank", "noopener");
  }

  async function approve(s: Suggestion, silent = false, headsOverride?: Record<string, string>): Promise<boolean> {
    if (!bizId) return false;
    const l = linesOf(s);
    if (!isBalanced(l)) { setErrors(e => ({ ...e, [s.id]: "Debits and credits must be equal before posting." })); return false; }
    setBusy(s.id); setErrors(e => ({ ...e, [s.id]: "" }));
    const d = detailsOf(s), sum = s.fw_fin_documents?.ai_summary;
    try {
      const j = await saveEntry({
        business_id: bizId, date: (d.date ?? sum?.date ?? new Date().toISOString()).slice(0, 10),
        narration: narr[s.id] ?? s.suggested_narration, type: s.suggested_type ?? "journal", source: "ai_review",
        reference_no: sum?.invoice_no ?? null, party_name: d.party ?? sum?.vendor ?? sum?.customer ?? null,
        lines: l.map(x => ({ account_name: x.account_name, dr: Number(x.dr) || 0, cr: Number(x.cr) || 0 })),
        account_heads: headsOverride ?? chosenHeads,
        metadata: { document_id: s.document_id, suggestion_id: s.id, ai_confidence: s.confidence, rule: d.rule ?? null, reason: d.reason ?? null, duplicates_seen: d.duplicates ?? [] },
      });
      await supabase.from("fw_fin_ai_suggestions").update({ status: "accepted", journal_id: j.id, accepted_at: new Date().toISOString() }).eq("id", s.id);
      if (s.fw_fin_documents?.doc_type !== "bank_statement") await supabase.from("fw_fin_documents").update({ status: "posted", journal_id: j.id }).eq("id", s.document_id);
      setItems(prev => prev.map(x => x.id === s.id ? { ...x, status: "accepted" } : x));
      return true;
    } catch (e) {
      if (e instanceof NeedsHeadsError) { setHeads(h => ({ ...h, [s.id]: e.needs })); setExpanded(s.id); }
      else if (!silent) setErrors(er => ({ ...er, [s.id]: e instanceof Error ? e.message : "Couldn't post." }));
      else setErrors(er => ({ ...er, [s.id]: e instanceof Error ? e.message : "Couldn't post." }));
      return false;
    } finally { setBusy(null); }
  }

  async function reject(s: Suggestion) {
    const reason = window.prompt("Why reject this? (optional — helps improve suggestions)") ?? null;
    if (reason === null) return;
    const upd = await supabase.from("fw_fin_ai_suggestions").update({ status: "rejected", reject_reason: reason || null }).eq("id", s.id);
    if (upd.error) await supabase.from("fw_fin_ai_suggestions").update({ status: "rejected" }).eq("id", s.id);
    setItems(prev => prev.map(x => x.id === s.id ? { ...x, status: "rejected" } : x));
  }

  async function approveAllReady() {
    const ready = items.filter(isReady);
    if (!ready.length || !window.confirm(`Post ${ready.length} high-confidence entr${ready.length === 1 ? "y" : "ies"} with no duplicates or open questions?`)) return;
    let ok = 0;
    for (let i = 0; i < ready.length; i++) {
      setBulkMsg(`Posting ${i + 1} of ${ready.length}…`);
      if (await approve(ready[i], true)) ok++;
    }
    setBulkMsg(`✓ Posted ${ok} of ${ready.length}.${ok < ready.length ? " The rest need a look — see messages on each item." : ""}`);
  }

  function swapAccount(s: Suggestion, from: string | null | undefined, to: string) {
    if (!from) return;
    setLines(p => ({ ...p, [s.id]: linesOf(s).map(l => l.account_name === from ? { ...l, account_name: to } : l) }));
    setItems(prev => prev.map(x => x.id === s.id ? { ...x, details: { ...detailsOf(x), counter_account: to, alternatives: [from, ...(detailsOf(x).alternatives ?? []).filter(a => a !== to)].slice(0, 3), account_confidence: 1 } } : x));
  }

  const filtered = items.filter(s => s.status === filter);
  const pendingCount = items.filter(s => s.status === "pending").length;
  const readyCount = items.filter(isReady).length;
  const btn = (bg: string, fg: string, border = "none"): React.CSSProperties => ({ background: bg, color: fg, border, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem", fontFamily: "inherit", whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.8rem", height: 56, flexWrap: "wrap" }}>
        <Link href="/finance" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>FreWork</Link>
        <span style={{ color: MUTED }}>›</span>
        <span style={{ fontWeight: 700 }}>AI Review Queue</span>
        {pendingCount > 0 && <span style={{ background: GOLD, color: BG, fontSize: "0.7rem", fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{pendingCount} to review</span>}
        <div style={{ flex: 1 }} />
        <Link href="/finance/upload" style={{ ...btn(GOLD, BG), textDecoration: "none" }}>+ Upload documents</Link>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}>
        <p style={{ margin: "0 0 1.25rem", color: MUTED, fontSize: "0.85rem", lineHeight: 1.6 }}>
          Nothing here is in your books yet. Each suggestion shows the source document, what was read from it, how the entry was built and any duplicate warnings. You approve, edit or reject.
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {(["pending", "accepted", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={btn(filter === f ? GOLD : "rgba(16,36,31,0.08)", filter === f ? BG : MUTED)}>
              {f === "pending" ? `To review (${pendingCount})` : f === "accepted" ? "Posted" : "Rejected"}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {filter === "pending" && readyCount > 0 && (
            <button onClick={approveAllReady} style={btn("rgba(11,122,85,0.12)", GREEN, `1px solid rgba(11,122,85,0.35)`)}>✓ Approve all ready ({readyCount})</button>
          )}
        </div>
        {bulkMsg && <div style={{ marginBottom: "1rem", fontSize: "0.82rem", color: bulkMsg.startsWith("✓") ? GREEN : BLUE }}>{bulkMsg}</div>}

        {loading ? <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>Loading…</div>
        : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
            {filter === "pending" ? <>Nothing waiting for review. <Link href="/finance/upload" style={{ color: GOLD }}>Upload bills or statements →</Link></> : `Nothing ${filter === "accepted" ? "posted" : "rejected"} yet.`}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {filtered.map(s => {
              const d = detailsOf(s), sum = s.fw_fin_documents?.ai_summary ?? {};
              const l = linesOf(s), total = totalOf(l), balanced = isBalanced(l);
              const open = expanded === s.id;
              const dups = d.duplicates ?? [];
              const conf = Math.min(s.confidence ?? 0, d.account_confidence ?? 1);
              const party = d.party ?? sum.vendor ?? sum.customer;
              return (
                <div key={s.id} style={{ background: CARD, border: `1px solid ${dups.length && s.status === "pending" ? "rgba(194,50,31,0.35)" : open ? "rgba(18,53,45,0.3)" : BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  {/* Summary row */}
                  <div onClick={() => { setExpanded(open ? null : s.id); }} style={{ padding: "0.9rem 1.1rem", display: "flex", gap: "1rem", alignItems: "center", cursor: "pointer", flexWrap: "wrap" }}>
                    <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: "1.05rem", minWidth: 120 }}>{money(total)}</div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{party || s.suggested_narration}</div>
                      <div style={{ fontSize: "0.75rem", color: MUTED, display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        <span>{TYPE_LABEL[s.suggested_type] ?? s.suggested_type}</span>
                        {d.counter_account && <span>· Suggested: <strong style={{ color: TEXT }}>{d.counter_account}</strong></span>}
                        {(d.date ?? sum.date) && <span>· {(d.date ?? sum.date)?.slice(0, 10)}</span>}
                        <span>· {s.fw_fin_documents?.file_name ?? "document"}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 9px", borderRadius: 10, color: conf >= 0.85 ? GREEN : conf >= 0.7 ? AMBER : RED, background: conf >= 0.85 ? "rgba(11,122,85,0.1)" : conf >= 0.7 ? "rgba(184,120,0,0.1)" : "rgba(194,50,31,0.1)" }}>
                      {conf < 0.7 ? "⚠ Needs review · " : ""}{Math.round(conf * 100)}%
                    </span>
                    {dups.length > 0 && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: RED, background: "rgba(194,50,31,0.1)", padding: "2px 9px", borderRadius: 10 }}>⚠ Possible duplicate</span>}
                    {d.question && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: BLUE, background: "rgba(18,53,45,0.1)", padding: "2px 9px", borderRadius: 10 }}>? Question</span>}
                    {s.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => reject(s)} style={btn("rgba(194,50,31,0.08)", RED, "1px solid rgba(194,50,31,0.25)")}>Reject</button>
                        <button onClick={() => approve(s)} disabled={busy === s.id || !balanced} style={{ ...btn(GOLD, BG), opacity: busy === s.id || !balanced ? 0.5 : 1 }}>{busy === s.id ? "Posting…" : "✓ Approve"}</button>
                      </div>
                    ) : <span style={{ fontSize: "0.8rem", fontWeight: 700, color: s.status === "accepted" ? GREEN : RED }}>{s.status === "accepted" ? "✓ Posted" : "✕ Rejected"}</span>}
                    <span style={{ color: MUTED }}>{open ? "▲" : "▼"}</span>
                  </div>
                  {errors[s.id] && <div style={{ padding: "0 1.1rem 0.7rem", fontSize: "0.78rem", color: RED }}>⚠ {errors[s.id]}</div>}

                  {open && (
                    <div style={{ borderTop: `1px solid ${BORDER}`, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "1rem", background: "rgba(0,0,0,0.18)" }}>
                      {dups.length > 0 && (
                        <div style={{ background: "rgba(194,50,31,0.07)", border: "1px solid rgba(194,50,31,0.25)", borderRadius: 8, padding: "0.6rem 0.8rem", fontSize: "0.8rem" }}>
                          {dups.map((x, i) => <div key={i} style={{ color: RED }}>⚠ {x.message}{x.kind.startsWith("posted") && x.ref && <> <Link href={`/finance/journals?id=${x.ref}`} style={{ color: BLUE }}>View</Link></>}</div>)}
                        </div>
                      )}
                      {d.question && <div style={{ fontSize: "0.82rem", color: BLUE }}>❓ {d.question} <span style={{ color: MUTED }}>— fix it in the entry below before approving.</span></div>}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                        {/* Source + extracted */}
                        <section>
                          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>Source</h4>
                          <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 3 }}>
                            <div>{s.fw_fin_documents?.file_name} {s.fw_fin_documents?.file_url && <button onClick={() => openDocument(s)} style={{ background: "none", border: "none", color: BLUE, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "0.78rem" }}>Open document ↗</button>}</div>
                            {d.source_row && <div style={{ color: MUTED }}>Statement row: “{d.source_row}”</div>}
                            {sum.vendor && <div><span style={{ color: MUTED }}>Supplier: </span>{sum.vendor}{sum.gstin_supplier ? ` · ${sum.gstin_supplier}` : ""}</div>}
                            {sum.customer && <div><span style={{ color: MUTED }}>Customer: </span>{sum.customer}{sum.gstin_buyer ? ` · ${sum.gstin_buyer}` : ""}</div>}
                            {sum.invoice_no && <div><span style={{ color: MUTED }}>Invoice: </span>{sum.invoice_no}</div>}
                            {sum.date && <div><span style={{ color: MUTED }}>Date: </span>{sum.date}</div>}
                            {sum.base_amount != null && sum.base_amount > 0 && <div><span style={{ color: MUTED }}>Taxable: </span>{money(sum.base_amount)}</div>}
                            {!!(sum.cgst || sum.sgst || sum.igst) && <div><span style={{ color: MUTED }}>GST on document: </span>{sum.cgst ? `CGST ${money(sum.cgst)} ` : ""}{sum.sgst ? `SGST ${money(sum.sgst)} ` : ""}{sum.igst ? `IGST ${money(sum.igst)}` : ""}</div>}
                            {sum.amount != null && sum.amount > 0 && <div><span style={{ color: MUTED }}>Document total: </span><strong>{money(sum.amount)}</strong></div>}
                            {Array.isArray(sum.items) && sum.items.length > 0 && <div style={{ color: MUTED }}>{sum.items.length} line item{sum.items.length > 1 ? "s" : ""}</div>}
                          </div>
                        </section>
                        {/* Interpretation */}
                        <section>
                          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.66rem", color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em" }}>How this entry was built</h4>
                          <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 4 }}>
                            {d.rule && <div><span style={{ color: MUTED }}>Rule: </span>{d.rule}</div>}
                            {d.reason && <div><span style={{ color: MUTED }}>Reading: </span>{d.reason}</div>}
                            {d.history_evidence && <div><span style={{ color: MUTED }}>Your books: </span>{d.history_evidence}</div>}
                            {d.gst?.applicable && <div><span style={{ color: MUTED }}>GST {d.gst.rate}% ({d.gst.transaction_type === "inter" ? "inter-state" : "intra-state"}): </span>taxable {money(d.gst.taxable_value)}{d.gst.cgst ? ` · CGST ${money(d.gst.cgst)}` : ""}{d.gst.sgst ? ` · SGST ${money(d.gst.sgst)}` : ""}{d.gst.igst ? ` · IGST ${money(d.gst.igst)}` : ""}</div>}
                            {d.tds?.applicable && <div><span style={{ color: MUTED }}>TDS {d.tds.section}: </span>{money(d.tds.amount)} · net {money(d.tds.net_payment)}</div>}
                            {(d.warnings ?? []).map((w, i) => <div key={i} style={{ color: AMBER }}>⚠ {w}</div>)}
                            {s.status === "pending" && (d.alternatives ?? []).length > 0 && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ color: MUTED }}>Or book to:</span>
                                {(d.alternatives ?? []).map(a => <button key={a} onClick={() => swapAccount(s, d.counter_account, a)} style={{ fontSize: "0.72rem", padding: "2px 9px", borderRadius: 12, border: "1px solid rgba(91,75,196,0.35)", background: "rgba(91,75,196,0.08)", color: PURPLE, cursor: "pointer", fontFamily: "inherit" }}>{a}</button>)}
                              </div>
                            )}
                          </div>
                        </section>
                      </div>

                      {/* Entry editor */}
                      <section>
                        <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>Suggested entry {s.status === "pending" && "(editable)"}</h4>
                        <input value={narr[s.id] ?? s.suggested_narration} disabled={s.status !== "pending"} onChange={e => setNarr(p => ({ ...p, [s.id]: e.target.value }))}
                          style={{ width: "100%", boxSizing: "border-box", background: "rgba(16,36,31,0.08)", border: `1px solid ${BORDER}`, color: TEXT, padding: "7px 10px", borderRadius: 6, fontSize: "0.84rem", marginBottom: 8, fontFamily: "inherit" }} />
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                          <thead><tr>{["Account", "Debit", "Credit", ""].map(h => <th key={h} style={{ textAlign: h === "Account" ? "left" : "right", padding: "4px 6px", color: MUTED, fontSize: "0.66rem", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {l.map((line, i) => (
                              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                                <td style={{ padding: "4px 6px" }}><input value={line.account_name} disabled={s.status !== "pending"} onChange={e => setLines(p => ({ ...p, [s.id]: l.map((x, k) => k === i ? { ...x, account_name: e.target.value } : x) }))} style={{ width: "100%", background: "transparent", border: `1px solid ${BORDER}`, color: TEXT, padding: "4px 7px", borderRadius: 5, fontFamily: "inherit" }} /></td>
                                {(["dr", "cr"] as const).map(side => (
                                  <td key={side} style={{ padding: "4px 6px", width: 120 }}><input type="number" value={line[side] || ""} disabled={s.status !== "pending"} onChange={e => setLines(p => ({ ...p, [s.id]: l.map((x, k) => k === i ? { ...x, [side]: parseFloat(e.target.value) || 0 } : x) }))} style={{ width: "100%", background: "transparent", border: `1px solid ${BORDER}`, color: TEXT, padding: "4px 7px", borderRadius: 5, textAlign: "right", fontFamily: MONO }} /></td>
                                ))}
                                <td style={{ width: 24 }}>{s.status === "pending" && <button onClick={() => setLines(p => ({ ...p, [s.id]: l.filter((_, k) => k !== i) }))} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer" }}>×</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr style={{ borderTop: `2px solid ${BORDER}` }}>
                            <td style={{ padding: "6px", fontWeight: 700 }}>Total {s.status === "pending" && <button onClick={() => setLines(p => ({ ...p, [s.id]: [...l, { account_name: "", dr: 0, cr: 0 }] }))} style={{ marginLeft: 8, background: "none", border: `1px dashed ${BORDER}`, color: MUTED, borderRadius: 5, cursor: "pointer", fontSize: "0.72rem", fontFamily: "inherit" }}>+ line</button>}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontFamily: MONO }}>{money(total)}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontFamily: MONO }}>{money(l.reduce((a, x) => a + (Number(x.cr) || 0), 0))}</td>
                            <td style={{ fontSize: "0.72rem", color: balanced ? GREEN : RED, paddingLeft: 6 }}>{balanced ? "✓" : "⚠"}</td>
                          </tr></tfoot>
                        </table>
                      </section>

                      {heads[s.id]?.length ? (
                        <div style={{ background: "rgba(184,120,0,0.06)", border: "1px solid rgba(184,120,0,0.25)", borderRadius: 8, padding: "0.7rem 0.9rem", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 6 }}>
                          <strong style={{ color: AMBER }}>🤔 New ledger — which group should it go under?</strong>
                          {heads[s.id].map(h => (
                            <label key={h.account} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ minWidth: 160 }}>{h.account}</span>
                              <select value={chosenHeads[h.account] ?? h.suggested} onChange={e => setChosenHeads(c => ({ ...c, [h.account]: e.target.value }))} style={{ background: "#FFFDF8", border: `1px solid ${BORDER}`, color: TEXT, padding: "5px 8px", borderRadius: 6, fontFamily: "inherit" }}>
                                {LEDGER_HEADS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                              </select>
                            </label>
                          ))}
                          <button onClick={() => { const picked = { ...chosenHeads, ...Object.fromEntries(heads[s.id].map(h => [h.account, chosenHeads[h.account] ?? h.suggested])) }; setChosenHeads(picked); setHeads(x => ({ ...x, [s.id]: [] })); approve(s, false, picked); }} style={{ ...btn(GREEN, BG), alignSelf: "flex-start" }}>✓ Create ledger & post</button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
