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

  return (
    <div role="group" aria-label="GST filing status" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 36, padding: "4px 6px 4px 12px", background: "#FFFFFF", border: "1px solid #E6DFD0", borderRadius: 12, fontSize: 12.5, color: "#10241F" }}>
      <b style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A6B22" }}>GST</b>
      {periods.map(ym => (
        <span key={ym} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: "#5E6B66" }}>{MON[+ym.slice(5, 7) - 1]}</span>
          {(["GSTR-1", "GSTR-3B"] as const).map(f => { const p = pill(f, ym); const [bg, fg] = TONE[p.tone]; return (
            <span key={f} title={`${f} · ${p.title}`} style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 8px", borderRadius: 999, background: bg, color: fg, fontWeight: 700, whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600, opacity: 0.8 }}>{f === "GSTR-1" ? "R1" : "3B"}</span>{rows ? p.text : "…"}
            </span>
          ); })}
        </span>
      ))}
      <Link href="/finance/portals" title={fetched ? `Status from the GST portal, updated ${new Date(fetched).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Connect the GST portal to fetch filing status"}
        style={{ padding: "4px 10px", borderRadius: 8, color: "#12352D", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
        {fetched ? "Update ↻" : "Connect portal →"}
      </Link>
    </div>
  );
}
