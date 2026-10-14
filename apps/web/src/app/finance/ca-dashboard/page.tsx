"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness, setActiveBusiness } from "@/lib/activeBusiness";

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

const fmt = (n: number) => n >= 1e7
  ? `${cur()}${(n / 1e7).toFixed(1)}Cr`
  : n >= 1e5
  ? `${cur()}${(n / 1e5).toFixed(1)}L`
  : `${cur()}${n.toLocaleString(activeMoney().locale)}`;

const STATUS_COLORS: Record<string, string> = {
  Regular: "#0B7A55", Composition: "#1F5EFF", Unregistered: "#6B7280",
  "SEZ Unit": "#5B4BC4", "SEZ Developer": "#8A5A00",
};

export default function CADashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeClient, setActiveClient] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);

      // Read currently active client from localStorage
      const current = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      setActiveClient(current);

      // Load all businesses this user has access to
      const { data: businesses } = await supabase
        .from("fw_fin_businesses")
        .select("id,name,gstin,state,gst_registration_type")
        .eq("created_by", user.id)
        .order("name");

      if (!businesses?.length) { setLoading(false); return; }

      // Load stats for each business
      const enriched: Client[] = await Promise.all(
        businesses.map(async (biz) => {
          const [journalRes, draftRes, salesRes] = await Promise.all([
            supabase.from("fw_fin_journals").select("id", { count: "exact", head: true })
              .eq("business_id", biz.id).eq("status", "posted"),
            supabase.from("fw_fin_journals").select("id", { count: "exact", head: true })
              .eq("business_id", biz.id).eq("status", "draft"),
            supabase.from("fw_fin_journals").select("total_credit,date")
              .eq("business_id", biz.id).eq("status", "posted").in("type", ["sales", "receipt"])
              .order("date", { ascending: false }).limit(50),
          ]);

          const revenue = (salesRes.data ?? []).reduce((s, j) => s + (j.total_credit ?? 0), 0);
          const lastEntry = salesRes.data?.[0]?.date ?? null;

          return {
            ...biz,
            journals: journalRes.count ?? 0,
            revenue,
            drafts: draftRes.count ?? 0,
            last_entry: lastEntry,
          };
        })
      );

      setClients(enriched);
      setLoading(false);
    });
  }, []);

  const switchClient = (clientId: string) => {
    setSwitchingTo(clientId);
    if (!userId) return;
    setActiveBusiness(userId, clientId);
    setActiveClient(clientId);
    setTimeout(() => { setSwitchingTo(null); router.push("/finance"); }, 500);
  };

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.gstin ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalClients = clients.length;
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const totalDrafts = clients.reduce((s, c) => s + c.drafts, 0);

  const S = {
    page: { minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "Inter,system-ui,sans-serif" },
    nav: { borderBottom: "1px solid #E1E4EE", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 52 },
    main: { maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" },
    kpi: { background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 12, padding: "1.25rem 1.5rem" },
    card: { background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 12, padding: 0, overflow: "hidden" },
    input: { background: "#FFFFFF", border: "1px solid #5A6080", color: "#141A3A", padding: "0.5rem 1rem", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const },
    btn: (active: boolean) => ({
      padding: "0.45rem 1rem", borderRadius: 8, fontSize: "0.82rem", fontFamily: "inherit", cursor: "pointer", fontWeight: 600, border: "none",
      background: active ? "#232A63" : "#E1E4EE", color: active ? "#F5F6FA" : "#141A3A",
      transition: "all 0.15s",
    }),
  };

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "#5A6080" }}>›</span>
        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>CA Dashboard</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>Multi-client overview</span>
      </nav>

      <div style={S.main}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 0.3rem" }}>CA Partner Dashboard</h1>
          <p style={{ color: "#6B7280", fontSize: "0.84rem", margin: 0 }}>Manage all your clients from one place. Click a client to switch.</p>
        </div>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Clients", value: totalClients, color: "#232A63" },
            { label: "Combined Revenue", value: fmt(totalRevenue), color: "#0B7A55" },
            { label: "Pending Drafts", value: totalDrafts, color: "#8A5A00" },
          ].map(({ label, value, color }) => (
            <div key={label} style={S.kpi}>
              <div style={{ fontSize: "0.72rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>{label}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: "1rem" }}>
          <input style={S.input} placeholder="Search clients by name or GSTIN…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Client table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#6B7280" }}>Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...S.kpi, textAlign: "center", padding: "3rem", color: "#6B7280" }}>
            {clients.length === 0
              ? <>No clients yet. <Link href="/finance/setup" style={{ color: "#232A63" }}>Set up a business →</Link></>
              : "No clients match your search."
            }
          </div>
        ) : (
          <div style={S.card}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ background: "#F5F6FA", borderBottom: "1px solid #E1E4EE" }}>
                  {["Client", "GSTIN", "Type", "Revenue (FY)", "Journal Entries", "Drafts", "Last Entry", ""].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: h === "Revenue (FY)" || h === "Journal Entries" || h === "Drafts" ? "right" : "left", color: "#6B7280", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isActive = c.id === activeClient;
                  const isSwitching = c.id === switchingTo;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #E1E4EE", background: isActive ? "rgba(35,42,99,0.04)" : undefined }}>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0B7A55", flexShrink: 0 }} />}
                          <div>
                            <div style={{ fontWeight: 600, color: isActive ? "#232A63" : "#141A3A" }}>{c.name}</div>
                            {c.state && <div style={{ fontSize: "0.72rem", color: "#6B7280" }}>{c.state}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: "#9CA3AF" }}>
                        {c.gstin ?? <span style={{ color: "#5A6080" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: `${STATUS_COLORS[c.gst_registration_type] ?? "#6B7280"}18`, color: STATUS_COLORS[c.gst_registration_type] ?? "#6B7280" }}>
                          {c.gst_registration_type}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", color: "#0B7A55", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(c.revenue)}</td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.journals}</td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                        {c.drafts > 0 ? <span style={{ color: "#8A5A00", fontWeight: 600 }}>{c.drafts}</span> : <span style={{ color: "#5A6080" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "#6B7280", fontSize: "0.78rem" }}>
                        {c.last_entry ? new Date(c.last_entry).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        {isActive ? (
                          <span style={{ fontSize: "0.72rem", color: "#0B7A55", fontWeight: 600 }}>● Active</span>
                        ) : (
                          <button style={S.btn(false)} onClick={() => switchClient(c.id)} disabled={!!switchingTo}>
                            {isSwitching ? "Switching…" : "Switch →"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick links */}
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            { href: "/finance/setup", label: "+ Onboard New Client" },
            { href: "/finance/tally", label: "Import from Tally" },
            { href: "/finance/gst", label: "GST Filing" },
            { href: "/finance/tds", label: "TDS Tracker" },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              style={{ fontSize: "0.8rem", color: "#9CA3AF", textDecoration: "none", padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid #E1E4EE", background: "#FFFFFF" }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
