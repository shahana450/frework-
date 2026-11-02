"use client";
// GST desk — the CA's view of every client's GST for a month: sales, output tax, ITC and net payable from the books,
// and whether GSTR-1 and GSTR-3B are filed, due or late. Open a client to prepare its return.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setActiveBusiness, confirmBusinessSwitch, readActiveBusiness } from "@/lib/activeBusinessStore";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type Filing = { status: string; filed: boolean; arn: string | null; on: string | null } | null;
type Row = { id: string; name: string; gstin: string; entries?: number; taxable?: number; exempt?: number; output?: number; itc?: number; net?: number; gstr1?: Filing; gstr3b?: Filing; error?: string };
type Scheme = "monthly" | "qrmp" | "composition";

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthOptions() {
  const out: { value: string; label: string }[] = [], d = new Date();
  for (let i = 1; i <= 18; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ value: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[x.getMonth()]} ${x.getFullYear()}` }); }
  return out;
}
/** Due date of a return for the month (monthly filers: GSTR-1 11th, GSTR-3B 20th of the next month; QRMP: quarter-end + 13th / 22nd) */
function dueFor(form: "GSTR-1" | "GSTR-3B", month: string, scheme: Scheme): string | null {
  const [y, m] = month.split("-").map(Number);
  if (scheme === "composition") return null;
  if (scheme === "qrmp") { if (m % 3 !== 0) return null; return new Date(Date.UTC(y, m, form === "GSTR-1" ? 13 : 22)).toISOString().slice(0, 10); }
  return new Date(Date.UTC(y, m, form === "GSTR-1" ? 11 : 20)).toISOString().slice(0, 10);
}
const daysTo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);

export default function GstDesk() {
  const router = useRouter();
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [noGstin, setNoGstin] = useState(0);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "pending">("all");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => { if (!user) router.replace("/login?next=/finance/gst/desk"); else setUid(user.id); }); }, [router]);
  useEffect(() => {
    if (!uid) return;
    setRows(null); setErr("");
    fetch(`/api/finance/gst-desk?month=${month}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't load the GST desk."); else { setRows(d.businesses ?? []); setNoGstin(d.without_gstin ?? 0); }
    }).catch(() => setErr("Couldn't load the GST desk."));
  }, [uid, month]);

  const scheme = (id: string): Scheme => { try { const s = localStorage.getItem(`fw_gst_scheme_${id}`); return s === "qrmp" || s === "composition" ? s : "monthly"; } catch { return "monthly"; } };
  const cell = (r: Row, form: "GSTR-1" | "GSTR-3B") => {
    const f = form === "GSTR-1" ? r.gstr1 : r.gstr3b;
    if (f?.filed) return { tone: "ok", text: `Filed${f.on ? ` ${f.on.slice(8, 10)}/${f.on.slice(5, 7)}` : ""}`, title: f.arn ? `ARN ${f.arn}` : "" };
    const due = dueFor(form, month, scheme(r.id));
    if (!due) return { tone: "na", text: scheme(r.id) === "composition" ? "Composition" : "Quarterly", title: "Not due for this month" };
    const d = daysTo(due);
    if (d < 0) return { tone: "late", text: `${-d} day${d === -1 ? "" : "s"} late`, title: `Was due ${due}` };
    return { tone: "due", text: d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`, title: `Due ${due}` };
  };
  const shown = (rows ?? []).filter(r => (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()) || r.gstin.toLowerCase().includes(q.trim().toLowerCase()))
    && (only === "all" || !(r.gstr1?.filed && r.gstr3b?.filed)));
  const filed1 = (rows ?? []).filter(r => r.gstr1?.filed).length, filed3 = (rows ?? []).filter(r => r.gstr3b?.filed).length;
  const late = (rows ?? []).filter(r => cell(r, "GSTR-1").tone === "late" || cell(r, "GSTR-3B").tone === "late").length;
  const totalNet = (rows ?? []).reduce((s, r) => s + (r.net ?? 0), 0);
  const label = months.find(m => m.value === month)?.label ?? month;

  async function open(r: Row, to: string) {
    if (!uid) return;
    const cur = readActiveBusiness(uid);
    if (cur !== r.id) { if (!(await confirmBusinessSwitch(uid, r.id, r.name))) return; setActiveBusiness(uid, r.id, r.name); }
    router.push(to);
  }

  const TONE: Record<string, { bg: string; fg: string }> = { ok: { bg: "#E3F3EC", fg: "#0B7A55" }, due: { bg: "#FBF1DA", fg: "#9A6B22" }, late: { bg: "#FBE3DE", fg: "#B4321F" }, na: { bg: "#EEF0EF", fg: "#6B7570" } };
  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const input: React.CSSProperties = { height: 40, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 12px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF" };

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow={`GST desk · ${label}`} title="Every client's GST, one screen"
        sub="Figures from each client's books; filing status from the GST portal. Open a client to prepare the return."
        actions={<select value={month} onChange={e => setMonth(e.target.value)} aria-label="Return month"
          style={{ height: 46, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.28)", background: HT.green, color: "#FFFFFF", fontFamily: SERIF, fontSize: 15 }}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>}
        tiles={rows ? [
          { label: "GST clients", value: String(rows.length) },
          { label: "GSTR-1 filed", value: `${filed1} / ${rows.length}`, tone: filed1 === rows.length ? "good" : "warn" },
          { label: "GSTR-3B filed", value: `${filed3} / ${rows.length}`, tone: filed3 === rows.length ? "good" : "warn" },
          { label: "Late", value: String(late), tone: late ? "bad" : "plain" },
          { label: "Net GST payable", value: inr(totalNet) },
        ] : undefined} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "26px 20px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div role="alert" style={{ ...card, padding: "14px 18px", color: "#B4321F" }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a client by name or GSTIN" aria-label="Find a client" style={{ ...input, flex: "1 1 260px" }} />
          {(["all", "pending"] as const).map(k => (
            <button key={k} type="button" onClick={() => setOnly(k)} aria-pressed={only === k}
              style={{ ...input, cursor: "pointer", fontWeight: 700, background: only === k ? "#12352D" : "#FFFFFF", color: only === k ? "#FFFFFF" : HT.ink }}>{k === "all" ? "All clients" : "Not fully filed"}</button>
          ))}
        </div>
        <section style={card} aria-label="Clients">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums", minWidth: 980 }}>
              <thead><tr style={{ color: HT.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                <th style={{ padding: "12px 18px", textAlign: "left" }}>Client</th><th style={{ padding: 10 }}>Taxable sales</th><th style={{ padding: 10 }}>Output tax</th><th style={{ padding: 10 }}>ITC</th><th style={{ padding: 10 }}>Net payable</th>
                <th style={{ padding: 10, textAlign: "center" }}>GSTR-1</th><th style={{ padding: 10, textAlign: "center" }}>GSTR-3B</th><th style={{ padding: "10px 18px" }} />
              </tr></thead>
              <tbody>
                {!rows && !err && <tr><td colSpan={8} style={{ padding: 22, color: HT.muted, fontStyle: "italic" }}>Reading every client&apos;s books for {label}…</td></tr>}
                {rows && !shown.length && <tr><td colSpan={8} style={{ padding: 22, color: HT.muted }}>{rows.length ? "No clients match." : "No GST-registered businesses yet — add the GSTIN in each client's Business details."}</td></tr>}
                {shown.map(r => {
                  const a = cell(r, "GSTR-1"), b = cell(r, "GSTR-3B");
                  const pill = (c: { tone: string; text: string; title: string }) => <span title={c.title} style={{ display: "inline-block", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: TONE[c.tone].bg, color: TONE[c.tone].fg, whiteSpace: "nowrap" }}>{c.text}</span>;
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${HT.line}`, textAlign: "right" }}>
                      <td style={{ padding: "11px 18px", textAlign: "left" }}><b>{r.name}</b><div style={{ fontSize: 12, color: HT.muted, fontFamily: "ui-monospace, monospace" }}>{r.gstin}{r.entries === 0 ? " · no entries this month" : ""}</div></td>
                      {r.error ? <td colSpan={4} style={{ padding: 10, color: "#B4321F", textAlign: "left" }}>{r.error}</td> : <>
                        <td style={{ padding: 10 }}>{inr(r.taxable ?? 0)}{(r.exempt ?? 0) > 0 && <div style={{ fontSize: 11.5, color: HT.muted }}>+ {inr(r.exempt ?? 0)} exempt / non-GST</div>}</td>
                        <td style={{ padding: 10 }}>{inr(r.output ?? 0)}</td><td style={{ padding: 10 }}>{inr(r.itc ?? 0)}</td>
                        <td style={{ padding: 10, fontWeight: 700 }}>{inr(r.net ?? 0)}</td></>}
                      <td style={{ padding: 10, textAlign: "center" }}>{pill(a)}</td>
                      <td style={{ padding: 10, textAlign: "center" }}>{pill(b)}</td>
                      <td style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
                        <button type="button" onClick={() => open(r, "/finance/gst")} style={{ height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${HT.line}`, background: "#FFFFFF", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, marginRight: 6 }}>GSTR-1</button>
                        <button type="button" onClick={() => open(r, "/finance/gst/3b")} style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "none", background: "#12352D", color: "#FFFFFF", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>3B</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div style={{ fontSize: 13, color: HT.muted, lineHeight: 1.6 }}>
          Filing status comes from the GST portal (Portal Connect) or from returns filed through FreBook. Quarterly (QRMP) and composition clients follow the scheme set on each client&apos;s GST returns page.
          {noGstin > 0 && ` ${noGstin} business${noGstin === 1 ? " has" : "es have"} no GSTIN and ${noGstin === 1 ? "isn't" : "aren't"} listed.`}
        </div>
      </div>
    </div>
  );
}
