"use client";
// Guided setup — five steps from a new account to books in Tally. Each step ticks itself when it's done.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTally } from "@/lib/tallyConnection";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", pos: "#0B7A55", posSoft: "#E3F6EE" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";

type Step = { key: string; title: string; why: string; href: string; cta: string; minutes: number; done: boolean };

export default function GuidedSetup() {
  const router = useRouter();
  const tally = useTally();
  const [s, setS] = useState({ details: false, opening: false, statement: false, entries: 0, invoice: false, name: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      const base = () => supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", biz);
      const [{ data: b }, opening, statement, entries, invoice] = await Promise.all([
        supabase.from("fw_fin_businesses").select("name,gstin,state").eq("id", biz).single(),
        base().eq("source", "opening_balances").then(r => r.count ?? 0),
        base().eq("source", "statement").then(r => r.count ?? 0),
        base().eq("status", "posted").then(r => r.count ?? 0),
        base().eq("type", "sales").then(r => r.count ?? 0),
      ]);
      setS({ details: !!(b?.gstin || b?.state), opening: opening > 0, statement: statement > 0, entries, invoice: invoice > 0, name: b?.name ?? "" });
      setLoaded(true);
    });
  }, [router]);

  const steps: Step[] = [
    { key: "details", title: "Business details", why: "GSTIN and state decide CGST/SGST vs IGST on every entry.", href: "/finance/settings/business", cta: "Add details", minutes: 1, done: s.details },
    { key: "tally", title: "Connect Tally (optional)", why: "Open Tally, run the FreWork Tally Bridge, press Connect. Entries then go to Tally in one click.", href: "/finance/tally", cta: "Connect Tally", minutes: 3, done: tally.status === "connected" },
    { key: "opening", title: "Opening balances", why: "Upload last year's trial balance — FreWork creates the ledgers and balances.", href: "/finance/opening-balances", cta: "Upload trial balance", minutes: 2, done: s.opening },
    { key: "inbox", title: "Drop your first files", why: "Bank statements, bills and invoices into Smart Inbox — entries are drafted for you.", href: "/finance/inbox", cta: "Open Smart Inbox", minutes: 3, done: s.statement || s.entries >= 5 },
    { key: "invoice", title: "Raise an invoice", why: "GST invoice with your logo; it goes straight into GSTR-1.", href: "/finance/sales/new", cta: "New invoice", minutes: 1, done: s.invoice },
  ];
  const done = steps.filter(x => x.done).length;
  const next = steps.find(x => !x.done);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(16px,3vw,36px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <header>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>GET STARTED{s.name ? ` · ${s.name.toUpperCase()}` : ""}</div>
          <h1 style={{ margin: "6px 0 4px", fontFamily: SERIF, fontSize: "clamp(1.9rem,4vw,2.8rem)", fontWeight: 700, lineHeight: 1.1 }}>Books ready in about <span style={{ fontStyle: "italic", fontWeight: 400, color: "#8A6420" }}>10 minutes</span></h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <div aria-hidden="true" style={{ flex: 1, height: 10, borderRadius: 999, background: "#E6DFD0", overflow: "hidden" }}><div style={{ width: `${(done / steps.length) * 100}%`, height: "100%", background: C.pos, transition: "width .4s" }} /></div>
            <b style={{ fontSize: 14 }} aria-live="polite">{loaded ? `${done} of ${steps.length} done` : "Checking…"}</b>
          </div>
        </header>

        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((x, i) => {
            const isNext = next?.key === x.key;
            return (
              <li key={x.key} style={{ background: C.card, border: `1px solid ${isNext ? C.gold : C.line}`, borderRadius: 18, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", boxShadow: isNext ? "0 16px 36px -26px rgba(15,43,37,0.6)" : "none" }}>
                <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: "50%", background: x.done ? C.pos : isNext ? C.forest : "#EFE8D9", color: x.done || isNext ? "#FFFFFF" : C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{x.done ? "✓" : i + 1}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <b style={{ fontSize: 16, textDecoration: x.done ? "line-through" : "none", color: x.done ? C.muted : C.ink }}>{x.title}</b> <span style={{ fontSize: 12, color: C.muted }}>· ~{x.minutes} min</span>
                  <div style={{ fontSize: 13.5, color: C.muted }}>{x.why}</div>
                </div>
                {x.done ? <span style={{ fontSize: 12.5, fontWeight: 800, color: C.pos, background: C.posSoft, padding: "4px 10px", borderRadius: 999 }}>Done</span>
                  : <Link href={x.href} style={{ height: 40, padding: "0 18px", borderRadius: 999, background: isNext ? C.forest : "#FFFFFF", border: isNext ? "none" : "1px solid #D9CDB2", color: isNext ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{x.cta} →</Link>}
              </li>
            );
          })}
        </ol>

        {done === steps.length && (
          <section style={{ background: C.forest, color: "#FFFFFF", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <b style={{ fontFamily: SERIF, fontSize: "1.3rem", flex: 1 }}>All set. From now on, just drop files in Smart Inbox or tell FreBook what happened.</b>
            <Link href="/finance" style={{ height: 42, padding: "0 18px", borderRadius: 999, background: C.gold, color: C.forest, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Go to Home →</Link>
          </section>
        )}
        <p style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>You can skip any step and come back — this page remembers what&apos;s done.</p>
      </div>
    </div>
  );
}
