"use client";
import { dueChip } from "@/lib/dueText";
// GST Returns centre — every GST return in one place: what's due next, and where to prepare each one.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { dueDates, type Scheme } from "@/lib/gstReturns";
import { usePortalFilings } from "@/lib/portals/usePortalFilings";
import { filingForDue } from "@/lib/portals/filings";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", neg: "#C2321F", negSoft: "#FDECEA", amber: "#8A5A00", amberSoft: "#FFF4DB", pos: "#0B7A55", posSoft: "#E3F6EE" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";

type R = { form: string; name: string; who: string; when: string; how: string; href?: string; schemes: Scheme[] };
const RETURNS: R[] = [
  { form: "GSTR-1", name: "Outward supplies (sales)", who: "Regular taxpayers", when: "11th monthly · 13th quarterly (QRMP)", how: "Prepared from your invoices — download the JSON and upload on the portal", href: "/finance/gst", schemes: ["monthly", "qrmp"] },
  { form: "IFF", name: "Invoice Furnishing Facility", who: "QRMP taxpayers (optional)", when: "13th of months 1 and 2 of the quarter", how: "B2B invoices only — same data as GSTR-1", href: "/finance/gst", schemes: ["qrmp"] },
  { form: "GSTR-3B", name: "Summary return & tax payment", who: "Regular taxpayers", when: "20th monthly · 22nd/24th quarterly", how: "Tables 3.1, 3.2, 4 and 6.1 with ITC set-off worked out", href: "/finance/gst/3b", schemes: ["monthly", "qrmp"] },
  { form: "PMT-06", name: "Monthly tax payment (QRMP)", who: "QRMP taxpayers", when: "25th of months 1 and 2", how: "Use the GSTR-3B worksheet for the month's cash amount", href: "/finance/gst/3b", schemes: ["qrmp"] },
  { form: "GSTR-2B", name: "ITC statement (auto-drafted)", who: "Everyone claiming ITC", when: "Available on the 14th", how: "Match with your purchases and get Table 4", href: "/finance/gst/itc", schemes: ["monthly", "qrmp"] },
  { form: "GSTR-9", name: "Annual return", who: "Regular taxpayers above ₹2 crore turnover (optional below)", when: "31 December after the year", how: "Year's outward supplies, ITC and tax, month by month", href: "/finance/gst/annual", schemes: ["monthly", "qrmp"] },
  { form: "GSTR-9C", name: "Reconciliation statement", who: "Turnover above ₹5 crore", when: "With GSTR-9", how: "Books vs returns — use the GSTR-9 worksheet; self-certified", href: "/finance/gst/annual", schemes: ["monthly", "qrmp"] },
  { form: "CMP-08", name: "Composition tax payment", who: "Composition dealers", when: "18th after each quarter", how: "Turnover × your composition rate", href: "/finance/gst/composition", schemes: ["composition"] },
  { form: "GSTR-4", name: "Composition annual return", who: "Composition dealers", when: "30 April after the year", how: "Total of the four CMP-08 statements", href: "/finance/gst/composition", schemes: ["composition"] },
  { form: "GSTR-7", name: "TDS under GST", who: "Government departments & notified deductors", when: "10th monthly", how: "Ask an expert — rarely needed by small businesses", schemes: ["monthly", "qrmp"] },
  { form: "GSTR-8", name: "TCS by e-commerce operators", who: "Marketplaces collecting TCS", when: "10th monthly", how: "Ask an expert — sellers see this TCS in their ledger instead", schemes: ["monthly", "qrmp"] },
  { form: "ITC-04", name: "Goods sent for job work", who: "Principals sending goods to job workers", when: "Half-yearly/annual by turnover", how: "Ask an expert", schemes: ["monthly", "qrmp"] },
];

