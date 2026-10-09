"use client";
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

const BG = "#F5F6FA", BORDER = "rgba(20,26,58,0.13)", TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.75)";
const GOLD = "#232A63", GREEN = "#0B7A55", RED = "#C2321F", BLUE = "#1F5EFF";
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

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.8rem", height: 56 }}>
        <Link href="/finance" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>FreWork</Link>
        <span style={{ color: MUTED }}>›</span>
        <span style={{ fontWeight: 700 }}>Integrations</span>
      </nav>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
        <p style={{ margin: "0 0 1.25rem", color: MUTED, fontSize: "0.86rem", lineHeight: 1.6 }}>
          FreWork is your books. Integrations bring data in or send copies out — everything still passes through FreWork&apos;s checks (balanced entries, year locks, duplicate detection, audit log).
        </p>
        {flash && <div role="status" style={{ marginBottom: "1rem", padding: "10px 14px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, background: flash.ok ? "#E3F6EE" : "#FDECEA", color: flash.ok ? GREEN : RED }}>{flash.t}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {conn.data && <ReviewList data={conn.data} call={conn.call} reload={conn.load} />}
          {PROVIDERS.map(p => (
            <div key={p.id} style={{ border: `1px solid ${p.status === "available" ? "rgba(35,42,99,0.25)" : BORDER}`, borderRadius: 12, padding: "1rem 1.2rem", background: "#FFFFFF", opacity: p.status === "available" ? 1 : 0.7, display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "0.95rem" }}>{p.name}</strong>
                  <span style={{ fontSize: "0.66rem", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "1px 8px" }}>{KIND[p.kind]}</span>
                  {p.status === "available"
                    ? <span style={{ fontSize: "0.66rem", color: GREEN, fontWeight: 700 }}>● Available</span>
                    : <span style={{ fontSize: "0.66rem", color: MUTED, fontWeight: 700 }}>Planned</span>}
                </div>
                <div style={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>{p.description}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.capabilities.map(c => <span key={c} style={{ fontSize: "0.68rem", background: "rgba(31,94,255,0.08)", color: BLUE, borderRadius: 6, padding: "2px 7px" }}>{CAP[c] ?? c}</span>)}
                  <span style={{ fontSize: "0.68rem", color: MUTED, padding: "2px 2px" }}>· {TRANSPORT[p.transport]}</span>
                </div>
                {detail(p)}
                {p.transport === "cloud_api" && p.status === "available" && conn.data && <ConnectPanel provider={p.id} data={conn.data} call={conn.call} reload={conn.load} />}
              </div>
              {p.href && p.status === "available" && (
                <Link href={p.href} style={{ background: GOLD, color: BG, borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: "0.8rem", textDecoration: "none", whiteSpace: "nowrap" }}>Open →</Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
