"use client";
// "Match books with Tally": after vouchers are imported, bring the rest of Tally's books across — each ledger's group,
// the opening balances, and the year's change in stock — then compare FreWork's profit or loss with Tally's.
// Tally is asked only for groups and opening balances: asking it for year-end balances makes it total every voucher,
// which freezes some installs. FreWork works the year-end figures out from the imported vouchers instead.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { tallyFetch } from "@/lib/tallyUtils";
import { ledgerOpeningsXml, groupsXml, ledgerBooksFrom, groupsFrom, headKeyFor, drCr, stockFigures } from "@/lib/integrations/tallyBooks";

const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amount = (s: string) => { const n = Number(s.replace(/[,₹\s]/g, "")); return s.trim() && Number.isFinite(n) ? n : null; };
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const fieldStyle = { flex: "1 1 160px", display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.74rem", fontWeight: 600, color: "#5E6B66" };
const inputStyle = { height: 38, borderRadius: 8, border: "1px solid #DCD3C2", padding: "0 10px", fontFamily: "inherit", fontSize: "0.9rem", background: "#FFFFFF" };

export default function MatchBooksPanel({ bizId, tallyUrl, company, from, to }: { bizId: string | null; tallyUrl: string; company: string; from: string; to: string }) {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<{ t: string; ok: boolean }[]>([]);
  const [pl, setPl] = useState<number | null>(null);
  const [closingStock, setClosingStock] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [tallyResult, setTallyResult] = useState("");
  const [resultKind, setResultKind] = useState<"loss" | "profit">("loss");
  // The figures typed in are kept per business and year on this device, so they're there next time
  const memKey = bizId ? `fw_tally_match:${bizId}:${from}` : "";
  useEffect(() => {
    if (!memKey) return;
    try {
      const m = JSON.parse(localStorage.getItem(memKey) ?? "null") as { o?: string; c?: string; r?: string; k?: "loss" | "profit" } | null;
      if (m) { setOpeningStock(m.o ?? ""); setClosingStock(m.c ?? ""); setTallyResult(m.r ?? ""); if (m.k) setResultKind(m.k); }
    } catch { /* nothing saved */ }
  }, [memKey]);
  useEffect(() => {
    if (!memKey || (!openingStock && !closingStock && !tallyResult)) return;
    try { localStorage.setItem(memKey, JSON.stringify({ o: openingStock, c: closingStock, r: tallyResult, k: resultKind })); } catch { /* private mode */ }
  }, [memKey, openingStock, closingStock, tallyResult, resultKind]);
  const say = (t: string, ok = true) => setSteps(s => [...s, { t, ok }]);

  async function run() {
    if (!bizId || !from || !to) return;
    setBusy(true); setSteps([]); setPl(null);
    try {
      // 1. Groups, then ledgers with opening balances — one request at a time
      say("Reading groups from Tally…");
      const groups = groupsFrom(await (await tallyFetch(tallyUrl, groupsXml(company || null), 60000)).text());
      say("Reading ledgers and opening balances from Tally…");
      const ledgers = ledgerBooksFrom(await (await tallyFetch(tallyUrl, ledgerOpeningsXml(company || null), 90000)).text());
      if (!ledgers.length) { say("Tally sent no ledgers — check the company open in Tally.", false); return; }
      const withHead = ledgers.map(l => ({ ...l, head: headKeyFor(l.parent, groups) }));

      // 2. Groups: every FreWork ledger takes its Tally group
      const rg = await (await post("/api/finance/integrations/tally/books", { business_id: bizId, action: "regroup", ledgers: withHead.filter(l => l.head).map(l => ({ name: l.name, head: l.head })) })).json();
      say(rg.error ? `Groups: ${rg.error}` : `Groups: ${rg.changed} ledger${rg.changed === 1 ? "" : "s"} moved to their Tally group.`, !rg.error);

      // 3. Opening balances as on the first day, once per year
      const { data: fy } = await supabase.from("fw_fin_financial_years").select("id,label").eq("business_id", bizId).eq("start_date", from).maybeSingle();
      if (!fy) { say(`No FreWork financial year starts on ${from} — create it, then run this again.`, false); return; }
      const rows = withHead.filter(l => Math.abs(l.opening) >= 0.005 && l.head).map(l => { const x = drCr(l.opening); return { ledger: l.name, head: l.head!, debit: x.dr, credit: x.cr }; });
      if (!rows.length) say("Opening balances: none in Tally.");
      else {
        const r = await post("/api/finance/opening-balances", { business_id: bizId, fy_id: fy.id, rows, retained: "Capital Account", retained_head: "capital" });
        const j = await r.json().catch(() => ({}));
        say(r.ok ? `Opening balances: ${rows.length} ledgers posted as ${j.entry_no}.` : `Opening balances: ${j.error ?? "couldn't post"}`, r.ok || r.status === 409);
      }

      // 4. Change in stock. A Stock-in-Hand ledger gives the opening; a company that keeps stock in items (inventory)
      //    has none, so the opening is typed in from Tally's P&L. The closing is always typed in.
      const st = stockFigures(ledgers.map(l => ({ ...l, closing: 0 })), groups);
      const closing = amount(closingStock), typedOpening = amount(openingStock);
      const opening = typedOpening ?? (st.ledgers.length ? st.opening : null);
      const stockLedger = st.ledgers[0] ?? "Stock-in-Hand";
      if (closing === null || opening === null) say("Stock: type the opening and closing stock from Tally's Profit & Loss above, then match again.", false);
      else {
        const s = await (await post("/api/finance/integrations/tally/books", { business_id: bizId, action: "stock", fy_id: fy.id, stock_ledger: stockLedger, opening, closing })).json();
        say(s.error ? `Stock: ${s.error}` : s.already ? `Stock: already posted as ${s.entry_no}.` : s.nothing ? "Stock: no change in the year." : `Stock: opening ${inr(opening)} → closing ${inr(closing)}, posted as ${s.entry_no}.`, !s.error);
      }

      // 5. FreWork's profit or loss for the year, against Tally's
      const rep = await fetch(`/api/finance/reports?business_id=${bizId}&fy_id=${fy.id}&from=${from}&to=${to}&report=all`).then(r => r.ok ? r.json() : null).catch(() => null);
      const np = rep?.profit_loss?.net_profit;
      if (typeof np !== "number") { say("Couldn't read FreWork's Profit & Loss.", false); return; }
      setPl(np);
      const want = amount(tallyResult);
      if (want === null) { say(`FreWork's ${np < 0 ? "net loss" : "net profit"} is ${inr(Math.abs(np))}. Type Tally's figure above to compare.`); return; }
      const tallyNp = resultKind === "loss" ? -Math.abs(want) : Math.abs(want);
      const d = Math.round((np - tallyNp) * 100) / 100;
      say(Math.abs(d) < 1 ? `Matched: FreWork's ${np < 0 ? "net loss" : "net profit"} of ${inr(Math.abs(np))} equals Tally's.`
        : `Not matched: FreWork ${inr(np)} vs Tally ${inr(tallyNp)} — a difference of ${inr(d)}.`, Math.abs(d) < 1);
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't reach Tally.", false);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid #EFE8D9", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Match books with Tally</div>
        <div style={{ fontSize: "0.78rem", color: "#5E6B66", lineHeight: 1.5 }}>After importing vouchers: puts each ledger in its Tally group, brings in opening balances and the year&apos;s change in stock, then compares FreWork&apos;s profit or loss with Tally&apos;s.</div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={fieldStyle}>Opening stock (Tally P&amp;L)
          <input value={openingStock} onChange={e => setOpeningStock(e.target.value)} inputMode="decimal" placeholder="0.00" style={inputStyle} />
        </label>
        <label style={fieldStyle}>Closing stock (Tally P&amp;L)
          <input value={closingStock} onChange={e => setClosingStock(e.target.value)} inputMode="decimal" placeholder="0.00" style={inputStyle} />
        </label>
        <label style={fieldStyle}>Tally&apos;s net result for the year
          <input value={tallyResult} onChange={e => setTallyResult(e.target.value)} inputMode="decimal" placeholder="0.00" style={inputStyle} />
        </label>
        <select value={resultKind} onChange={e => setResultKind(e.target.value as "loss" | "profit")} aria-label="Profit or loss" style={{ ...inputStyle, padding: "0 8px" }}>
          <option value="loss">Loss</option><option value="profit">Profit</option>
        </select>
      </div>
      <button onClick={run} disabled={busy || !bizId} style={{ height: 42, borderRadius: 10, border: "1px solid #12352D", background: "#12352D", color: "#FFFFFF", fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
        {busy ? "Matching with Tally…" : `Match ${from.slice(0, 4)}-${to.slice(2, 4)} books with Tally`}
      </button>
      {pl !== null && <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>FreWork {pl < 0 ? "net loss" : "net profit"}: {inr(Math.abs(pl))}</div>}
      {steps.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem" }}>
          {steps.map((s, i) => <li key={i} style={{ color: s.ok ? "#0B7A55" : "#8A5A00" }}>{s.ok ? "✓" : "!"} {s.t}</li>)}
        </ul>
      )}
    </div>
  );
}
