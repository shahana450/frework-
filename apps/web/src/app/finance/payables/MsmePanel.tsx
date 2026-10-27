"use client";
// MSME payments, section 43B(h): bills from micro / small suppliers with the date each must be paid by for the
// expense to count this year. Hidden when no supplier is marked MSME.
import Link from "next/link";
import type { MsmeReport } from "@/lib/msme43bh";

const C = { ink: "#10241F", muted: "#6B7570", line: "#E1E4EE", neg: "#B4321F", negSoft: "#FDECEA", warn: "#9A6B22", warnSoft: "#FFF4DB", pos: "#0B7A55", posSoft: "#E3F6EE" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const dt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function MsmePanel({ report, setupNeeded, marked }: { report: MsmeReport | null; setupNeeded: boolean; marked: number }) {
  if (setupNeeded) return (
    <div style={{ marginBottom: "1.5rem", padding: "0.8rem 1rem", borderRadius: 10, background: C.warnSoft, color: C.warn, fontSize: "0.82rem", fontWeight: 600 }}>
      MSME payment tracking (section 43B(h)) needs a one-time setup: run 2026-11-04_msme.sql in Supabase.
    </div>
  );
  if (!marked) return (
    <div style={{ marginBottom: "1.5rem", padding: "0.8rem 1rem", borderRadius: 10, border: `1px dashed ${C.line}`, background: "#FFFDF8", color: C.muted, fontSize: "0.82rem", lineHeight: 1.55 }}>
      <b style={{ color: C.ink }}>MSME suppliers (section 43B(h)):</b> payments to micro and small suppliers must be made within 15 days (or the agreed period, max 45) or the expense isn&apos;t allowed this year.{" "}
      <Link href="/finance/contacts" style={{ color: "#12352D", fontWeight: 700 }}>Mark your MSME suppliers →</Link>
    </div>
  );
  if (!report) return null;
  const urgent = report.bills.filter(b => b.status !== "ok");
  return (
    <section aria-label="MSME payments due" style={{ marginBottom: "1.5rem", background: "#FFFDF8", border: `1px solid ${C.line}`, borderRadius: 12, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: "0.95rem", color: C.ink }}>MSME payments · section 43B(h)</b>
        <span style={{ fontSize: "0.78rem", color: C.muted }}>Pay by the date shown, or the expense counts only in the year you pay.</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { l: "Past the limit", v: report.overdue, bg: C.negSoft, fg: C.neg },
          { l: "Due in 7 days", v: report.dueSoon, bg: C.warnSoft, fg: C.warn },
          { l: `Disallowed if unpaid on ${dt(report.fyEnd)}`, v: report.atRiskAtFyEnd, bg: "#F8F3E8", fg: C.ink },
        ].map(k => (
          <div key={k.l} style={{ flex: "1 1 160px", padding: "0.6rem 0.8rem", borderRadius: 10, background: k.bg }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.muted }}>{k.l}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: k.fg, fontVariantNumeric: "tabular-nums" }}>{inr(k.v)}</div>
          </div>
        ))}
      </div>
      {urgent.length === 0 ? <span style={{ fontSize: "0.82rem", color: C.pos, fontWeight: 700 }}>✓ No MSME payment is due in the next 7 days.</span> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
            <thead><tr style={{ color: C.muted, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Supplier</th><th style={{ padding: "4px 6px" }}>Bill date</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Unpaid</th><th style={{ padding: "4px 6px" }}>Pay by</th><th /></tr></thead>
            <tbody>{urgent.slice(0, 12).map((b, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "6px", fontWeight: 700 }}>{b.supplier}</td>
                <td style={{ padding: "6px" }}>{dt(b.billDate)}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>{inr(b.unpaid)}</td>
                <td style={{ padding: "6px" }}>{dt(b.dueDate)}</td>
                <td style={{ padding: "6px" }}><span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: b.status === "overdue" ? C.negSoft : C.warnSoft, color: b.status === "overdue" ? C.neg : C.warn }}>{b.status === "overdue" ? `${-b.daysLeft}d late` : b.daysLeft === 0 ? "Today" : `${b.daysLeft}d left`}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
