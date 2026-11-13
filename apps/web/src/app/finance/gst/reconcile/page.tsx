"use client";
// GST Returns Reconciliation — the GSTR-1 and GSTR-3B filed on the portal against FreBook's books for the month.
// Download both from the portal with one OTP (Sandbox), or upload the JSON downloaded from the GST portal.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { compareGstr1, parse3B, compare3B, taxOf, type Gstr1Json, type Amt } from "@/lib/gstPortalRecon";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 16, overflow: "hidden" };
const th: React.CSSProperties = { textAlign: "left", padding: "9px 12px", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: HT.muted, fontWeight: 500, borderBottom: `1px solid ${HT.line}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: `1px solid ${HT.line}`, fontSize: 13.5 };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const btn: React.CSSProperties = { border: `1px solid ${HT.line}`, background: HT.paper, borderRadius: 999, padding: "8px 16px", fontSize: 14, cursor: "pointer", color: HT.ink, fontFamily: "inherit" };
const input: React.CSSProperties = { height: 40, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontSize: 14, fontFamily: "inherit", background: "#FFFFFF", color: HT.ink };
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const Z: Amt = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
const STATUS = { match: ["Matches", "#E3F3EC", "#0B5E42"], diff: ["Amount differs", "#FBF1DA", "#7A5300"], onlyBooks: ["In books, not in filed return", "#FBE3DE", "#8A2A1A"], onlyPortal: ["In filed return, not in books", "#E8F0FF", "#1F3F99"] } as const;

export default function GstReconPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [month, setMonth] = useState(lastMonth());
  const [tab, setTab] = useState<"1" | "3b">("1");
  const [books1, setBooks1] = useState<Gstr1Json | null>(null);
  const [books3, setBooks3] = useState<Record<"a" | "b" | "c" | "d" | "e" | "itc", Amt> | null>(null);
  const [portal1, setPortal1] = useState<Gstr1Json | null>(null);
  const [portal3, setPortal3] = useState<unknown>(null);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");
  const [pull, setPull] = useState({ username: "", otp: "", step: "user" as "user" | "otp", busy: false, msg: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").trim();
      if (!id) { router.push("/finance/setup"); return; } setBizId(id);
      try { const u = localStorage.getItem(`fw_gst_user_${id}`); if (u) setPull(p => ({ ...p, username: u })); } catch { /* */ }
    });
  }, [router]);

  useEffect(() => {
    if (!bizId) return;
    setBooks1(null); setBooks3(null); setPortal1(null); setPortal3(null); setSrc(""); setErr("");
    fetch(`/api/finance/gst/portal-returns?business_id=${bizId}&month=${month}`).then(r => r.json()).then(d => d.error ? setErr(d.error) : setBooks1(d.books1 ?? {})).catch(() => setErr("Couldn't build GSTR-1 from your books."));
    fetch(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr3b`).then(r => r.json()).then(d => {
      if (!d.table3) return;
      const t = d.table3 as Record<"a" | "b" | "c" | "d" | "e", Amt>; const itc = d.itc ?? Z;
      setBooks3({ a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, itc: { taxable: 0, igst: itc.igst, cgst: itc.cgst, sgst: itc.sgst, cess: itc.cess } });
    }).catch(() => { /* 3B books shown when available */ });
  }, [bizId, month]);

  async function portal(action: "otp" | "fetch") {
    setPull(p => ({ ...p, busy: true, msg: "" })); setErr("");
    const r = await fetch("/api/finance/gst/portal-returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, action, username: pull.username.trim(), otp: pull.otp.trim(), month }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : { error: "The GST portal didn't respond." };
    if (!r?.ok) { setPull(p => ({ ...p, busy: false, msg: d.error ?? "The GST portal didn't respond.", step: d.code === "SESSION_EXPIRED" ? "user" : p.step, otp: "" })); return; }
    if (action === "otp") { try { localStorage.setItem(`fw_gst_user_${bizId}`, pull.username.trim()); } catch { /* */ } setPull(p => ({ ...p, busy: false, step: "otp", msg: d.message ?? "OTP sent." })); return; }
    setPortal1(d.gstr1 ?? {}); setPortal3(d.gstr3b ?? null); setSrc("Downloaded from the GST portal");
    setPull(p => ({ ...p, busy: false, step: "user", otp: "", msg: "" }));
  }

  async function onFile(f: File) {
    setErr("");
    try {
      const j = JSON.parse(await f.text());
      const body = j?.data?.data ?? j?.data ?? j;
      if (body.sup_details || body.itc_elg) { setPortal3(body); setTab("3b"); }
      else if (body.b2b || body.b2cs || body.b2cl || body.cdnr || body.exp) { setPortal1(body); setTab("1"); }
      else throw new Error("This isn't a GSTR-1 or GSTR-3B JSON from the GST portal.");
      setSrc(`Uploaded: ${f.name}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read this file."); }
  }

  const r1 = useMemo(() => books1 && portal1 ? compareGstr1(books1, portal1) : null, [books1, portal1]);
  const r3 = useMemo(() => books3 && portal3 ? compare3B(books3, parse3B(portal3)) : null, [books3, portal3]);
  const issues1 = r1 ? r1.invoices.filter(i => i.status !== "match").length : 0;

  function exportXl() {
    const wb = XLSX.utils.book_new();
    if (r1) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Section", "Books taxable", "Books tax", "Filed taxable", "Filed tax", "Difference"], ...r1.sections.map(s => [s.section, s.books.taxable, taxOf(s.books), s.portal.taxable, taxOf(s.portal), s.diff])]), "GSTR-1 sections");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Status", "GSTIN", "Invoice", "Date", "Books taxable", "Books tax", "Filed taxable", "Filed tax"], ...r1.invoices.map(i => [STATUS[i.status][0], i.ctin, i.no, i.date, i.books?.taxable ?? "", i.books ? taxOf(i.books) : "", i.portal?.taxable ?? "", i.portal ? taxOf(i.portal) : ""])]), "GSTR-1 B2B invoices");
    }
    if (r3) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Table", "Books taxable", "Books tax", "Filed taxable", "Filed tax", "Difference"], ...r3.map(x => [x.label, x.books.taxable, taxOf(x.books), x.portal.taxable, taxOf(x.portal), x.diff])]), "GSTR-3B");
    XLSX.writeFile(wb, `GST-Returns-Recon-${month}.xlsx`);
  }

  const amtCells = (a: Amt | null) => a ? <><td style={num}>{inr(a.taxable)}</td><td style={num}>{inr(taxOf(a))}</td></> : <><td style={num}>—</td><td style={num}>—</td></>;

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <PageHero eyebrow="GST · Returns reconciliation" title="Filed returns" accent="against your books"
        sub="GSTR-1 invoice by invoice and GSTR-3B table by table — what you filed on the portal compared with what FreBook's books say. For ITC against GSTR-2B, use ITC Match."
        tiles={[
          { label: "GSTR-1 invoices to check", value: r1 ? String(issues1) : "—", tone: r1 ? (issues1 ? "warn" : "good") : "plain", sub: r1 ? `${r1.invoices.length} B2B invoices compared` : "Load the filed return" },
          { label: "GSTR-1 tax: filed vs books", value: r1 ? inr(taxOf(r1.total.portal) - taxOf(r1.total.books)) : "—", tone: r1 ? (Math.abs(taxOf(r1.total.portal) - taxOf(r1.total.books)) <= 1 ? "good" : "bad") : "plain" },
          { label: "GSTR-3B tables differing", value: r3 ? String(r3.filter(x => Math.abs(x.diff) > 1).length) : "—", tone: r3 ? (r3.some(x => Math.abs(x.diff) > 1) ? "warn" : "good") : "plain" },
        ]} />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...card, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 13, color: HT.muted }}>Return period
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={input} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13, color: HT.muted }}>GST portal username
            <input value={pull.username} onChange={e => setPull(p => ({ ...p, username: e.target.value }))} style={{ ...input, width: 180 }} autoComplete="off" />
          </label>
          {pull.step === "otp" && <label style={{ display: "grid", gap: 4, fontSize: 13, color: HT.muted }}>OTP
            <input value={pull.otp} onChange={e => setPull(p => ({ ...p, otp: e.target.value }))} inputMode="numeric" style={{ ...input, width: 120 }} autoComplete="one-time-code" />
          </label>}
          <button disabled={pull.busy || !pull.username.trim() || (pull.step === "otp" && !pull.otp.trim())} onClick={() => portal(pull.step === "user" ? "otp" : "fetch")}
            style={{ ...btn, height: 40, background: HT.ink, color: HT.paper, borderColor: HT.ink }}>
            {pull.busy ? "Working…" : pull.step === "user" ? "Send OTP" : "Download GSTR-1 and 3B"}
          </button>
          <label style={{ ...btn, height: 40, boxSizing: "border-box", display: "inline-flex", alignItems: "center" }}>Or upload return JSON
            <input type="file" accept=".json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </label>
          {(r1 || r3) && <button onClick={exportXl} style={{ ...btn, height: 40 }}>Download Excel</button>}
          <div style={{ flexBasis: "100%", fontSize: 13, color: pull.msg && !/sent/i.test(pull.msg) ? "#8A2A1A" : HT.muted }}>
            {pull.msg || src || "On the GST portal, set View Profile → Manage API Access → Enable API Request = Yes once. The portal session isn't stored."}
          </div>
        </div>
        {err && <div role="alert" style={{ color: "#8A2A1A" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["1", "3b"] as const).map(k => <button key={k} onClick={() => setTab(k)} style={{ ...btn, background: tab === k ? HT.ink : HT.paper, color: tab === k ? HT.paper : HT.ink }}>{k === "1" ? "GSTR-1 vs books" : "GSTR-3B vs books"}</button>)}
          <Link href={`/finance/gst/itc`} style={{ marginLeft: "auto", fontSize: 14, color: HT.ink }}>ITC vs GSTR-2B →</Link>
        </div>

        {tab === "1" && (!portal1 ? <div style={{ ...card, padding: 20, color: HT.muted }}>Download or upload the filed GSTR-1 for {month} to compare it with the books.</div> : !r1 ? <div style={{ color: HT.muted }}>Building GSTR-1 from your books…</div> : (
          <>
            <div style={{ ...card, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Section</th><th style={{ ...th, textAlign: "right" }}>Books taxable</th><th style={{ ...th, textAlign: "right" }}>Books tax</th><th style={{ ...th, textAlign: "right" }}>Filed taxable</th><th style={{ ...th, textAlign: "right" }}>Filed tax</th><th style={{ ...th, textAlign: "right" }}>Difference</th></tr></thead>
                <tbody>{r1.sections.map(s => <tr key={s.section}><td style={td}>{s.section}</td>{amtCells(s.books)}{amtCells(s.portal)}<td style={{ ...num, color: Math.abs(s.diff) > 1 ? "#8A2A1A" : "#0B5E42" }}>{Math.abs(s.diff) > 1 ? inr(s.diff) : "✓"}</td></tr>)}</tbody>
              </table>
            </div>
            <div style={{ ...card, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Status</th><th style={th}>Customer GSTIN</th><th style={th}>Invoice</th><th style={th}>Date</th><th style={{ ...th, textAlign: "right" }}>Books taxable</th><th style={{ ...th, textAlign: "right" }}>Books tax</th><th style={{ ...th, textAlign: "right" }}>Filed taxable</th><th style={{ ...th, textAlign: "right" }}>Filed tax</th></tr></thead>
                <tbody>{r1.invoices.length ? r1.invoices.map(i => <tr key={i.key}>
                  <td style={td}><span style={{ background: STATUS[i.status][1], color: STATUS[i.status][2], borderRadius: 999, padding: "3px 10px", fontSize: 12, whiteSpace: "nowrap" }}>{STATUS[i.status][0]}</span></td>
                  <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{i.ctin}</td><td style={td}>{i.no}</td><td style={td}>{i.date}</td>{amtCells(i.books)}{amtCells(i.portal)}</tr>)
                  : <tr><td style={td} colSpan={8}>No B2B invoices in either.</td></tr>}</tbody>
              </table>
            </div>
          </>
        ))}

        {tab === "3b" && (!portal3 ? <div style={{ ...card, padding: 20, color: HT.muted }}>Download or upload the filed GSTR-3B for {month} to compare it with the books.</div> : !r3 ? <div style={{ color: HT.muted }}>Working out 3B from your books…</div> : (
          <div style={{ ...card, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Table</th><th style={{ ...th, textAlign: "right" }}>Books taxable</th><th style={{ ...th, textAlign: "right" }}>Books tax</th><th style={{ ...th, textAlign: "right" }}>Filed taxable</th><th style={{ ...th, textAlign: "right" }}>Filed tax</th><th style={{ ...th, textAlign: "right" }}>Difference</th></tr></thead>
              <tbody>{r3.map(x => <tr key={x.label}><td style={td}>{x.label}</td>{x.label.startsWith("4") ? <><td style={num}></td><td style={num}>{inr(taxOf(x.books))}</td><td style={num}></td><td style={num}>{inr(taxOf(x.portal))}</td></> : <>{amtCells(x.books)}{amtCells(x.portal)}</>}<td style={{ ...num, color: Math.abs(x.diff) > 1 ? "#8A2A1A" : "#0B5E42" }}>{Math.abs(x.diff) > 1 ? inr(x.diff) : "✓"}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </main>
    </div>
  );
}
