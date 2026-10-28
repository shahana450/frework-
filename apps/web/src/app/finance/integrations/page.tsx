"use client";
import { SettingsHero, HT, SERIF } from "@/components/finance/PageHero";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PROVIDERS, type Provider } from "@/lib/integrations";
import { useConnectors, ConnectPanel, ReviewList } from "./Connectors";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Status = {
  tally: { pushed: number; failed: number; imported: number; last_sync: string | null; company: string | null; setup_needed: boolean };
};

const BG = "#F4EFE4", BORDER = "rgba(16,36,31,0.13)", TEXT = "#10241F", MUTED = "rgba(16,36,31,0.75)";
const GOLD = "#12352D", GREEN = "#0B7A55", RED = "#B4321F", BLUE = "#12352D";
const KIND: Record<Provider["kind"], string> = { accounting: "Accounting software", bank: "Banking", payments: "Payments", commerce: "Commerce" };
const TRANSPORT: Record<Provider["transport"], string> = { local_bridge: "Runs through the Tally Bridge on your PC", file: "File upload", cloud_api: "Cloud connection" };
const CAP: Record<string, string> = {
  push_entries: "Push entries", pull_entries: "Import entries", pull_ledgers: "Import ledgers", detect_duplicates: "Duplicate check",
  import_files: "File import", pull_payments: "Payments", pull_orders: "Orders",
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [bizId, setBizId] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; t: string } | null>(null);
  const conn = useConnectors(bizId);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
      const q = new URLSearchParams(window.location.search);
      if (q.get("connected")) setFlash({ ok: true, t: "Connected. Click Fetch now to bring in recent entries." });
      else if (q.get("error")) setFlash({ ok: false, t: q.get("error")! });
      const res = await fetch(`/api/finance/integrations/status?business_id=${biz}`);
      if (res.ok) setStatus(await res.json());
    });
  }, [router]);

  const detail = (p: Provider) => {
    if (!status) return null;
    if (p.id === "tally") {
      const t = status.tally;
      return (
        <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
          <span><strong style={{ color: GREEN }}>{t.pushed}</strong> <span style={{ color: MUTED }}>pushed to Tally</span></span>
          {t.failed > 0 && <span><strong style={{ color: RED }}>{t.failed}</strong> <span style={{ color: MUTED }}>failed</span></span>}
          <span><strong style={{ color: BLUE }}>{t.imported}</strong> <span style={{ color: MUTED }}>imported from Tally</span></span>
          {t.last_sync && <span style={{ color: MUTED }}>Last push {new Date(t.last_sync).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{t.company ? ` → ${t.company}` : ""}</span>}
        </div>
      );
    }
    return null;
  };

  const [kind, setKind] = useState<"all" | Provider["kind"] | "messaging">("all");
  const [q, setQ] = useState("");
  const T = HT;
  const t = status?.tally;
  const code = (p: Provider) => ({ tally: "TLY", bank_statement: "BNK", razorpay: "RZP", shopify: "SHP", zoho_books: "ZHO", quickbooks: "QBO", bank_feed: "AA" } as Record<string, string>)[p.id] ?? p.name.slice(0, 3).toUpperCase();
  const extra = [
    { id: "whatsapp", name: "WhatsApp", code: "WA", tag: "Messaging", desc: "Record entries and send bills by chat. Every message is drafted for you to confirm first.", href: "/finance/whatsapp", cta: "Set up in WhatsApp tab →" },
    { id: "portals", name: "GST & IT portals", code: "GST", tag: "Government portals", desc: "Live GST filing status through a licensed GSP, and income-tax credits from the PDFs you upload.", href: "/finance/portals", cta: "Set up in Portal connect →" },
  ];
  const match = (name: string, desc: string) => !q || `${name} ${desc}`.toLowerCase().includes(q.toLowerCase());
  const tally = PROVIDERS.find(p => p.id === "tally");
  const others = PROVIDERS.filter(p => p.id !== "tally" && (kind === "all" || p.kind === kind) && match(p.name, p.description));
  const extraShown = extra.filter(x => (kind === "all" || kind === "messaging") && match(x.name, x.desc));
  const showTally = !!tally && (kind === "all" || kind === "accounting") && match(tally.name, tally.description);
  const kinds: [typeof kind, string][] = [["all", `All · ${PROVIDERS.length + extra.length}`], ["accounting", "Accounting software"], ["bank", "Banking"], ["payments", "Payments"], ["messaging", "Messaging & portals"]];
  const pill = (on: boolean): React.CSSProperties => ({ height: 44, padding: "0 18px", borderRadius: 999, border: on ? "none" : "1px solid #D9C68F", background: on ? T.green : T.paper, color: on ? "#FFFFFF" : T.ink, fontFamily: SERIF, fontSize: 15, cursor: "pointer" });
  const chip: React.CSSProperties = { padding: "4px 12px", borderRadius: 8, background: "#F1EADA", color: T.green, fontSize: 14 };
  const btnGold: React.CSSProperties = { height: 46, padding: "0 22px", borderRadius: 999, background: T.gold, color: T.ink, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: 15 };
  const btnLine: React.CSSProperties = { height: 46, padding: "0 22px", borderRadius: 999, border: "1px solid #D9C68F", color: "#6B5320", textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: 15 };
  const card: React.CSSProperties = { background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 12 };
  const badge = (code: string, big = false) => <span style={{ width: big ? 44 : 40, height: big ? 44 : 40, flexShrink: 0, borderRadius: 12, background: T.green, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, letterSpacing: "0.08em" }}>{code}</span>;
  const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: SERIF }}>
      <SettingsHero active="integrations" eyebrow="Integrations" title="Bring data in, send copies out"
        sub="FreBook is your books. Everything that comes in still passes its checks: balanced entries, year locks, duplicate detection and the audit log."
        tiles={[
          { label: "Imported from Tally", value: t ? t.imported : "—" },
          { label: "Pushed to Tally", value: t ? t.pushed : "—", tone: "warn", sub: t?.failed ? `${t.failed} failed` : undefined },
          { label: "Waiting for review", value: conn.data ? conn.data.items.filter(it => it.status === "new").length : "—", tone: "good" },
        ]} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 28px 80px", display: "flex", flexDirection: "column", gap: 28 }}>
        {flash && <div role="status" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 15, background: flash.ok ? "#E3F6EE" : "#FBECE8", color: flash.ok ? GREEN : RED }}>{flash.t}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div role="group" aria-label="Filter by type" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {kinds.map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} style={pill(kind === k)}>{l}</button>)}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, background: T.paper, border: "1px solid #D9C68F", borderRadius: 999, padding: "0 18px", minHeight: 44 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" aria-label="Search integrations" placeholder="Search integrations" value={q} onChange={e => setQ(e.target.value)} style={{ fontFamily: SERIF, fontSize: 15, border: "none", outline: "none", background: "transparent", color: T.ink, width: 200 }} />
          </label>
        </div>

        {conn.data && <ReviewList data={conn.data} call={conn.call} reload={conn.load} />}

        {showTally && tally && (
          <article style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 560px", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                {badge("TLY", true)}
                <h2 style={{ margin: 0, fontSize: 24, color: T.green }}>{tally.name}</h2>
                <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, border: "1px solid #D9C68F", color: "#6B5320" }}>{KIND[tally.kind]}</span>
                <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, background: "#DDEEE4", color: "#1D5A3C" }}>● Available</span>
              </div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#33433C" }}>{tally.description}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{tally.capabilities.map(c => <span key={c} style={chip}>{CAP[c] ?? c}</span>)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                <Link href="/finance/books" style={btnGold}>Push to Tally →</Link>
                <Link href="/finance/tally" style={btnLine}>Import vouchers</Link>
                {tally.href && <Link href={tally.href} style={btnLine}>Open</Link>}
              </div>
            </div>
            <aside aria-label="Tally Bridge status" style={{ flex: "1 1 280px", background: T.green, color: "#FFFFFF", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.22em", color: T.gold }}>TALLY BRIDGE</div>
              <div style={{ fontSize: 20, fontStyle: "italic" }}>Runs on your PC</div>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: 15 }}>
                <dt style={{ color: "#C8D3CC" }}>Company</dt><dd style={{ margin: 0, textAlign: "right" }}>{t?.company || "Not linked"}</dd>
                <dt style={{ color: "#C8D3CC" }}>Last push</dt><dd style={{ margin: 0, textAlign: "right" }}>{when(t?.last_sync ?? null)}</dd>
                <dt style={{ color: "#C8D3CC" }}>Imported</dt><dd style={{ margin: 0, textAlign: "right" }}>{t?.imported ?? 0} vouchers</dd>
                <dt style={{ color: "#C8D3CC" }}>Pushed</dt><dd style={{ margin: 0, textAlign: "right" }}>{t?.pushed ?? 0} entries</dd>
              </dl>
              <Link href="/finance/tally" style={{ fontSize: 15, color: T.gold }}>Download or set up Tally Bridge →</Link>
            </aside>
          </article>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px,100%), 1fr))", gap: 20 }}>
          {others.map(p => (
            <article key={p.id} style={{ ...card, opacity: p.status === "available" ? 1 : 0.75 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                {badge(code(p))}
                <h2 style={{ margin: 0, fontSize: 21, color: T.green }}>{p.name}</h2>
                {p.status === "available"
                  ? <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, background: "#DDEEE4", color: "#1D5A3C" }}>● Available</span>
                  : <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, border: "1px solid #D9C68F", color: "#6B5320" }}>Planned</span>}
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#33433C" }}>{p.description}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{p.capabilities.map(c => <span key={c} style={chip}>{CAP[c] ?? c}</span>)}<span style={{ padding: "4px 6px", color: "#5A6862", fontSize: 14 }}>{TRANSPORT[p.transport]}</span></div>
              {detail(p)}
              {p.transport === "cloud_api" && p.status === "available" && conn.data && <ConnectPanel provider={p.id} data={conn.data} call={conn.call} reload={conn.load} />}
              {p.href && p.status === "available" && <div style={{ marginTop: "auto", paddingTop: 8 }}><Link href={p.href} style={{ ...btnGold, background: T.green, color: "#FFFFFF", fontWeight: 400 }}>{p.kind === "bank" ? "Import a statement →" : "Open →"}</Link></div>}
            </article>
          ))}
          {extraShown.map(x => (
            <article key={x.id} style={card}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                {badge(x.code)}
                <h2 style={{ margin: 0, fontSize: 21, color: T.green }}>{x.name}</h2>
                <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, border: "1px solid #D9C68F", color: "#6B5320" }}>{x.tag}</span>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#33433C" }}>{x.desc}</p>
              <div style={{ marginTop: "auto", paddingTop: 8 }}><Link href={x.href} style={btnLine}>{x.cta}</Link></div>
            </article>
          ))}
        </div>
        {!showTally && !others.length && !extraShown.length && <div style={{ ...card, alignItems: "center", fontStyle: "italic", color: T.muted }}>No integration matches.</div>}

        <section aria-label="Checks" style={{ background: T.green, color: "#FFFFFF", borderRadius: 18, padding: 28 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.22em", color: T.gold, marginBottom: 6 }}>EVERY IMPORT</div>
          <h2 style={{ margin: "0 0 20px", fontSize: 26, fontStyle: "italic", fontWeight: 400 }}>Passes the same four checks</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[["Balanced entries", "Debits equal credits, or it doesn't post"], ["Year locks", "Closed periods stay closed"], ["Duplicate detection", "Same entry from two sources is flagged"], ["Audit log", "Who brought what in, and when"]].map(([h, d], i) => (
              <li key={h} style={{ display: "flex", gap: 12 }}>
                <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", border: `1px solid ${T.gold}`, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{i + 1}</span>
                <span><span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{h}</span><span style={{ display: "block", fontSize: 14, color: "#D9E2DC" }}>{d}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Sync activity" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontStyle: "italic", fontWeight: 400, color: T.green }}>Sync activity</h2>
            <Link href="/finance/audit-log" style={{ fontSize: 15, color: T.green }}>Full audit log →</Link>
          </div>
          <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 15 }}>
              <thead><tr style={{ background: "#F7F1E3" }}>{["When", "Integration", "What happened", "Entries", "Result"].map((h, i) => <th key={h} scope="col" style={{ textAlign: i === 3 ? "right" : "left", fontWeight: 400, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A6862", padding: "12px 20px" }}>{h}</th>)}</tr></thead>
              <tbody>
                {t && t.pushed + t.failed > 0 && <tr><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2", color: "#5A6862" }}>{when(t.last_sync)}</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}>Tally Prime{t.company ? ` · ${t.company}` : ""}</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}>Pushed entries</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2", textAlign: "right" }}>{t.pushed}</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}><span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, background: t.failed ? "#FBECE8" : "#DDEEE4", color: t.failed ? RED : "#1D5A3C" }}>{t.failed ? `${t.failed} failed` : "Done"}</span></td></tr>}
                {t && t.imported > 0 && <tr><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2", color: "#5A6862" }}>—</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}>Tally Prime</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}>Imported vouchers</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2", textAlign: "right" }}>{t.imported}</td><td style={{ padding: "14px 20px", borderTop: "1px solid #EDE4D2" }}><span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 999, background: "#DDEEE4", color: "#1D5A3C" }}>Done</span></td></tr>}
                {(!t || (t.pushed + t.failed === 0 && t.imported === 0)) && <tr><td colSpan={5} style={{ padding: "18px 20px", borderTop: "1px solid #EDE4D2", color: "#5A6862", fontStyle: "italic", textAlign: "center" }}>No syncs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Request an integration" style={{ border: "1.5px dashed #D9C68F", borderRadius: 18, padding: "24px 28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, background: "#FFFEFA" }}>
          <div style={{ flex: "1 1 360px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 21, fontStyle: "italic", fontWeight: 400, color: T.green }}>Need another app?</h2>
            <p style={{ margin: 0, fontSize: 15, color: "#5A6862" }}>Tell us which software, bank or payment gateway you use and we&apos;ll look at adding it.</p>
          </div>
          <a href="https://wa.me/919539028318?text=Hi%20FreWork%2C%20please%20add%20an%20integration%20for%20" target="_blank" rel="noopener noreferrer" style={btnLine}>Request an integration</a>
        </section>
      </div>
    </div>
  );
}
