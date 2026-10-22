"use client";
// Admin: running costs, measured — AI calls and tokens, WhatsApp messages, storage. Fixed plans (Vercel, Supabase) listed alongside.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Costs = {
  setup: string | null; usdInr: number;
  month: { label: string; dayOfMonth: number; daysInMonth: number };
  ai: { model: string; provider: string; calls: number; input: number; output: number; usd: number; inr: number }[];
  totals: { aiCalls: number; aiInr: number; waReplies: number; waBusiness: number; waInr: number; mtdInr: number; projectedInr: number };
  storage: { files: number; bytes: number };
  books: { journals: number; businesses: number };
  daily: { day: string; ai: number; wa: number; inr: number }[];
  capacity: { dbBytes: number; storageBytes: number; storageFiles: number; users: number; mau: number } | null;
  capacitySetup: string | null;
  services?: Services;
  whatsapp: { tier: string | null; limit: number | null; quality: string | null; name_status: string | null; peakBusinessPerDay: number } | null;
};

// Plan limits — what each Supabase plan includes
const PLANS = {
  free: { label: "Free", db: 0.5 * 1073741824, files: 1073741824, mau: 50000 },
  pro: { label: "Pro", db: 8 * 1073741824, files: 100 * 1073741824, mau: 100000 },
} as const;

