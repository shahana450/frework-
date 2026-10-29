"use client";
// "Match books with Tally": after vouchers are imported, bring the rest of Tally's books across — each ledger's group,
// the opening balances, and the year's change in stock — then compare every ledger's closing balance with Tally's.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { tallyFetch } from "@/lib/tallyUtils";
import { ledgerBooksXml, groupsXml, ledgerBooksFrom, groupsFrom, headKeyFor, drCr, stockFigures, type TallyLedgerBook } from "@/lib/integrations/tallyBooks";

type Diff = { name: string; tally: number; frework: number; diff: number };
const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Balance as one signed number: debit positive, credit negative
const signedTally = (l: TallyLedgerBook) => Math.round(-l.closing * 100) / 100;

export default function MatchBooksPanel({ bizId, tallyUrl, company, from, to }: { bizId: string | null; tallyUrl: string; company: string; from: string; to: string }) {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<{ t: string; ok: boolean }[]>([]);
  const [diffs, setDiffs] = useState<Diff[] | null>(null);
  const [matched, setMatched] = useState(0);
  const say = (t: string, ok = true) => setSteps(s => [...s, { t, ok }]);

  async function run() {
    if (!bizId || !from || !to) return;
    setBusy(true); setSteps([]); setDiffs(null);
    try {
      // 1. Read Tally's groups and every ledger's opening / closing balance (a second or two)
      say("Reading ledgers and groups from Tally…");
      const [gTxt, lTxt] = await Promise.all([
        tallyFetch(tallyUrl, groupsXml(company || null), 60000).then(r => r.text()),
        tallyFetch(tallyUrl, ledgerBooksXml(from, to, company || null), 120000).then(r => r.text()),
      ]);
      const groups = groupsFrom(gTxt), ledgers = ledgerBooksFrom(lTxt);
      if (!ledgers.length) { say("Tally sent no ledgers — check the company open in Tally.", false); return; }
      const withHead = ledgers.map(l => ({ ...l, head: headKeyFor(l.parent, groups) }));

      // 2. Groups: every FreWork ledger takes its Tally group
      const rg = await fetch("/api/finance/integrations/tally/books", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: bizId, action: "regroup", ledgers: withHead.filter(l => l.head).map(l => ({ name: l.name, head: l.head })) }) }).then(r => r.json());
      say(rg.error ? `Groups: ${rg.error}` : `Groups: ${rg.changed} ledger${rg.changed === 1 ? "" : "s"} moved to their Tally group.`, !rg.error);

      // 3. Opening balances as on the first day, once per year
      const { data: fy } = await supabase.from("fw_fin_financial_years").select("id,label").eq("business_id", bizId).eq("start_date", from).maybeSingle();
      if (!fy) say(`No FreWork financial year starts on ${from} — create it, then run this again.`, false);
      else {
        const rows = withHead.filter(l => Math.abs(l.opening) >= 0.005 && l.head).map(l => { const x = drCr(l.opening); return { ledger: l.name, head: l.head!, debit: x.dr, credit: x.cr }; });
        if (!rows.length) say("Opening balances: none in Tally.");
        else {
          const r = await fetch("/api/finance/opening-balances", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_id: bizId, fy_id: fy.id, rows, retained: "Capital Account", retained_head: "capital" }) });
          const j = await r.json().catch(() => ({}));
          say(r.ok ? `Opening balances: ${rows.length} ledgers posted as ${j.entry_no}.` : r.status === 409 ? `Opening balances: ${j.error}` : `Opening balances: ${j.error ?? "couldn't post"}`, r.ok || r.status === 409);
        }

        // 4. Change in stock for the year
        const st = stockFigures(ledgers, groups);
        if (!st.ledgers.length) say("Stock: no Stock-in-Hand ledger in Tally.");
        else {
          const s = await fetch("/api/finance/integrations/tally/books", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_id: bizId, action: "stock", fy_id: fy.id, stock_ledger: st.ledgers[0], opening: st.opening, closing: st.closing }) }).then(r => r.json());
          say(s.error ? `Stock: ${s.error}` : s.already ? `Stock: already posted as ${s.entry_no}.` : s.nothing ? "Stock: no change in the year." : `Stock: opening ${inr(st.opening)} → closing ${inr(st.closing)}; change of ${inr(st.change)} posted as ${s.entry_no}.`, !s.error);
        }
      }

      // 5. Compare every ledger's closing balance with Tally
      const rep = fy ? await fetch(`/api/finance/reports?business_id=${bizId}&fy_id=${fy.id}&from=${from}&to=${to}&report=all`).then(r => r.ok ? r.json() : null).catch(() => null) : null;
      const tb = (rep?.trial_balance?.accounts ?? []) as { name: string; dr: number; cr: number }[];
      const fw = new Map(tb.map(a => [a.name.trim().toLowerCase(), Math.round(((a.dr || 0) - (a.cr || 0)) * 100) / 100]));
      const out: Diff[] = [];
      let same = 0;
      for (const l of ledgers) {
        const t = signedTally(l), f = fw.get(l.name.trim().toLowerCase()) ?? 0;
        if (Math.abs(t) < 0.005 && Math.abs(f) < 0.005) continue;
        const d = Math.round((f - t) * 100) / 100;
        if (Math.abs(d) < 1) same++; else out.push({ name: l.name, tally: t, frework: f, diff: d });
      }
      out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      setMatched(same); setDiffs(out);
      say(out.length ? `Compared: ${same} ledgers match Tally, ${out.length} differ.` : `Compared: all ${same} ledgers match Tally.`, !out.length);
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't reach Tally.", false);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid #EFE8D9", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Match books with Tally</div>
        <div style={{ fontSize: "0.78rem", color: "#5E6B66", lineHeight: 1.5 }}>After importing vouchers: puts each ledger in its Tally group, brings in opening balances and the year&apos;s change in stock, then compares every ledger with Tally.</div>
      </div>
      <button onClick={run} disabled={busy || !bizId} style={{ height: 42, borderRadius: 10, border: "1px solid #12352D", background: "#12352D", color: "#FFFFFF", fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
        {busy ? "Matching with Tally…" : `Match ${from.slice(0, 4)}-${to.slice(2, 4)} books with Tally`}
      </button>
      {steps.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem" }}>
          {steps.map((s, i) => <li key={i} style={{ color: s.ok ? "#0B7A55" : "#8A5A00" }}>{s.ok ? "✓" : "!"} {s.t}</li>)}
        </ul>
      )}
      {diffs && diffs.length > 0 && (
        <div style={{ border: "1px solid #EFE8D9", borderRadius: 10, overflow: "auto", maxHeight: 340 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead><tr style={{ background: "#F8F3E8" }}>{["Ledger", "Tally", "FreWork", "Difference"].map((h, i) => <th key={h} style={{ padding: "6px 8px", textAlign: i ? "right" : "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>
              {diffs.slice(0, 100).map(d => (
                <tr key={d.name} style={{ borderTop: "1px solid #EFE8D9" }}>
                  <td style={{ padding: "6px 8px" }}>{d.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{inr(d.tally)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{inr(d.frework)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#B4321F" }}>{inr(d.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "6px 8px", fontSize: "0.74rem", color: "#5E6B66" }}>Debit balances are positive, credit balances negative. {matched} other ledgers match.</div>
        </div>
      )}
    </div>
  );
}
