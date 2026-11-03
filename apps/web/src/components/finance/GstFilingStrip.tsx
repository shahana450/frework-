"use client";
// GST filing status on Home — GSTR-1 and GSTR-3B for the last two return periods: filed (with date), due, or late.
// The status comes from the GST portal via Integrations → GST & IT portals (Portal Connect) (or returns filed through FreBook).
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type St = { form: string; period: string; status: string; filed_on: string | null; arn: string | null; fetched_at?: string | null };
const FILED = ["filed", "e_verified", "processed"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function GstFilingStrip({ bizId, gstin }: { bizId: string; gstin?: string | null }) {
  const [rows, setRows] = useState<St[] | null>(null);
  const now = new Date();
  const periods = [ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymOf(new Date(now.getFullYear(), now.getMonth() - 2, 1))];

  useEffect(() => {
    if (!bizId) return;
    supabase.from("fw_fin_portal_status").select("form,period,status,filed_on,arn,fetched_at").eq("business_id", bizId).eq("portal", "gst").in("form", ["GSTR-1", "GSTR-3B"]).in("period", periods)
      .then(({ data, error }) => setRows(error ? [] : (data ?? []) as St[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId]);
  if (gstin === null || gstin === "") return null;   // not GST-registered

  let scheme = "monthly"; try { scheme = localStorage.getItem(`fw_gst_scheme_${bizId}`) ?? "monthly"; } catch { /* */ }
  if (scheme === "composition") return null;
  const due = (form: string, ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    if (scheme === "qrmp") return m % 3 === 0 ? new Date(Date.UTC(y, m, form === "GSTR-1" ? 13 : 22)) : null;
    return new Date(Date.UTC(y, m, form === "GSTR-1" ? 11 : 20));
  };
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const pill = (form: string, ym: string) => {
    const s = (rows ?? []).find(r => r.form === form && r.period === ym);
    if (s && FILED.includes(s.status)) return { tone: "ok", text: `✓ Filed${s.filed_on ? ` ${s.filed_on.slice(8, 10)} ${MON[+s.filed_on.slice(5, 7) - 1]}` : ""}`, title: s.arn ? `ARN ${s.arn}` : "Filed" };
    const d = due(form, ym);
    if (!d) return { tone: "na", text: "Quarterly", title: "Filed with the quarter" };
    const days = Math.round((d.getTime() - today) / 86400000);
    if (days < 0) return { tone: "late", text: `${-days}d late`, title: `Was due ${d.toISOString().slice(0, 10)}` };
    return { tone: "due", text: days === 0 ? "Due today" : `Due in ${days}d`, title: `Due ${d.toISOString().slice(0, 10)}` };
  };
  const TONE: Record<string, [string, string]> = { ok: ["#E3F3EC", "#0B7A55"], due: ["#FBF1DA", "#9A6B22"], late: ["#FBE3DE", "#B4321F"], na: ["#EEF0EF", "#6B7570"] };
  const fetched = (rows ?? []).map(r => r.fetched_at).filter(Boolean).sort().pop();

  const DOT: Record<string, string> = { ok: "#12A06C", due: "#D9A441", late: "#D2492F", na: "#A9B1AD" };
  const late = periods.some(ym => (["GSTR-1", "GSTR-3B"] as const).some(f => pill(f, ym).tone === "late"));
  const updated = fetched ? new Date(fetched).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div role="group" aria-label="GST filing status" style={{ display: "inline-flex", alignItems: "stretch", background: "#FFFDF8", border: `1px solid ${late ? "#EFC3B8" : "#E6DFD0"}`, borderRadius: 14, overflow: "hidden", color: "#10241F", boxShadow: "0 8px 22px -18px rgba(15,43,37,0.55)" }}>
      {/* Label block */}
      <div style={{ background: "#12352D", color: "#FFFFFF", padding: "8px 14px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minWidth: 92 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#C9A24A", fontWeight: 800 }}>GST returns</span>
        <span style={{ fontSize: 11.5, color: "#C9D3CE" }}>{updated ? `Portal · ${updated}` : "Portal not linked"}</span>
      </div>
      {/* One column per month */}
      {periods.map((ym, i) => (
        <div key={ym} style={{ padding: "7px 14px", display: "flex", flexDirection: "column", gap: 3, borderLeft: i ? "1px solid #EFE8DA" : "none", justifyContent: "center" }}>
          <span style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontStyle: "italic", fontSize: 13, color: "#5E6B66" }}>{MON[+ym.slice(5, 7) - 1]} {ym.slice(0, 4)}</span>
          {(["GSTR-1", "GSTR-3B"] as const).map(f => { const p = pill(f, ym); const fg = TONE[p.tone][1]; return (
            <span key={f} title={`${f} · ${p.title}`} style={{ display: "grid", gridTemplateColumns: "8px 54px auto", alignItems: "center", gap: 7, fontSize: 12.5, whiteSpace: "nowrap" }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: rows ? DOT[p.tone] : "#D9D2C2" }} />
              <span style={{ fontWeight: 700 }}>{f}</span>
              <span style={{ color: fg, fontWeight: 700 }}>{rows ? p.text.replace(/(\d+)d /, "$1 days ").replace(/in (\d+)d$/, "in $1 days") : "…"}</span>
            </span>
          ); })}
        </div>
      ))}
      {/* Update from the portal */}
      <Link href="/finance/portals" title={updated ? `Fetch the latest status from the GST portal (last ${updated})` : "Connect the GST portal to fetch filing status"}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderLeft: "1px solid #EFE8DA", background: "#F7F1E3", color: "#12352D", fontWeight: 800, fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>
        <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: "#C9A24A", color: "#10241F", display: "grid", placeItems: "center", fontSize: 13 }}>{updated ? "↻" : "→"}</span>
        {updated ? "Update" : "Connect portal"}
      </Link>
    </div>
  );
}
