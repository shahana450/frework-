"use client";
// The same small Tally status on every page that uses Tally. Settings (port, company, bridge) live on the Tally page only.
import Link from "next/link";
import { useTally, connectTally } from "@/lib/tallyConnection";

export default function TallyBar({ preferName, children, returnTo }: { preferName?: string; children?: React.ReactNode; returnTo?: string }) {
  const t = useTally();
  const on = t.status === "connected";
  const hub = `/finance/tally${returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E6DFD0", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "0.88rem", color: "#10241F" }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: on ? "#0B7A55" : t.status === "connecting" ? "#B07E33" : t.status === "error" ? "#C2321F" : "#B9B2A3" }} />
          Tally
        </span>
        <span style={{ fontSize: "0.84rem", color: on ? "#0B7A55" : t.status === "error" ? "#C2321F" : "#5E6B66", fontWeight: on ? 700 : 500 }}>
          {t.status === "connecting" ? "Connecting…" : on ? <>Connected to <b>{t.company || "Tally"}</b></> : t.status === "error" ? "Not reachable" : t.company ? `Not checked — ${t.company}` : "Not set up yet"}
        </span>
        {on && t.educational && <span title="Unlicensed Tally only accepts vouchers dated the 1st, 2nd or 31st" style={{ fontSize: "0.72rem", fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "#FFF4DB", color: "#8A5A00" }}>Educational mode</span>}
        <span style={{ flex: 1 }} />
        {children}
        {t.company && (
          <button onClick={() => connectTally({ preferName })} disabled={t.status === "connecting"} style={{ height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid #D8CDB4", background: "#FFFFFF", color: "#10241F", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
            {on ? "Recheck" : "Reconnect"}
          </button>
        )}
        <Link href={hub} style={{ height: 34, padding: "0 14px", borderRadius: 9, background: "#0F2B25", color: "#FFFFFF", fontWeight: 800, fontSize: "0.8rem", textDecoration: "none", display: "flex", alignItems: "center" }}>
          {t.company ? "Manage Tally →" : "Set up Tally →"}
        </Link>
      </div>
      {t.status === "error" && (
        <div style={{ fontSize: "0.78rem", color: "#5E6B66", paddingLeft: 4 }}>
          Open Tally with your company loaded, keep the FreWork Tally Bridge running, then press Reconnect. Port and company are set on the <Link href={hub} style={{ color: "#0F2B25", fontWeight: 700 }}>Tally page</Link>.
        </div>
      )}
    </div>
  );
}
