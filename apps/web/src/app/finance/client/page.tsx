"use client";
// Client view — what a CA firm's client sees: their own books, read-only. Figures for the chosen year, the reports
// and documents to open, and what's due. Nothing here records or changes an entry.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { useFinancialYear } from "@/lib/selectedFy";
import type { Dashboard } from "@/lib/dashboard";
import PageHero, { HeroFyPicker, HT, SERIF } from "@/components/finance/PageHero";

const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n || 0)).toLocaleString("en-IN");
const REPORTS: { href: string; title: string; note: string }[] = [
  { href: "/finance/reports?tab=profit_loss", title: "Profit & Loss", note: "Income, expenses and the result for the year" },
  { href: "/finance/reports?tab=balance_sheet", title: "Balance Sheet", note: "What the business owns and owes" },
  { href: "/finance/reports?tab=trial_balance", title: "Trial Balance", note: "Every ledger's balance" },
  { href: "/finance/ledger", title: "Ledgers", note: "Entries in any account" },
  { href: "/finance/receivables", title: "Receivables", note: "Who owes you" },
  { href: "/finance/payables", title: "Payables", note: "Whom you owe" },
  { href: "/finance/shelf", title: "Documents", note: "Returns, bills and statements filed for you" },
  { href: "/finance/audit360", title: "Audit", note: "Checks on your books and returns" },
];

export default function ClientHome() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [biz, setBiz] = useState<{ name: string; gstin: string | null } | null>(null);
  const { years, fy, setFy } = useFinancialYear(bizId);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login?next=/finance/client"); return; }
      const id = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!id) { router.push("/finance/select-business"); return; }
      setBizId(id);
      const { data } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("id", id).maybeSingle();
      setBiz(data ? { name: data.name, gstin: data.gstin } : null);
    });
  }, [router]);

  useEffect(() => {
    if (!bizId || !fy) return;
    setDash(null); setErr("");
    fetch(`/api/finance/dashboard?business_id=${bizId}&fy_id=${fy.id}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't load your figures."); else setDash(d as Dashboard);
    }).catch(() => setErr("Couldn't load your figures."));
  }, [bizId, fy]);

  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const due = (dash?.compliance ?? []).filter(c => c.daysLeft >= -30).slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow={`Your books · view only${fy ? ` · FY ${fy.label.replace(/^FY\s*/i, "")}` : ""}`}
        title={biz?.name ?? "Your business"}
        sub={`${biz?.gstin ? `GSTIN ${biz.gstin} · ` : ""}Kept by your accountant on FreBook. You can view and download; entries are made by your accountant.`}
        actions={<HeroFyPicker years={years} value={fy?.id ?? ""} onChange={setFy} />}
        tiles={dash ? [
          { label: "Income", value: inr(dash.revenue) },
          { label: "Expenses", value: inr(dash.expenses) },
          { label: dash.profit < 0 ? "Loss" : "Profit", value: inr(dash.profit), tone: dash.profit < 0 ? "bad" : "good" },
          { label: "Cash & bank", value: inr(dash.cash), tone: dash.cash < 0 ? "bad" : "plain" },
        ] : undefined} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        {err && <div role="alert" style={{ ...card, padding: "14px 18px", color: "#B4321F" }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          {dash && [["Customers owe you", dash.receivables > 0 ? dash.receivables : 0, "/finance/receivables"], ["You owe suppliers", dash.payables > 0 ? dash.payables : 0, "/finance/payables"]].map(([l, v, h]) => (
            <Link key={String(l)} href={String(h)} style={{ ...card, padding: "16px 20px", textDecoration: "none", color: HT.ink, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: HT.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l}</span>
              <span style={{ fontSize: 26 }}>{inr(Number(v))}</span>
            </Link>
          ))}
        </div>

        <section style={card} aria-labelledby="rep-h">
          <h2 id="rep-h" style={{ margin: 0, padding: "18px 22px 6px", fontSize: 22, fontWeight: 400, fontStyle: "italic" }}>Reports and documents</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 1, background: HT.line, borderTop: `1px solid ${HT.line}`, borderRadius: "0 0 18px 18px", overflow: "hidden" }}>
            {REPORTS.map(r => (
              <Link key={r.href} href={r.href} style={{ background: HT.paper, padding: "16px 22px", textDecoration: "none", color: HT.ink, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{r.title} →</span>
                <span style={{ fontSize: 13, color: HT.muted }}>{r.note}</span>
              </Link>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22, alignItems: "start" }}>
          <section style={card} aria-labelledby="due-h">
            <h2 id="due-h" style={{ margin: 0, padding: "18px 22px 10px", fontSize: 22, fontWeight: 400, fontStyle: "italic" }}>Coming up</h2>
            {!due.length && <div style={{ padding: "0 22px 18px", color: HT.muted, fontSize: 14 }}>{dash ? "Nothing due soon." : "…"}</div>}
            {due.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderTop: `1px solid ${HT.line}`, fontSize: 14.5 }}>
                <span><b>{c.title}</b> <span style={{ color: HT.muted }}>· {c.period}</span></span>
                <span style={{ whiteSpace: "nowrap", color: c.daysLeft < 0 ? "#B4321F" : c.daysLeft <= 7 ? "#9A6B22" : HT.muted }}>{c.daysLeft < 0 ? `${-c.daysLeft} days late` : c.daysLeft === 0 ? "today" : `in ${c.daysLeft} days`}</span>
              </div>
            ))}
          </section>
          <section style={card} aria-labelledby="rec-h">
            <h2 id="rec-h" style={{ margin: 0, padding: "18px 22px 10px", fontSize: 22, fontWeight: 400, fontStyle: "italic" }}>Latest entries</h2>
            {(dash?.recent ?? []).slice(0, 8).map(r => (
              <Link key={r.id} href={`/finance/journals?id=${r.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderTop: `1px solid ${HT.line}`, fontSize: 14.5, color: HT.ink, textDecoration: "none" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ color: HT.muted }}>{r.date.slice(8, 10)}/{r.date.slice(5, 7)} · </span>{r.narration || r.entry_no}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{inr(r.amount)}</span>
              </Link>
            ))}
            {dash && !dash.recent.length && <div style={{ padding: "0 22px 18px", color: HT.muted, fontSize: 14 }}>No entries yet this year.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
