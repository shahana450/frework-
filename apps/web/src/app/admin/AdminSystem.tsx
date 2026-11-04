"use client";
// Staff console tabs beyond the lists: usage & costs, system health, and brands & domains.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRANDS } from "@/lib/brand";
import AdminCosts from "../dashboard/AdminCosts";
import AdminWhatsApp from "../dashboard/AdminWhatsApp";

const C = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", tile: "#FFFDF8", green: "#12352D", gold: "#9A6B22", goldSoft: "#F3E8D2", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#B4321F", negSoft: "#FBE3DE", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const card: React.CSSProperties = { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, color: C.ink };
const h2: React.CSSProperties = { margin: "0 0 12px", fontFamily: SERIF, fontSize: 20, fontWeight: 700 };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

async function get<T>(path: string): Promise<{ data: T | null; error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } }).catch(() => null);
  if (!r) return { data: null, error: "Couldn't reach the server." };
  const d = await r.json().catch(() => ({}));
  return r.ok ? { data: d as T, error: "" } : { data: null, error: d.error ?? `Error ${r.status}` };
}

function Pill({ ok, text }: { ok: boolean | null; text: string }) {
  const [bg, fg] = ok === null ? ["#EEF0EF", C.muted] : ok ? [C.posSoft, C.pos] : [C.negSoft, C.neg];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 12.5, fontWeight: 800 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: fg }} />{text}</span>;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 800 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

type Metrics = {
  users: { total: number; new7: number; new30: number; active7: number };
  businesses: { total: number; new30: number; outsideIndia: number };
  frebook: { paying: number; free: number; mrr: number; revenueMonth: number; autoRenew: number };
  activity: { posted7: number; posted30: number; viaWhatsApp30: number; waLinked: number };
  logins: { email: string; at: string; via: string }[];
};

export function UsageTab() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { void get<Metrics>("/api/admin/metrics").then(r => { setM(r.data); setErr(r.error); }); }, []);
  if (err) return <div style={{ ...card, color: C.neg }}>{err}</div>;
  if (!m) return <div style={{ ...card, color: C.muted }}>Loading usage…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <Stat label="Users" value={m.users.total} sub={`${m.users.new30} new in 30 days · ${m.users.active7} active this week`} />
        <Stat label="Businesses" value={m.businesses.total} sub={`${m.businesses.new30} new in 30 days`} />
        <Stat label="Paying" value={m.frebook.paying} sub={`${m.frebook.free} on the free trial`} />
        <Stat label="Monthly revenue" value={inr(m.frebook.mrr)} sub={`${inr(m.frebook.revenueMonth)} collected this month`} />
        <Stat label="Entries posted" value={m.activity.posted30} sub={`${m.activity.posted7} this week · last 30 days`} />
        <Stat label="Via WhatsApp" value={m.activity.viaWhatsApp30} sub={`${m.activity.waLinked} numbers linked`} />
      </div>
      <AdminCosts />
      <div style={card}>
        <h2 style={h2}>Recent sign-ins</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>{m.logins.slice(0, 15).map(l => (
              <tr key={l.email + l.at} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "8px 6px" }}>{l.email}</td>
                <td style={{ padding: "8px 6px", color: C.muted }}>{l.via}</td>
                <td style={{ padding: "8px 6px", color: C.muted, textAlign: "right", whiteSpace: "nowrap" }}>{new Date(l.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type Health = {
  deployment: { env: string; region: string; commit: string | null; message: string | null; branch: string | null };
  database: { ok: boolean; ms: number; businesses: number | null; error: string | null };
  worker: { configured: boolean; ok?: boolean; ms?: number | null; error?: string | null };
  crons: { path: string; schedule: string; what: string; secretSet: boolean }[];
  services: Record<string, boolean>;
  checkedAt: string;
};

export function HealthTab() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState("");
  const load = () => { setH(null); void get<Health>("/api/admin/health").then(r => { setH(r.data); setErr(r.error); }); };
  useEffect(load, []);
  if (err) return <div style={{ ...card, color: C.neg }}>{err}</div>;
  if (!h) return <div style={{ ...card, color: C.muted }}>Checking the system…</div>;
  const row = (name: string, pill: React.ReactNode, detail?: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "200px auto 1fr", gap: 12, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
      <b style={{ fontSize: 14 }}>{name}</b>{pill}<span style={{ fontSize: 13, color: C.muted }}>{detail}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ ...h2, margin: 0 }}>System health</h2>
          <button onClick={load} style={{ border: `1px solid ${C.line}`, background: "#FFFFFF", borderRadius: 10, padding: "6px 14px", fontWeight: 700, cursor: "pointer", color: C.ink }}>↻ Check again</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {row("Website (Vercel)", <Pill ok={true} text={h.deployment.env === "production" ? "Live" : h.deployment.env} />, <>Region {h.deployment.region}{h.deployment.commit && <> · build <code>{h.deployment.commit}</code></>}{h.deployment.message && <> — {h.deployment.message}</>}</>)}
          {row("Database (Supabase)", <Pill ok={h.database.ok} text={h.database.ok ? `OK · ${h.database.ms} ms` : "Error"} />, h.database.error ?? `${h.database.businesses ?? "—"} businesses`)}
          {row("Income-tax worker", <Pill ok={h.worker.configured ? !!h.worker.ok : null} text={!h.worker.configured ? "Not set up" : h.worker.ok ? `OK · ${h.worker.ms} ms` : "Not reachable"} />, h.worker.error ?? (h.worker.configured ? "Fetches notices and 26AS from the portal (Fly.io)" : "PORTAL_WORKER_URL isn't set"))}
        </div>
      </div>
      <div style={card}>
        <h2 style={h2}>Scheduled jobs</h2>
        {h.crons.map(c => row(c.path.replace("/api/cron/", ""), <Pill ok={c.secretSet} text={c.secretSet ? c.schedule : "Secret missing"} />, c.what))}
      </div>
      <div style={card}>
        <h2 style={h2}>Services configured</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{Object.entries(h.services).map(([k, v]) => <Pill key={k} ok={v} text={k} />)}</div>
        <p style={{ fontSize: 12.5, color: C.muted, margin: "10px 0 0" }}>Only whether each key is set — values are never shown. Checked {new Date(h.checkedAt).toLocaleTimeString("en-IN")}.</p>
      </div>
      <AdminWhatsApp />
    </div>
  );
}