export default function GstReturnsCentre() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [gstin, setGstin] = useState("");
  const [scheme, setScheme] = useState<Scheme>("monthly");
  const portal = usePortalFilings(bizId);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      try { const s = localStorage.getItem(`fw_gst_scheme_${saved}`); if (s === "monthly" || s === "qrmp" || s === "composition") setScheme(s); } catch { /* */ }
      const { data } = await supabase.from("fw_fin_businesses").select("gstin").eq("id", saved).single();
      setGstin(data?.gstin ?? "");
    });
  }, [router]);

  const choose = (s: Scheme) => { setScheme(s); try { localStorage.setItem(`fw_gst_scheme_${bizId}`, s); } catch { /* */ } };
  const today = new Date().toLocaleDateString("en-CA");
  const due = useMemo(() => dueDates(today, scheme), [today, scheme]);
  const days = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400000);
  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>GST RETURNS</div>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.8rem,3.6vw,2.6rem)", fontWeight: 700 }}>Every return, <span style={{ fontStyle: "italic", fontWeight: 400, color: "#8A6420" }}>prepared from your books</span></h1>
            <div style={{ fontSize: 13, color: C.muted }}>{gstin ? `GSTIN ${gstin}` : <Link href="/finance/settings/business" style={{ color: C.neg }}>Add your GSTIN →</Link>}</div>
          </div>
          <div role="radiogroup" aria-label="Filing scheme" style={{ display: "flex", gap: 4, background: "#EFE8D9", borderRadius: 999, padding: 4 }}>
            {([["monthly", "Monthly"], ["qrmp", "Quarterly (QRMP)"], ["composition", "Composition"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={scheme === k} onClick={() => choose(k)} style={{ height: 36, padding: "0 14px", borderRadius: 999, border: "none", background: scheme === k ? C.forest : "transparent", color: scheme === k ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
        </header>

        <section style={{ ...card, background: C.forest, color: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, fontWeight: 800 }}>Due in the next 60 days</div>
            {portal.linked
              ? <span style={{ fontSize: 12, color: "#C9D3CE" }}>Filing status from the GST portal · <Link href="/finance/portals" style={{ color: C.gold }}>Portal Connect</Link></span>
              : <Link href="/finance/portals" style={{ fontSize: 12, color: C.gold }}>Link your GSTIN to see what&apos;s already filed →</Link>}
          </div>
          {due.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {due.map(d => { const n = days(d.due); const f = filingForDue(portal.statuses, d); return (
                <Link key={d.form + d.due} href={d.href} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(217,181,111,0.3)", borderRadius: 14, padding: "12px 14px", color: "#FFFFFF", textDecoration: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 16 }}>{d.form}</b>{f
                    ? <span style={{ fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: C.posSoft, color: C.pos }}>Filed ✓</span>
                    : <span style={{ fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: n <= 3 ? C.negSoft : n <= 10 ? C.amberSoft : C.posSoft, color: n <= 3 ? C.neg : n <= 10 ? C.amber : C.pos }}>{dueChip(n)}</span>}</span>
                  <span style={{ fontSize: 13, color: "#C9D3CE" }}>{d.label} · {d.period}</span>
                  {f
                    ? <span style={{ fontSize: 12.5, color: "#9FE3C6", overflowWrap: "anywhere" }}>Filed ✓{f.on ? ` ${new Date(`${f.on}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}` : ""}{f.arn ? ` · ARN ${f.arn}` : ""}</span>
                    : <span style={{ fontSize: 12.5, color: C.gold }}>Due {new Date(d.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · Prepare →</span>}
                </Link>); })}
            </div>
          ) : <div style={{ color: "#C9D3CE" }}>Nothing due in the next 60 days.</div>}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {RETURNS.filter(r => r.schemes.includes(scheme)).map(r => (
            <article key={r.form} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><b style={{ fontFamily: SERIF, fontSize: "1.35rem" }}>{r.form}</b><span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</span></div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{r.who} · {r.when}</div>
              <div style={{ fontSize: 13.5, flex: 1 }}>{r.how}</div>
              {r.href
                ? <Link href={r.href} style={{ alignSelf: "flex-start", height: 38, padding: "0 16px", borderRadius: 999, background: C.forest, color: "#FFFFFF", fontWeight: 800, fontSize: 13.5, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Prepare {r.form} →</Link>
                : <Link href="/order?service=gst-registration" style={{ alignSelf: "flex-start", height: 38, padding: "0 16px", borderRadius: 999, border: "1px solid #D9CDB2", color: C.ink, fontWeight: 800, fontSize: 13.5, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Ask an expert</Link>}
            </article>
          ))}
        </section>

        <section style={{ ...card, fontSize: 13.5, lineHeight: 1.7 }}>
          <b>Filing directly from FreWork</b><br />
          Today FreWork prepares each return; you file it on the GST portal in a few minutes (upload the GSTR-1 JSON, enter or paste the GSTR-3B tables, pay, and verify with EVC/DSC).
          One-click filing from FreWork needs a connection through a licensed GST Suvidha Provider (GSP) — it will appear here once that is set up. Prefer not to file yourself? <Link href="/order?service=gst-registration" style={{ color: "#1F5EFF", fontWeight: 700 }}>An expert can file it for you</Link>.
        </section>
      </div>
    </div>
  );
}
