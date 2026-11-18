"use client";
// One entry on its own page — opened from anywhere ("Open invoice", audit findings, recent activity…), with a Back
// button to the page you came from. Edit and Reverse stay one tap away.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";

type J = { id: string; entry_no: string; date: string; type: string; status: string; narration: string | null; reference_no: string | null; party_name?: string | null; total_debit: number; source?: string | null };
type L = { id: string; dr_amount: number; cr_amount: number; narration: string | null; account_id: string; fw_fin_chart_of_accounts: { name: string; type: string } | null };
const C = { bg: "#F4EFE4", card: "#FFFDF8", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", green: "#12352D", gold: "#D9B56F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const money = (n: number) => n ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [j, setJ] = useState<J | null>(null);
  const [lines, setLines] = useState<L[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").trim();
      const { data, error } = await supabase.from("fw_fin_journals").select("*").eq("id", id).eq("business_id", biz).maybeSingle();
      if (error || !data) { setErr("This entry wasn't found in the business you have open."); return; }
      setJ(data as J);
      const { data: ls } = await supabase.from("fw_fin_journal_lines").select("id,dr_amount,cr_amount,narration,account_id,fw_fin_chart_of_accounts(name,type)").eq("journal_id", id).order("sort_order");
      setLines((ls ?? []) as unknown as L[]);
    });
  }, [id, router]);

  const back = () => { if (window.history.length > 1) router.back(); else router.push("/finance/journals"); };
  const dr = lines.reduce((s, l) => s + (Number(l.dr_amount) || 0), 0), cr = lines.reduce((s, l) => s + (Number(l.cr_amount) || 0), 0);
  const pill = (t: string, bg: string, fg: string) => <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: bg, color: fg }}>{t}</span>;
  const btn: React.CSSProperties = { height: 38, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.green, fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: SERIF }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={back} style={btn}>← Back</button>
          <span style={{ flex: 1 }} />
          {j && j.status !== "voided" && <Link href={`/finance/journals/${j.id}/edit`} style={{ ...btn, background: C.green, color: "#FFFFFF", borderColor: C.green }}>✎ Edit entry</Link>}
          {j && <Link href={`/finance/journals?id=${j.id}`} style={btn}>Open in Journal</Link>}
        </div>
        {err && <div role="alert" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, color: "#8A2A1A" }}>{err}</div>}
        {!j && !err && <div style={{ color: C.muted }}>Opening the entry…</div>}
        {j && (
          <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, overflow: "hidden" }}>
            <div style={{ background: C.green, color: "#FFFFFF", padding: "20px 24px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.2em", color: C.gold, textTransform: "uppercase" }}>{j.type.replace(/_/g, " ")} · {j.entry_no}</div>
                <div style={{ fontSize: 24, marginTop: 4 }}>{j.party_name || j.narration || j.entry_no}</div>
                <div style={{ fontSize: 14, color: "#C9D3CE", marginTop: 2 }}>{new Date(j.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}{j.reference_no ? ` · Ref ${j.reference_no}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontVariantNumeric: "tabular-nums", color: C.gold }}>{money(Number(j.total_debit) || dr)}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>{j.status === "posted" ? pill("Posted", "#E3F3EC", "#0B5E42") : j.status === "draft" ? pill("Draft", "#FBF1DA", "#7A5300") : pill(j.status, "#FBE3DE", "#8A2A1A")}</div>
              </div>
            </div>
            {j.narration && j.narration !== j.party_name && <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.line}`, fontStyle: "italic", color: C.muted }}>{j.narration}</div>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                <thead><tr style={{ color: C.muted, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}><th style={{ textAlign: "left", padding: "12px 24px" }}>Account</th><th style={{ textAlign: "right", padding: "12px 12px" }}>Debit</th><th style={{ textAlign: "right", padding: "12px 24px" }}>Credit</th></tr></thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: "12px 24px" }}><Link href={`/finance/ledger?account=${l.account_id}`} style={{ color: C.ink, textDecoration: "none", fontWeight: 600 }}>{l.fw_fin_chart_of_accounts?.name ?? "—"}</Link>{l.fw_fin_chart_of_accounts?.type && <span style={{ fontSize: 12, color: C.muted }}> · {l.fw_fin_chart_of_accounts.type}</span>}</td>
                      <td style={{ padding: "12px 12px", textAlign: "right", color: "#8A2A1A" }}>{money(Number(l.dr_amount) || 0)}</td>
                      <td style={{ padding: "12px 24px", textAlign: "right", color: "#0B5E42" }}>{money(Number(l.cr_amount) || 0)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.green}`, fontWeight: 700 }}><td style={{ padding: "12px 24px" }}>Total</td><td style={{ padding: "12px 12px", textAlign: "right" }}>{money(dr)}</td><td style={{ padding: "12px 24px", textAlign: "right" }}>{money(cr)}</td></tr>
                </tbody>
              </table>
            </div>
            {Math.abs(dr - cr) > 0.005 && <div style={{ padding: "10px 24px", color: "#8A2A1A" }}>Debits and credits differ by {money(Math.abs(dr - cr))} — open Edit to correct the lines.</div>}
          </section>
        )}
      </div>
    </div>
  );
}