export function BrandsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        {Object.values(BRANDS).map(b => {
          const live = b.key === "frebook" ? ["frework.online"] : b.hosts;
          return (
            <div key={b.key} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {b.logo
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={b.logo} alt="" style={{ width: 54, height: 42, objectFit: "cover", objectPosition: "8% 50%", borderRadius: 8, border: `1px solid ${C.line}`, background: "#FFFFFF" }} />
                  : <span style={{ width: 54, height: 42, borderRadius: 8, background: C.green, color: "#E8C27A", display: "grid", placeItems: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 18 }}>F</span>}
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700 }}>{b.name} <span style={{ fontStyle: "italic", fontWeight: 400, fontSize: 14, color: C.muted }}>{b.tagline}</span></div>
                  <div style={{ fontSize: 12.5, color: C.muted }}>{b.key === "frebook" ? "Default brand" : "White-label brand"}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 6 }}>
                <div><b>Domains:</b> {live.length ? live.join(", ") : <span style={{ color: C.warn }}>none yet — preview only</span>}</div>
                <div><b>Preview:</b> <a href={`/finance?brand=${b.key}`} style={{ color: C.green, fontWeight: 700 }}>frework.online/finance?brand={b.key}</a></div>
                <div style={{ color: C.muted }}>Same app, database and logins; a browser switches with the preview link and stays until another one is opened.</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ ...card, background: C.goldSoft, borderColor: "#E6D3AE" }}>
        <h2 style={{ ...h2, fontSize: 17 }}>Adding a domain to a brand</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>Buy the domain (e.g. <i>booksai.in</i>).</li>
          <li>At the domain seller, add the DNS record Vercel shows (Vercel → frework-api → Settings → Domains → Add).</li>
          <li>Add the domain to the brand in the app (<code>lib/brand.ts</code> → <code>hosts</code>) and to Supabase / Google sign-in redirect URLs — ask Claude to do this part.</li>
        </ol>
      </div>
    </div>
  );
}
