"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness, setActiveBusiness, confirmBusinessSwitch } from "@/lib/activeBusiness";

type Client = {
  id: string;
  name: string;
  gstin: string | null;
  state: string | null;
  gst_registration_type: string;
  journals: number;
  revenue: number;
  drafts: number;
  last_entry: string | null;
};

// Theme: deep green + gold, cream cards (same as Home)
const T = { ink: "#0B2C25", deep: "#0A1F1B", gold: "#E9C27A", goldInk: "#9A6B22", cream: "#FFFBF1", line: "#EFE2C4", muted: "#5E6B66", ok: "#0B7A55", warn: "#B4690E", bad: "#B42318" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";

const fmt = (n: number) => n >= 1e7
  ? `${cur()}${(n / 1e7).toFixed(1)}Cr`
  : n >= 1e5
  ? `${cur()}${(n / 1e5).toFixed(1)}L`
  : `${cur()}${Math.round(n).toLocaleString(activeMoney().locale)}`;

const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };
const daysSince = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

// Monthly / periodic compliance dates (India)
function upcomingDues(): { label: string; date: Date }[] {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const out: { label: string; date: Date }[] = [];
  for (let k = 0; k < 2; k++) {
    const y = now.getFullYear(), m = now.getMonth() + k;
    out.push({ label: "TDS deposit", date: new Date(y, m, 7) });
    out.push({ label: "GSTR-1", date: new Date(y, m, 11) });
    out.push({ label: "GSTR-3B", date: new Date(y, m, 20) });
  }
  const yr = now.getFullYear();
  for (const [mm, dd] of [[5, 15], [8, 15], [11, 15], [2, 15]] as const) {
    out.push({ label: "Advance tax", date: new Date(mm === 2 ? yr + (now.getMonth() > 2 ? 1 : 0) : yr, mm, dd) });
  }
  for (const [mm, dd] of [[6, 31], [9, 31], [0, 31], [4, 31]] as const) {
    out.push({ label: "TDS return", date: new Date(mm <= 4 && now.getMonth() > 4 ? yr + 1 : yr, mm, dd) });
  }
  return out.filter(d => d.date >= now).sort((a, b) => +a.date - +b.date).slice(0, 5);
}

type Filter = "all" | "attention" | "drafts" | "quiet" | "nogst";
type Sort = "name" | "revenue" | "drafts" | "recent";

