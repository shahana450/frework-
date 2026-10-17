"use client";
// Admin: FreBook WhatsApp health — token works, number status, apps receiving messages; one click connects the
// WhatsApp account to the current app so its webhook gets messages.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Health = { token_ok: boolean; token_error: string | null; phone: Record<string, string> | null; subscribed_apps: { name?: string; id?: string }[] | null; apps_error: string | null };

export default function AdminWhatsApp() {
  const [h, setH] = useState<Health | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (method: "GET" | "POST") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const r = await fetch("/api/admin/whatsapp", { method, headers: { Authorization: `Bearer ${session.access_token}` } });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };
  const load = async () => { const r = await call("GET"); if (r?.ok) setH(r.j); else if (r) setMsg(r.j.error ?? "Couldn't check WhatsApp."); };
  useEffect(() => { void load(); }, []);

  const connect = async () => {
    setBusy(true); setMsg("");
    const r = await call("POST");
    setMsg(r?.ok ? "✓ Connected — the WhatsApp account now sends messages to this app. Send Hi to FreBook to test." : `⚠ ${r?.j.error ?? "Couldn't connect."}`);
    setBusy(false); void load();
  };

  const row = (k: string, v: React.ReactNode, tone = "#141A3A") => <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "5px 0", borderBottom: "1px solid #EEF0F6" }}><span style={{ color: "#5A6080", minWidth: 150 }}>{k}</span><b style={{ color: tone }}>{v}</b></div>;
  return (
    <section id="wa-panel" style={{ background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 20, padding: 20, marginBottom: 24, color: "#141A3A", scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>FreBook WhatsApp</h2>
        <button onClick={() => void load()} style={{ marginLeft: "auto", height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid #E1E4EE", background: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Recheck</button>
        <button onClick={connect} disabled={busy} style={{ height: 32, padding: "0 14px", borderRadius: 9, border: "none", background: "#0B7A55", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>{busy ? "Connecting…" : "Connect WhatsApp to this app"}</button>
      </div>
      {!h ? <div style={{ fontSize: 13, color: "#5A6080" }}>{msg || "Checking…"}</div> : <>
        {row("Access token", h.token_ok ? "Working" : `Not working — ${h.token_error}`, h.token_ok ? "#0B7A55" : "#C2321F")}
        {h.phone && row("Number", `${h.phone.display_phone_number ?? ""} · ${h.phone.verified_name ?? ""}`)}
        {h.phone && row("Status", `${h.phone.status ?? h.phone.code_verification_status ?? "—"} · quality ${(h.phone.quality_rating ?? "—").toString().toLowerCase()} · name ${(h.phone.name_status ?? "—").toString().toLowerCase()}`)}
        {row("Apps receiving messages", h.subscribed_apps ? (h.subscribed_apps.length ? h.subscribed_apps.map(a => a.name ?? a.id).join(", ") : "None — press Connect") : (h.apps_error ?? "—"), h.subscribed_apps?.length ? "#0B7A55" : "#B87800")}
        {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith("✓") ? "#0B7A55" : "#C2321F" }}>{msg}</div>}
      </>}
    </section>
  );
}

/** Red banner at the top of the admin dashboard — only when FreBook's WhatsApp needs attention. */
export function AdminWhatsAppBanner() {
  const [issues, setIssues] = useState<string[]>([]);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const r = await fetch("/api/admin/whatsapp", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
      if (!r?.ok) return;
      const h = await r.json() as Health;
      const out: string[] = [];
      if (!h.token_ok) out.push("the access token isn't working, so FreBook can't reply");
      else {
        const st = (h.phone?.status ?? "").toString();
        if (st && st !== "CONNECTED") out.push(`the number's status is ${st}`);
        if (h.phone?.quality_rating && h.phone.quality_rating !== "GREEN") out.push(`message quality is ${h.phone.quality_rating.toString().toLowerCase()}`);
        if (h.subscribed_apps && h.subscribed_apps.length === 0) out.push("no app is receiving messages");
      }
      setIssues(out);
    });
  }, []);
  if (!issues.length) return null;
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FDECEA", border: "1px solid #E8A59B", borderLeft: "5px solid #C2321F", borderRadius: 14, padding: "12px 16px", marginBottom: 20, color: "#7A1C10" }}>
      <span style={{ fontSize: 14 }}>⚠ <b>FreBook WhatsApp needs attention</b> — {issues.join("; ")}.</span>
      <a href="#wa-panel" style={{ marginLeft: "auto", height: 34, padding: "0 14px", borderRadius: 9, background: "#C2321F", color: "#FFFFFF", fontWeight: 800, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Fix →</a>
    </div>
  );
}