function Gauge({ label, used, limit, show, hint }: { label: string; used: number; limit: number | null; show: string; hint: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone = !limit ? "#5A6080" : pct >= 90 ? "#C2321F" : pct >= 70 ? "#B87800" : "#0B7A55";
  const word = !limit ? "No limit" : pct >= 90 ? "Upgrade now" : pct >= 70 ? "Plan an upgrade" : "OK";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #E1E4EE", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: tone, background: tone + "1A" }}>{word}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#EEF0F6", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(limit ? 2 : 0, pct)}%`, height: "100%", background: tone, borderRadius: 999, transition: "width .6s" }} />
      </div>
      <div style={{ display: "flex", fontSize: 12, color: "#5A6080" }}><span>{show}</span><span style={{ marginLeft: "auto" }}>{limit ? `${pct < 1 && pct > 0 ? "<1" : Math.round(pct)}% used` : ""}</span></div>
      <div style={{ fontSize: 11.5, color: "#5A6080", lineHeight: 1.45 }}>{hint}</div>
    </div>
  );
}

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", gold: "#C9A24A", pos: "#0B7A55", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => n.toLocaleString("en-IN");
const tok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
const size = (b: number) => b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${Math.round(b / 1048576)} MB`;

type Services = Record<"vercel" | "supabase" | "github" | "gemini" | "claude" | "whatsapp" | "gupshup" | "resend" | "fly" | "sandbox" | "deepvue" | "setu" | "razorpay" | "phonepe" | "zoho" | "qbo", boolean>
  & { geminiModel: string; used: { geminiToday: number; geminiMonth: number; claudeMonth: number; itJobsMonth: number } };

// Fixed monthly plans — follow the plan chosen in the selectors
const VERCEL = { hobby: { label: "Hobby", inr: 0 }, pro: { label: "Pro", inr: 1700 } } as const;
const SUPA_INR = { free: 0, pro: 2125 } as const;

// Every outside service FreBook calls: what it's for, the plan's limits (as published — confirm on the provider's page) and where to manage it
type SvcRow = { key: keyof Omit<Services, "geminiModel" | "used">; name: string; use: string; plan: string; limits: string; used?: string; warn?: string; href: string };
function serviceRows(s: Services, d: Costs, vercel: keyof typeof VERCEL, supa: "free" | "pro"): SvcRow[] {
  const lite = /lite/i.test(s.geminiModel);
  const geminiRpd = lite ? 1000 : 250;
  return [
    { key: "vercel", name: "Vercel", use: "Hosts the website and FreBook", plan: VERCEL[vercel].label,
      limits: vercel === "hobby" ? "100 GB bandwidth/month · functions up to 60 s · non-commercial use only" : "1 TB bandwidth/month · longer functions · team seats billed",
      warn: vercel === "hobby" ? "Hobby is for non-commercial use — move to Pro before charging customers." : undefined, href: "https://vercel.com/fasalk06-8613s-projects/frework-api/usage" },
    { key: "supabase", name: "Supabase", use: "Database, sign-in, file storage", plan: supa === "pro" ? "Pro" : "Free",
      limits: supa === "pro" ? "8 GB database · 100 GB files · 100,000 monthly users · 250 GB egress" : "500 MB database · 1 GB files · 50,000 monthly users · 5 GB egress · pauses after 7 days idle",
      used: d.capacity ? `${size(d.capacity.dbBytes)} DB · ${size(d.capacity.storageBytes)} files · ${num(d.capacity.mau)} users` : undefined, href: "https://supabase.com/dashboard/project/nmkpjliythusgleozbqi/settings/billing/usage" },
    { key: "gemini", name: "Google Gemini", use: "Main AI: entries, bills, statements, voice notes", plan: `${s.geminiModel} · free tier unless billing is on`,
      limits: `Free tier: about ${lite ? "15" : "10"} requests/minute and ${num(geminiRpd)}/day. With billing: pay per token, far higher limits.`,
      used: `${num(s.used.geminiToday)} today · ${num(s.used.geminiMonth)} this month`,
      warn: s.used.geminiToday >= geminiRpd * 0.7 ? `Today is at ${Math.round(s.used.geminiToday / geminiRpd * 100)}% of the free daily limit — turn on billing.` : undefined, href: "https://aistudio.google.com/usage" },
    { key: "claude", name: "Anthropic Claude", use: "AI fallback and bank-statement reading", plan: "Prepaid credit", limits: "Pay per token; rate limits rise with credit spent (tier 1 → 4)",
      used: `${num(s.used.claudeMonth)} calls this month`, href: "https://console.anthropic.com/settings/billing" },
    { key: "whatsapp", name: "WhatsApp Cloud API (Meta)", use: "FreBook bot, sign-in codes, reminders", plan: d.whatsapp?.tier ? d.whatsapp.tier.replace("TIER_", "Tier ") : "Business account",
      limits: `Replies within 24 h free · new chats per day: ${d.whatsapp?.limit ? num(d.whatsapp.limit) : "per tier"} · utility/marketing templates billed per message`,
      used: `${num(d.totals.waReplies)} replies · ${num(d.totals.waBusiness)} paid templates`, href: "https://business.facebook.com/wa/manage/home/" },
    { key: "gupshup", name: "Gupshup", use: "WhatsApp backup route", plan: "Pay as you go", limits: "Per-message fee on top of Meta's", href: "https://www.gupshup.io/" },
    { key: "resend", name: "Resend", use: "Emails (alerts, receipts)", plan: "Free unless upgraded", limits: "Free: 3,000 emails/month, 100/day · 1 domain", href: "https://resend.com/overview" },
    { key: "fly", name: "Fly.io", use: "Income-tax portal worker (notices, 26AS, AIS)", plan: "Pay as you go (card on file)", limits: "1 small machine in Singapore · billed per second it runs · a few $ a month at low use",
      used: `${num(s.used.itJobsMonth)} portal fetches this month`, href: "https://fly.io/dashboard" },
    { key: "sandbox", name: "Sandbox (GSP)", use: "GSTR-1 / 3B / 2B download, GST OTP", plan: "Prepaid wallet", limits: "Charged per API call — keep the wallet topped up", href: "https://dashboard.sandbox.co.in/" },
    { key: "deepvue", name: "Deepvue", use: "Portal / KYC lookups", plan: "Prepaid", limits: "Charged per API call", href: "https://dashboard.deepvue.tech/" },
    { key: "setu", name: "Setu Account Aggregator", use: "Live bank feed (consent-based)", plan: "Contract", limits: "Per consent / per fetch pricing", href: "https://bridge.setu.co/" },
    { key: "razorpay", name: "Razorpay", use: "Subscriptions and payments", plan: "Standard", limits: "About 2% per payment + GST · no monthly fee", href: "https://dashboard.razorpay.com/" },
    { key: "phonepe", name: "PhonePe PG", use: "Service orders (payments)", plan: "Standard", limits: "Per-payment fee · no monthly fee", href: "https://business.phonepe.com/" },
    { key: "zoho", name: "Zoho Books", use: "Import from Zoho", plan: "Free API", limits: "Zoho's daily API quota per organisation", href: "https://api-console.zoho.in/" },
    { key: "qbo", name: "QuickBooks Online", use: "Import from QuickBooks", plan: "Free API", limits: "Intuit's API rate limits", href: "https://developer.intuit.com/" },
    { key: "github", name: "GitHub Actions", use: "Deploys the portal worker", plan: "Free (public repo)", limits: "Unlimited minutes for public repositories", href: "https://github.com/" },
  ];
}

export default function AdminCosts() {
  const [d, setD] = useState<Costs | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const r = await fetch("/api/admin/costs", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? "Couldn't load running costs."); return; }
      setD(j);
    });
  }, []);

  const [plan, setPlan] = useState<keyof typeof PLANS>("pro");
  const [vercel, setVercel] = useState<keyof typeof VERCEL>("hobby");
  useEffect(() => { try {
    const p = localStorage.getItem("fw_supabase_plan"); if (p === "free" || p === "pro") setPlan(p);
    const v = localStorage.getItem("fw_vercel_plan"); if (v === "hobby" || v === "pro") setVercel(v);
  } catch { /* */ } }, []);
  const FIXED = [
    { name: `Vercel ${VERCEL[vercel].label}`, inr: VERCEL[vercel].inr, note: "hosting" },
    { name: `Supabase ${PLANS[plan].label}`, inr: SUPA_INR[plan], note: "database, logins, files" },
  ];
  const fixed = FIXED.reduce((s, f) => s + f.inr, 0);
  const P = PLANS[plan];
  const max = Math.max(1, ...(d?.daily ?? []).map(x => x.inr));
  const perBiz = d && d.books.businesses ? (d.totals.projectedInr + fixed) / d.books.businesses : 0;

  return (
    <section style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 20, padding: 20, marginBottom: 24, color: C.ink }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Running costs</h2>
        <span style={{ fontSize: 13, color: C.muted }}>{d ? `${d.month.label} · day ${d.month.dayOfMonth} of ${d.month.daysInMonth}` : "Loading…"}</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted }}>Measured from usage · prices approximate · $1 = ₹{d?.usdInr ?? 85}</span>
      </div>
      {err && <div style={{ color: "#C2321F", fontSize: 13 }}>{err}</div>}
      {d?.setup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{d.setup}</div>}

      {d && <>
        {/* Headline */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 16 }}>
          {[
            { l: "This month so far", v: inr(d.totals.mtdInr), s: "AI + WhatsApp", dark: true },
            { l: "Projected this month", v: inr(d.totals.projectedInr + fixed), s: `incl. fixed plans ${inr(fixed)}` },
            { l: "Per business / month", v: d.books.businesses ? inr(perBiz) : "—", s: `${num(d.books.businesses)} businesses` },
            { l: "AI calls", v: num(d.totals.aiCalls), s: inr(d.totals.aiInr) },
            { l: "WhatsApp", v: num(d.totals.waReplies + d.totals.waBusiness), s: `${num(d.totals.waBusiness)} paid · ${inr(d.totals.waInr)}` },
          ].map(s => (
            <div key={s.l} style={{ borderRadius: 14, padding: "12px 14px", background: s.dark ? "linear-gradient(150deg,#2E3680,#232A63)" : "#F7F8FC", color: s.dark ? "#FFFFFF" : C.ink }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: s.dark ? C.gold : C.muted }}>{s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: s.dark ? "#C9CEEA" : C.muted }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* When to upgrade */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 900 }}>When to upgrade</span>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>Supabase plan
            <select value={plan} onChange={e => { const v = e.target.value as keyof typeof PLANS; setPlan(v); try { localStorage.setItem("fw_supabase_plan", v); } catch { /* */ } }} style={{ height: 28, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 6px", fontSize: 12 }}>
              <option value="free">Free</option><option value="pro">Pro</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>Vercel plan
            <select value={vercel} onChange={e => { const v = e.target.value as keyof typeof VERCEL; setVercel(v); try { localStorage.setItem("fw_vercel_plan", v); } catch { /* */ } }} style={{ height: 28, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 6px", fontSize: 12 }}>
              <option value="hobby">Hobby</option><option value="pro">Pro</option>
            </select>
          </label>
          <span style={{ fontSize: 11.5, color: C.muted }}>Amber at 70% · red at 90%</span>
        </div>
        {d.capacitySetup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{d.capacitySetup}</div>}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 18 }}>
          {d.capacity && <>
            <Gauge label="Database" used={d.capacity.dbBytes} limit={P.db} show={`${size(d.capacity.dbBytes)} of ${size(P.db)}`} hint={plan === "free" ? "Free plan pauses when full — move to Pro (8 GB)." : "Over 8 GB is billed per GB; at 90% consider a larger compute add-on."} />
            <Gauge label="File storage" used={d.capacity.storageBytes} limit={P.files} show={`${size(d.capacity.storageBytes)} of ${size(P.files)} · ${num(d.capacity.storageFiles)} files`} hint="Bills, statements and Shelf documents." />
            <Gauge label="Monthly active users" used={d.capacity.mau} limit={P.mau} show={`${num(d.capacity.mau)} of ${num(P.mau)} · ${num(d.capacity.users)} accounts`} hint="People who signed in during the last 30 days." />
          </>}
          {d.whatsapp ? (
            <Gauge label="WhatsApp daily limit" used={d.whatsapp.peakBusinessPerDay} limit={d.whatsapp.limit} show={`Busiest day ${num(d.whatsapp.peakBusinessPerDay)} of ${d.whatsapp.limit ? num(d.whatsapp.limit) : "unlimited"} · quality ${(d.whatsapp.quality ?? "unknown").toLowerCase()}`}
              hint={d.whatsapp.quality && d.whatsapp.quality !== "GREEN" ? "Quality is not green — Meta may lower the limit. Reduce unwanted messages." : "New chats FreBook can start per day (codes, reminders). Meta raises it as quality stays green; replies are unlimited."} />
          ) : <Gauge label="WhatsApp daily limit" used={0} limit={null} show="Couldn't read from Meta" hint="Check WhatsApp Manager → Messaging limits." />}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginBottom: 18 }}>
          <span style={{ color: C.muted }}>AI credit can&apos;t be read by apps — check:</span>
          <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Gemini usage ↗</a>
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Claude credit ↗</a>
          <a href="https://vercel.com/fasalk06-8613s-projects/frework-api/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Vercel usage ↗</a>
          <a href="https://supabase.com/dashboard/project/nmkpjliythusgleozbqi/settings/billing/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Supabase usage ↗</a>
        </div>

        {/* Subscriptions & limits */}
        {d.services && (() => {
          const rows = serviceRows(d.services, d, vercel, plan);
          const on = rows.filter(x => d.services![x.key]), off = rows.filter(x => !d.services![x.key]);
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900 }}>Subscriptions &amp; limits</span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{on.length} in use · limits as published by each provider — confirm on their page before deciding</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 760, fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead><tr style={{ color: C.muted, textAlign: "left" }}>
                    <th style={{ padding: "6px 8px 6px 0" }}>Service</th><th style={{ padding: "6px 8px" }}>Used for</th><th style={{ padding: "6px 8px" }}>Plan &amp; limits</th><th style={{ padding: "6px 8px" }}>This month</th><th style={{ padding: "6px 0" }} />
                  </tr></thead>
                  <tbody>{on.map(x => (
                    <tr key={x.key} style={{ borderTop: `1px solid ${C.line}`, verticalAlign: "top" }}>
                      <td style={{ padding: "8px 8px 8px 0", fontWeight: 800, whiteSpace: "nowrap" }}>{x.name}</td>
                      <td style={{ padding: 8, color: C.muted }}>{x.use}</td>
                      <td style={{ padding: 8 }}><b>{x.plan}</b><div style={{ color: C.muted, marginTop: 2 }}>{x.limits}</div>
                        {x.warn && <div style={{ marginTop: 4, fontWeight: 700, color: "#C2321F" }}>⚠ {x.warn}</div>}</td>
                      <td style={{ padding: 8, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{x.used ?? <span style={{ color: C.muted }}>not measured</span>}</td>
                      <td style={{ padding: "8px 0", whiteSpace: "nowrap" }}><a href={x.href} target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Manage ↗</a></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {off.length > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Not set up (no keys): {off.map(x => x.name).join(" · ")}</div>}
            </div>
          );
        })()}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {/* Daily cost */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Variable cost per day · last 30 days</div>
            <div role="img" aria-label="Cost per day" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, borderBottom: `1px solid ${C.line}` }}>
              {d.daily.map(x => (
                <span key={x.day} title={`${x.day}: ${inr(x.inr)} · ${x.ai} AI calls · ${x.wa} WhatsApp`} style={{ flex: 1, height: `${(x.inr / max) * 100}%`, minHeight: x.inr ? 2 : 0, background: C.navy, borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
              ))}
            </div>
          </div>

          {/* AI by model */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>AI by model · this month</div>
            {d.ai.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>No AI calls recorded yet.</div> : (
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead><tr style={{ color: C.muted, textAlign: "left" }}><th style={{ padding: "4px 0" }}>Model</th><th style={{ textAlign: "right" }}>Calls</th><th style={{ textAlign: "right" }}>Tokens in / out</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                <tbody>{d.ai.map(m => (
                  <tr key={m.provider + m.model} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 0" }}>{m.model} <span style={{ color: C.muted }}>· {m.provider}</span></td>
                    <td style={{ textAlign: "right" }}>{num(m.calls)}</td>
                    <td style={{ textAlign: "right", color: C.muted }}>{tok(m.input)} / {tok(m.output)}</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{inr(m.inr)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {/* Fixed + storage */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Plans & storage</div>
            {FIXED.map(f => (
              <div key={f.name} style={{ display: "flex", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
                <span>{f.name} <span style={{ color: C.muted }}>· {f.note}</span></span><b style={{ marginLeft: "auto" }}>{inr(f.inr)}</b>
              </div>
            ))}
            <div style={{ display: "flex", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
              <span>Shelf files <span style={{ color: C.muted }}>· {num(d.storage.files)} files</span></span><b style={{ marginLeft: "auto" }}>{size(d.storage.bytes)}</b>
            </div>
            <div style={{ display: "flex", fontSize: 13, padding: "5px 0" }}>
              <span>Journal entries</span><b style={{ marginLeft: "auto" }}>{num(d.books.journals)}</b>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Fixed plans follow the selectors above. Razorpay fees (~2% + GST) come out of each payment, not counted here.</div>
          </div>
        </div>
      </>}
    </section>
  );
}
