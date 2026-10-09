"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { reminderText, type Debtor, type Tone } from "@/lib/collect";
import { formatMoney } from "@/lib/money";
import { FreBookMark } from "@/components/FreBookLogo";

type Data = { total: number; buckets: Record<"0-30" | "31-60" | "60+", number>; collectedThisMonth: number; debtors: Debtor[]; business: string; currency: string; locale: string };

const C = { bg: "#F5F6FA", surface: "#FFFFFF", line: "#E1E4EE", strong: "#C9CEDF", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", soft: "#E6E8F4", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB", wa: "#0B7A55" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const BUCKET = { "0-30": { label: "0–30 days", color: "#8C93C4" }, "31-60": { label: "31–60 days", color: "#C9A24A" }, "60+": { label: "60+ days", color: C.neg } } as const;

export default function CollectPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>("polite");
  const [upi, setUpi] = useState("");
  const [bizId, setBizId] = useState("");
  const [phoneEdit, setPhoneEdit] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
      try { setUpi(localStorage.getItem(`fw_upi_${biz}`) ?? ""); } catch { /* storage blocked */ }
      const res = await fetch(`/api/finance/collect?business_id=${biz}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "Couldn't load receivables."); return; }
      setData(d); setSel(d.debtors[0]?.name ?? null);
    });
  }, [router]);

  const fmt = useMemo(() => (n: number) => formatMoney(n, { currency: data?.currency ?? "INR", locale: data?.locale ?? "en-IN" }, { decimals: false }), [data]);
  const d = data?.debtors.find(x => x.name === sel) ?? null;
  const msg = d && data ? reminderText(d, data.business || "Your supplier", tone, fmt, upi.trim() || null) : "";
  const phoneOf = (x: Debtor) => (phoneEdit[x.name] ?? x.phone ?? "").replace(/\D/g, "");
  const waLink = (x: Debtor, text: string) => { const p = phoneOf(x); const num = p.length === 10 ? `91${p}` : p; return `https://wa.me/${num}?text=${encodeURIComponent(text)}`; };
  const overdue = data?.debtors.filter(x => x.oldestDays > 30) ?? [];

  const saveUpi = (v: string) => { setUpi(v); try { localStorage.setItem(`fw_upi_${bizId}`, v); } catch { /* ignore */ } };
  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18 };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{`.cl-split{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:20px;align-items:start}.cl-row:hover{background:#F7F8FC}@media(max-width:960px){.cl-split{grid-template-columns:minmax(0,1fr)}}`}</style>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 28px", borderBottom: `1px solid ${C.line}`, background: C.surface }}>
        <FreBookMark size={30} />
        <Link href="/finance" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>FreBook</Link>
        <span style={{ color: C.strong }}>/</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Collect payments</span>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        {err && <div style={{ ...card, padding: 16, color: C.neg }}>{err}</div>}

        <section style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Customers owe you</div>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(36px,5vw,56px)", fontWeight: 700 }}>{data ? fmt(data.total) : "…"}</h1>
            <div style={{ fontSize: 14, color: C.pos, fontWeight: 600, marginTop: 4 }}>{data ? `${fmt(data.collectedThisMonth)} collected this month` : ""}</div>
          </div>
          {overdue.length > 0 && <span style={{ fontSize: 13, color: C.muted, maxWidth: 320 }}>{overdue.length} customer{overdue.length > 1 ? "s are" : " is"} more than 30 days overdue. Open each one and send its reminder from WhatsApp.</span>}
        </section>

        {data && data.total > 0 && (
          <section aria-label="Ageing" style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.soft }}>
              {(Object.keys(BUCKET) as (keyof typeof BUCKET)[]).map(k => data.buckets[k] > 0 && <span key={k} style={{ width: `${(data.buckets[k] / data.total) * 100}%`, background: BUCKET[k].color }} />)}
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 14 }}>
              {(Object.keys(BUCKET) as (keyof typeof BUCKET)[]).map(k => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: BUCKET[k].color }} /><span style={{ color: C.muted }}>{BUCKET[k].label}</span><b style={{ fontFamily: MONO, fontWeight: 600 }}>{fmt(data.buckets[k])}</b></span>
              ))}
            </div>
          </section>
        )}

        <div className="cl-split">
          <section style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 20 }}>Who to follow up</h2>
              <span style={{ fontSize: 12, color: C.muted }}>Oldest debt first</span>
            </div>
            {!data ? <div style={{ padding: 20, color: C.muted }}>Loading…</div>
              : data.debtors.length === 0 ? <div style={{ padding: 20, color: C.pos, fontWeight: 600 }}>✓ Nobody owes you anything right now.</div>
              : data.debtors.map(x => (
                <button key={x.name} className="cl-row" onClick={() => setSel(x.name)} style={{ width: "100%", textAlign: "left", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14, alignItems: "center", padding: "14px 20px", border: "none", borderTop: `1px solid ${C.line}`, background: sel === x.name ? C.soft : "transparent", cursor: "pointer", color: C.ink, minHeight: 56 }}>
                  <span><span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{x.name}</span><span style={{ fontSize: 12.5, color: C.muted }}>{x.open.length} invoice{x.open.length > 1 ? "s" : ""}{x.lastPayment ? ` · last paid ${new Date(x.lastPayment + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : " · no payments yet"}</span></span>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 6, background: x.bucket === "60+" ? C.negSoft : x.bucket === "31-60" ? C.warnSoft : C.soft, color: x.bucket === "60+" ? C.neg : x.bucket === "31-60" ? C.warn : C.primary }}>{x.oldestDays} days</span>
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, minWidth: 96, textAlign: "right" }}>{fmt(x.balance)}</span>
                </button>
              ))}
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {d ? (
              <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>REMINDER PREVIEW · WHATSAPP</h2>
                <div style={{ background: "#E7F3EC", borderRadius: "14px 14px 14px 4px", padding: "12px 14px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg}</div>
                <div role="radiogroup" aria-label="Tone" style={{ display: "flex", gap: 6 }}>
                  {(["polite", "firm", "malayalam"] as Tone[]).map(t => (
                    <button key={t} role="radio" aria-checked={tone === t} onClick={() => setTone(t)} style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${tone === t ? C.primary : C.line}`, background: tone === t ? C.soft : "transparent", color: tone === t ? C.primary : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t === "malayalam" ? "Malayalam" : t[0].toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted }}>
                  Customer&apos;s WhatsApp number
                  <input value={phoneEdit[d.name] ?? d.phone ?? ""} onChange={e => setPhoneEdit(p => ({ ...p, [d.name]: e.target.value }))} placeholder="10-digit mobile" inputMode="tel" style={{ height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 14, fontFamily: MONO, color: C.ink }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted }}>
                  Your UPI ID (adds a pay link)
                  <input value={upi} onChange={e => saveUpi(e.target.value)} placeholder="yourbusiness@bank" style={{ height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 14, fontFamily: MONO, color: C.ink }} />
                </label>
                {phoneOf(d).length >= 10
                  ? <a href={waLink(d, msg)} target="_blank" rel="noopener noreferrer" style={{ height: 46, borderRadius: 12, background: C.wa, color: "#FFFFFF", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Open in WhatsApp</a>
                  : <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, borderRadius: 10, padding: "10px 12px" }}>Add the customer&apos;s number above (or in Customers &amp; Suppliers) to send this on WhatsApp.</div>}
                <div style={{ fontSize: 12, color: C.muted }}>WhatsApp opens with the message ready — you press send. FreBook never messages customers by itself.</div>
              </section>
            ) : null}
            {d && (
              <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>OPEN INVOICES · {d.name.toUpperCase()}</h2>
                {d.open.map(i => (
                  <div key={i.ref + i.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, gap: 10 }}>
                    <span><b style={{ fontFamily: MONO, fontWeight: 500 }}>{i.ref}</b> <span style={{ color: C.muted }}>· {new Date(i.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {i.days}d</span></span>
                    <span style={{ fontFamily: MONO }}>{fmt(i.amount)}</span>
                  </div>
                ))}
                <Link href={`/finance/chat-book?prefill=${encodeURIComponent(`Received ₹ from ${d.name} against ${d.open[0]?.ref ?? ""}`)}`} style={{ marginTop: 6, height: 42, borderRadius: 11, border: `1px solid ${C.strong}`, color: C.ink, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Record a payment from {d.name}</Link>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