export default function CADashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [activeClient, setActiveClient] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      setActiveClient((readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim());

      const { data: businesses } = await supabase
        .from("fw_fin_businesses")
        .select("id,name,gstin,state,gst_registration_type")
        .eq("created_by", user.id)
        .order("name");
      if (!businesses?.length) { setLoading(false); return; }

      const from = fyStart();
      const enriched: Client[] = await Promise.all(businesses.map(async (biz) => {
        const [journalRes, draftRes, salesRes, lastRes] = await Promise.all([
          supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", biz.id).eq("status", "posted"),
          supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", biz.id).eq("status", "draft"),
          supabase.from("fw_fin_journals").select("total_credit").eq("business_id", biz.id).eq("status", "posted").eq("type", "sales").gte("date", from).limit(5000),
          supabase.from("fw_fin_journals").select("date").eq("business_id", biz.id).eq("status", "posted").order("date", { ascending: false }).limit(1),
        ]);
        return {
          ...biz,
          journals: journalRes.count ?? 0,
          revenue: (salesRes.data ?? []).reduce((s, j) => s + (Number(j.total_credit) || 0), 0),
          drafts: draftRes.count ?? 0,
          last_entry: lastRes.data?.[0]?.date ?? null,
        };
      }));
      setClients(enriched);
      setLoading(false);
    });
  }, []);

  const switchClient = async (clientId: string, to = "/finance") => {
    if (!userId) return;
    if (clientId !== activeClient && !(await confirmBusinessSwitch(userId, clientId, clients.find(c => c.id === clientId)?.name ?? "this client"))) return;
    setSwitchingTo(clientId);
    setActiveBusiness(userId, clientId);
    setActiveClient(clientId);
    setTimeout(() => { setSwitchingTo(null); router.push(to); }, 300);
  };

  const quiet = (c: Client) => { const d = daysSince(c.last_entry); return d === null || d > 30; };
  const needsAttention = (c: Client) => c.drafts > 0 || quiet(c);

  const shown = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.gstin ?? "").toLowerCase().includes(q) || (c.state ?? "").toLowerCase().includes(q))
      .filter(c => filter === "all" || (filter === "attention" && needsAttention(c)) || (filter === "drafts" && c.drafts > 0) || (filter === "quiet" && quiet(c)) || (filter === "nogst" && !c.gstin))
      .sort((a, b) => sort === "revenue" ? b.revenue - a.revenue : sort === "drafts" ? b.drafts - a.drafts : sort === "recent" ? (b.last_entry ?? "").localeCompare(a.last_entry ?? "") : a.name.localeCompare(b.name));
  }, [clients, search, filter, sort]);

  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const totalDrafts = clients.reduce((s, c) => s + c.drafts, 0);
  const attention = clients.filter(needsAttention).length;
  const dues = upcomingDues();

  const exportCsv = () => {
    const rows = [["Client", "GSTIN", "State", "GST type", "Sales this FY", "Posted entries", "Drafts", "Last entry"],
      ...shown.map(c => [c.name, c.gstin ?? "", c.state ?? "", c.gst_registration_type, String(Math.round(c.revenue)), String(c.journals), String(c.drafts), c.last_entry ?? ""])];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const chips: [Filter, string, number][] = [
    ["all", "All", clients.length], ["attention", "Needs attention", attention],
    ["drafts", "Has drafts", clients.filter(c => c.drafts > 0).length],
    ["quiet", "No entry in 30 days", clients.filter(quiet).length],
    ["nogst", "No GSTIN", clients.filter(c => !c.gstin).length],
  ];

  return (
    <div className="cad">
      <style>{`
        .cad{min-height:100vh;background:#FBF8F1;color:${T.ink};padding:24px 22px 48px}
        .cad-wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
        .cad-hero{border-radius:28px;padding:26px 28px;background:radial-gradient(700px 300px at 100% 0%,rgba(233,194,122,.16),transparent 60%),linear-gradient(160deg,#0A1F1B,#0C2622 60%,#0F2E28);color:#fff;display:flex;flex-direction:column;gap:20px;box-shadow:0 30px 60px -34px rgba(6,26,22,.75)}
        .cad-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .cad-kpi{border-radius:20px;padding:18px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
        .cad-kpi.first{background:linear-gradient(145deg,#FFFBF1,#F6EAD0);color:${T.ink};border-color:transparent}
        .cad-kpi small{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;opacity:.75}
        .cad-kpi b{display:block;font-family:${SERIF};font-size:30px;margin-top:6px;font-variant-numeric:tabular-nums}
        .cad-btn{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:999px;font-weight:800;font-size:14px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
        .cad-gold{background:linear-gradient(135deg,#F3D9A2,#E9C27A);color:${T.ink}}
        .cad-ghost{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.16)}
        .cad-dues{display:flex;gap:10px;flex-wrap:wrap}
        .cad-due{display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);font-size:13px}
        .cad-due .d{width:40px;height:40px;border-radius:12px;background:${T.cream};color:${T.ink};display:grid;place-items:center;line-height:1;text-align:center;font-weight:800;font-size:15px}
        .cad-due .d i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.1em;color:${T.goldInk}}
        .cad-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .cad-search{flex:1 1 280px;height:44px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;padding:0 18px;font:inherit;font-size:14px;color:${T.ink};outline:none}
        .cad-search:focus{border-color:${T.gold};box-shadow:0 0 0 3px rgba(233,194,122,.25)}
        .cad-sel{height:44px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;padding:0 14px;font:inherit;font-size:13.5px;color:${T.ink}}
        .cad-chip{height:36px;padding:0 14px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;color:${T.ink};font:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
        .cad-chip span{font-size:11.5px;background:#F4EEDF;border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
        .cad-chip.on{background:${T.ink};color:#fff;border-color:${T.ink}}.cad-chip.on span{background:${T.gold};color:${T.ink}}
        .cad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
        .cad-card{border-radius:22px;background:#fff;border:1px solid ${T.line};padding:18px 20px;display:flex;flex-direction:column;gap:14px;box-shadow:0 14px 30px -26px rgba(154,107,34,.6)}
        .cad-card.on{border-color:${T.ink};box-shadow:0 0 0 2px ${T.ink}}
        .cad-av{width:44px;height:44px;border-radius:14px;background:${T.ink};color:${T.gold};display:grid;place-items:center;font-family:${SERIF};font-weight:700;font-size:18px;flex:none}
        .cad-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .cad-stats div{background:${T.cream};border-radius:14px;padding:10px 12px}
        .cad-stats small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.12em;color:${T.muted}}
        .cad-stats b{display:block;font-size:16px;margin-top:2px;font-variant-numeric:tabular-nums}
        .cad-acts{display:flex;gap:6px;flex-wrap:wrap}
        .cad-act{height:32px;padding:0 12px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;color:${T.ink};font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
        .cad-act:hover{border-color:${T.gold};background:${T.cream}}
        .cad-act.main{background:${T.ink};color:#fff;border-color:${T.ink}}
        .cad-flag{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px}
        .cad-btn:focus-visible,.cad-chip:focus-visible,.cad-act:focus-visible{outline:2px solid ${T.gold};outline-offset:2px}
        @media (max-width:860px){.cad-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:640px){.cad{padding:16px 14px 40px}.cad-hero{padding:20px}.cad-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="cad-wrap">
        <section className="cad-hero" aria-label="Practice overview">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.22em", color: T.gold }}>CA PRACTICE</div>
              <h1 style={{ margin: "4px 0 2px", fontFamily: SERIF, fontSize: "clamp(26px,3vw,36px)" }}>Client desk</h1>
              <div style={{ fontSize: 14, color: "#B9D0C7" }}>Every client you look after, in one place. Open one to work in its books.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/finance/setup" className="cad-btn cad-gold">＋ Onboard client</Link>
              <Link href="/finance/tally" className="cad-btn cad-ghost">Import from Tally</Link>
              <button type="button" className="cad-btn cad-ghost" onClick={exportCsv} disabled={!clients.length}>Export list</button>
            </div>
          </div>
          <div className="cad-kpis">
            <div className="cad-kpi first"><small style={{ color: T.goldInk }}>CLIENTS</small><b>{clients.length}</b></div>
            <div className="cad-kpi"><small>SALES THIS FY</small><b>{fmt(totalRevenue)}</b></div>
            <div className="cad-kpi"><small>DRAFTS TO POST</small><b style={{ color: totalDrafts ? T.gold : undefined }}>{totalDrafts}</b></div>
            <div className="cad-kpi"><small>NEED ATTENTION</small><b style={{ color: attention ? T.gold : "#7FE0B4" }}>{attention}</b></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#B9D0C7", marginBottom: 8 }}>DUE DATES COMING UP</div>
            <div className="cad-dues">
              {dues.map(d => {
                const left = Math.round((+d.date - +new Date(new Date().toDateString())) / 86400000);
                return (
                  <div key={d.label + +d.date} className="cad-due">
                    <span className="d"><span>{d.date.getDate()}<i>{d.date.toLocaleString("en-IN", { month: "short" }).toUpperCase()}</i></span></span>
                    <span><b>{d.label}</b><br /><span style={{ color: left <= 3 ? T.gold : "#B9D0C7", fontSize: 12 }}>{left === 0 ? "Today" : `in ${left} day${left === 1 ? "" : "s"}`}</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="cad-bar">
          <input className="cad-search" placeholder="Search by name, GSTIN or state" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search clients" />
          <select className="cad-sel" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort clients">
            <option value="name">Sort: Name</option>
            <option value="revenue">Sort: Sales this FY</option>
            <option value="drafts">Sort: Most drafts</option>
            <option value="recent">Sort: Last entry</option>
          </select>
        </div>
        <div className="cad-bar">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" className={"cad-chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)} aria-pressed={filter === k}>{label}<span>{n}</span></button>
          ))}
        </div>

        {loading ? (
          <div className="cad-grid">{[0, 1, 2].map(i => <div key={i} className="cad-card" style={{ height: 210, background: T.cream }} />)}</div>
        ) : clients.length === 0 ? (
          <div className="cad-card" style={{ alignItems: "center", textAlign: "center", padding: "44px 20px" }}>
            <div className="cad-av" style={{ width: 56, height: 56 }}>＋</div>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 24 }}>Add your first client</h2>
            <div style={{ color: T.muted, maxWidth: 460, fontSize: 14 }}>Set up a client's business, or bring their books across from Tally. Each client then shows up here with its sales, drafts and last entry.</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/finance/setup" className="cad-btn" style={{ background: T.ink, color: "#fff" }}>＋ Onboard client</Link>
              <Link href="/finance/tally" className="cad-btn" style={{ border: "1px solid #E6DFD0", color: T.ink }}>Import from Tally</Link>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="cad-card" style={{ textAlign: "center", color: T.muted }}>No clients match. <button type="button" className="cad-act" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button></div>
        ) : (
          <div className="cad-grid">
            {shown.map(c => {
              const isActive = c.id === activeClient;
              const d = daysSince(c.last_entry);
              return (
                <article key={c.id} className={"cad-card" + (isActive ? " on" : "")}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span className="cad-av" aria-hidden="true">{c.name.trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.name}>{c.name}</div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: c.gstin ? "ui-monospace,monospace" : undefined }}>{c.gstin ?? "No GSTIN"}{c.state ? ` · ${c.state}` : ""}</div>
                    </div>
                    {isActive && <span className="cad-flag" style={{ background: "#E3F4EC", color: T.ok }}>● Open</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="cad-flag" style={{ background: "#F4EEDF", color: T.goldInk }}>{c.gst_registration_type || "GST type not set"}</span>
                    {c.drafts > 0 && <span className="cad-flag" style={{ background: "#FDF1E2", color: T.warn }}>{c.drafts} draft{c.drafts === 1 ? "" : "s"} to post</span>}
                    {(d === null || d > 30) && <span className="cad-flag" style={{ background: "#FDECEA", color: T.bad }}>{d === null ? "No entries yet" : `No entry for ${d} days`}</span>}
                  </div>
                  <div className="cad-stats">
                    <div><small>SALES FY</small><b>{fmt(c.revenue)}</b></div>
                    <div><small>ENTRIES</small><b>{c.journals.toLocaleString("en-IN")}</b></div>
                    <div><small>LAST ENTRY</small><b style={{ fontSize: 14 }}>{c.last_entry ? new Date(c.last_entry).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</b></div>
                  </div>
                  <div className="cad-acts">
                    <button type="button" className="cad-act main" disabled={!!switchingTo} onClick={() => switchClient(c.id)}>{switchingTo === c.id ? "Opening…" : isActive ? "Go to Home" : "Open client"}</button>
                    <button type="button" className="cad-act" disabled={!!switchingTo} onClick={() => switchClient(c.id, "/finance/books")}>Books</button>
                    {c.drafts > 0 && <button type="button" className="cad-act" disabled={!!switchingTo} onClick={() => switchClient(c.id, "/finance/review")}>Drafts</button>}
                    {c.gstin && <button type="button" className="cad-act" disabled={!!switchingTo} onClick={() => switchClient(c.id, "/finance/gst/reconcile")}>GST</button>}
                    <button type="button" className="cad-act" disabled={!!switchingTo} onClick={() => switchClient(c.id, "/finance/audit360")}>360° Audit</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
