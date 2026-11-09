// FreBook AI Accounting Detective — deterministic detectors. Pure: the route loads the books, this decides.
// Every finding has a stable fingerprint (rule + the records it is about), so a re-scan updates the same exception
// instead of creating another. Findings are evidence for a person to look at, never a verdict: `confidence`
// says "definite" only for arithmetic/record facts (an entry that doesn't balance); patterns are "likely";
// tax questions that hinge on facts FreBook doesn't hold are "requires_review".
import type { QJournal } from "../bookQueries";
import { ruleOn, type TaxRule } from "./taxRules";

export type DAccount = { id: string; name: string; type: string; sub_type: string | null; is_group?: boolean | null };
export type Category = "missing_entry" | "missing_document" | "duplicate" | "classification" | "balance" | "advance" | "ageing" | "unusual" | "integrity" | "period" | "gst" | "tds" | "income_tax" | "bank";
export type Priority = "high" | "medium" | "low";
export type Confidence = "definite" | "likely" | "requires_review";
export type Finding = {
  fingerprint: string; ruleId: string; ruleVersion: number; category: Category; priority: Priority; confidence: Confidence;
  date: string | null; amount: number | null; ledger: string | null; party: string | null;
  title: string; description: string; evidence: { label: string; value: string; journalId?: string }[];
  suggestedAction: string; journalIds: string[]; needsDocument?: boolean; provision?: string;
};
export type FeedLine = { id: string; date: string; description: string; party: string | null; amount: number; provider: string };
export type PartyInfo = { name: string; gstin: string | null };
export type DetectInput = {
  accounts: DAccount[]; journals: QJournal[]; today: string; period: { from: string; to: string };
  rules: TaxRule[]; businessId?: string;
  documentedJournalIds?: Set<string>;   // entries with a bill/invoice attached or linked
  unbookedFeed?: FeedLine[];            // bank/payment lines fetched but not booked
  parties?: PartyInfo[];                // contacts with GSTIN
  businessGstin?: string | null;
  docThreshold?: number;                // purchases/expenses at or above this need a document (default ₹5,000)
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const inr = (n: number) => "₹" + Math.abs(r2(n)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const total = (j: QJournal) => r2(j.lines.reduce((s, l) => s + (Number(l.dr) || 0), 0));
const ev = (label: string, value: string, journalId?: string) => ({ label, value, ...(journalId ? { journalId } : {}) });

export const isCash = (a?: DAccount) => !!a && (a.sub_type === "cash" || (/\b(cash|petty cash)\b/i.test(a.name) && !/bank|cash credit/i.test(a.name) && a.type === "asset"));
export const isBank = (a?: DAccount) => !!a && (a.sub_type === "bank" || (a.type === "asset" && /\bbank\b/i.test(a.name) && !/charges|commission|interest/i.test(a.name)));
const isDebtor = (a?: DAccount) => !!a && (a.sub_type === "trade_receivables" || /sundry debtors/i.test(a.name));
const isCreditor = (a?: DAccount) => !!a && (a.sub_type === "trade_payables" || /sundry creditors/i.test(a.name));
const isSuspense = (a?: DAccount) => !!a && /\b(suspense|difference|unknown|unclassified|uncategori[sz]ed|ask my accountant)\b/i.test(a.name);
const isLoan = (a?: DAccount) => !!a && a.type === "liability" && (a.sub_type === "long_term_liability" || /\b(loan|deposit|borrowing)s?\b/i.test(a.name));
const isGst = (a?: DAccount) => !!a && /\b(cgst|sgst|utgst|igst|gst)\b/i.test(a.name);
const isInputGst = (a?: DAccount) => isGst(a) && /input|itc|receivable/i.test(a!.name);
const isOutputGst = (a?: DAccount) => isGst(a) && /output|payable/i.test(a!.name);
const isTdsPayable = (a?: DAccount) => !!a && /\btds\b/i.test(a.name) && a.type === "liability";
const isReversal = (j: QJournal) => /^Reversal of /i.test(j.narration ?? "");

export function detect(inp: DetectInput): Finding[] {
  const acc = new Map(inp.accounts.map(a => [a.id, a]));
  const name = (id: string) => acc.get(id)?.name ?? "Unknown ledger";
  const yr = inp.journals.filter(j => j.date >= inp.period.from && j.date <= inp.period.to);
  const reversedNos = new Set(inp.journals.map(j => /^Reversal of (\S+)/i.exec(j.narration ?? "")?.[1]).filter(Boolean) as string[]);
  const live = yr.filter(j => !isReversal(j) && !reversedNos.has(j.entry_no));
  const out: Finding[] = [];
  const rule = (id: string, date: string) => ruleOn(inp.rules, id, date, inp.businessId);
  const party = (j: QJournal) => j.party_name || j.lines.map(l => acc.get(l.account_id)).find(a => isDebtor(a) || isCreditor(a))?.name || null;

  // ── Integrity: unbalanced entries (definite) ──
  for (const j of yr) {
    const dr = r2(j.lines.reduce((s, l) => s + (+l.dr || 0), 0)), cr = r2(j.lines.reduce((s, l) => s + (+l.cr || 0), 0));
    if (Math.abs(dr - cr) >= 0.01) out.push({ fingerprint: `UNBALANCED:${j.id}`, ruleId: "D.UNBALANCED", ruleVersion: 1, category: "integrity", priority: "high", confidence: "definite",
      date: j.date, amount: Math.abs(dr - cr), ledger: null, party: party(j), title: `${j.entry_no} doesn't balance`,
      description: `Debits ${inr(dr)} and credits ${inr(cr)} differ by ${inr(dr - cr)}.`, evidence: [ev("Entry", j.entry_no, j.id), ev("Debits", inr(dr)), ev("Credits", inr(cr))],
      suggestedAction: "Open the entry and correct it with a reversal and a fresh entry.", journalIds: [j.id] });
  }

  // ── Duplicates: same invoice number from the same party; or same day, amount and ledgers ──
  const byRef = new Map<string, QJournal[]>();
  for (const j of live) if (j.reference_no && /sales|purchase|credit_note|debit_note/.test(j.type)) {
    const k = `${j.type}|${(party(j) ?? "").toLowerCase()}|${j.reference_no.trim().toLowerCase()}`;
    (byRef.get(k) ?? byRef.set(k, []).get(k)!).push(j);
  }
  for (const [, js] of byRef) if (js.length > 1) {
    const ids = js.map(j => j.id).sort();
    out.push({ fingerprint: `DUP_INVOICE:${ids.join(",")}`, ruleId: "D.DUPLICATE_INVOICE", ruleVersion: 1, category: "duplicate", priority: "high", confidence: "likely",
      date: js[0].date, amount: total(js[0]), ledger: null, party: party(js[0]), title: `Invoice ${js[0].reference_no} is booked ${js.length} times`,
      description: `The same ${js[0].type} invoice number from ${party(js[0]) ?? "the same party"} appears in ${js.map(j => j.entry_no).join(", ")}.`,
      evidence: js.map(j => ev(j.entry_no, `${j.date} · ${inr(total(j))}`, j.id)), suggestedAction: "If it is the same bill, reverse the extra entry. If they are different bills, mark this a false positive.", journalIds: ids });
  }
  const sig = new Map<string, QJournal[]>();
  for (const j of live) {
    const k = `${j.date}|${total(j)}|${[...new Set(j.lines.map(l => l.account_id))].sort().join(",")}`;
    (sig.get(k) ?? sig.set(k, []).get(k)!).push(j);
  }
  for (const [, js] of sig) if (js.length > 1 && total(js[0]) > 0) {
    const ids = js.map(j => j.id).sort();
    if (out.some(f => f.fingerprint === `DUP_INVOICE:${ids.join(",")}`)) continue;
    out.push({ fingerprint: `DUP_ENTRY:${ids.join(",")}`, ruleId: "D.DUPLICATE_ENTRY", ruleVersion: 1, category: "duplicate", priority: "medium", confidence: "likely",
      date: js[0].date, amount: total(js[0]), ledger: null, party: party(js[0]), title: `${js.length} identical entries on ${js[0].date}`,
      description: `${js.map(j => j.entry_no).join(", ")} have the same date, amount (${inr(total(js[0]))}) and ledgers.`,
      evidence: js.map(j => ev(j.entry_no, (j.narration ?? "").slice(0, 80), j.id)), suggestedAction: "Check the source (bank line, bill). Reverse the duplicate, or mark false positive if both are real.", journalIds: ids });
  }

  // ── Balances at period end ──
  const bal = new Map<string, number>();
  const last = new Map<string, string>();
  for (const j of inp.journals) if (j.date <= inp.period.to) for (const l of j.lines) {
    bal.set(l.account_id, r2((bal.get(l.account_id) ?? 0) + (+l.dr || 0) - (+l.cr || 0)));
    if ((last.get(l.account_id) ?? "") < j.date) last.set(l.account_id, j.date);
  }
  for (const [id, b] of bal) {
    const a = acc.get(id); if (!a || Math.abs(b) < 1) continue;
    if (isSuspense(a)) out.push({ fingerprint: `SUSPENSE:${id}:${inp.period.to}`, ruleId: "D.SUSPENSE", ruleVersion: 1, category: "balance", priority: "medium", confidence: "definite",
      date: inp.period.to, amount: Math.abs(b), ledger: a.name, party: null, title: `${a.name} has a balance of ${inr(b)}`,
      description: "Suspense and difference ledgers should be cleared by booking each amount to its real head.", evidence: [ev("Balance", `${inr(b)} ${b > 0 ? "Dr" : "Cr"}`), ev("Last entry", last.get(id) ?? "—")],
      suggestedAction: "Open the ledger, find what each amount was, and move it with a journal.", journalIds: [] });
    else if ((isCash(a) || isBank(a)) && b < 0 && isCash(a)) out.push({ fingerprint: `NEG_CASH:${id}:${inp.period.to}`, ruleId: "D.NEGATIVE_CASH", ruleVersion: 1, category: "balance", priority: "high", confidence: "definite",
      date: inp.period.to, amount: Math.abs(b), ledger: a.name, party: null, title: `${a.name} is negative (${inr(b)} Cr)`,
      description: "Cash in hand can't be below zero: a receipt is missing or a payment was booked to cash instead of bank.", evidence: [ev("Balance", `${inr(b)} Cr`)],
      suggestedAction: "Find the missing cash receipt or the payment that went through the bank.", journalIds: [] });
    else if (["asset", "expense"].includes(a.type) && !isDebtor(a) && !isBank(a) && !isGst(a) && b < 0) out.push({ fingerprint: `NEG_BAL:${id}:${inp.period.to}`, ruleId: "D.NEGATIVE_BALANCE", ruleVersion: 1, category: "balance", priority: "medium", confidence: "likely",
      date: inp.period.to, amount: Math.abs(b), ledger: a.name, party: null, title: `${a.name} has a credit balance`,
      description: `An ${a.type} ledger normally has a debit balance; it shows ${inr(b)} Cr.`, evidence: [ev("Balance", `${inr(b)} Cr`)],
      suggestedAction: "Check for a refund, sale of the asset, or an entry posted the wrong way round.", journalIds: [] });
    else if (isBank(a) && b < 0 && !/\b(od|overdraft|cc|cash credit)\b/i.test(a.name)) out.push({ fingerprint: `NEG_BANK:${id}:${inp.period.to}`, ruleId: "D.NEGATIVE_BANK", ruleVersion: 1, category: "balance", priority: "medium", confidence: "likely",
      date: inp.period.to, amount: Math.abs(b), ledger: a.name, party: null, title: `${a.name} shows an overdrawn balance`,
      description: "The bank ledger is in credit. Unless this is an overdraft or cash-credit account, a receipt is probably missing.", evidence: [ev("Balance", `${inr(b)} Cr`)],
      suggestedAction: "Compare with the bank statement balance for the same date.", journalIds: [] });
    // Advances: a customer in credit, a supplier in debit, with no movement for 60 days
    const quiet = daysBetween(last.get(id) ?? inp.period.to, inp.today) >= 60;
    if (quiet && ((isDebtor(a) && b < 0) || (isCreditor(a) && b > 0))) out.push({ fingerprint: `ADVANCE:${id}`, ruleId: "D.UNADJUSTED_ADVANCE", ruleVersion: 1, category: "advance", priority: "low", confidence: "likely",
      date: last.get(id) ?? null, amount: Math.abs(b), ledger: a.name, party: a.name, title: `Unadjusted ${isDebtor(a) ? "advance from customer" : "advance to supplier"} — ${a.name}`,
      description: `${inr(b)} has sat ${isDebtor(a) ? "in credit" : "in debit"} since ${last.get(id)}. It may be an advance never matched to an invoice${isDebtor(a) ? " (GST may be due on advances for services)" : ", or a bill not yet booked"}.`,
      evidence: [ev("Balance", `${inr(b)} ${b > 0 ? "Dr" : "Cr"}`), ev("Last movement", last.get(id) ?? "—")], suggestedAction: isDebtor(a) ? "Raise or match the invoice, or refund the advance." : "Ask the supplier for the bill, or record the refund.", journalIds: [], needsDocument: isCreditor(a) });
  }

  // ── Ageing: open party balances, first-in-first-out ──
  for (const a of inp.accounts.filter(a => isDebtor(a) || isCreditor(a))) {
    const sign = isDebtor(a) ? 1 : -1;
    const open: { date: string; amt: number }[] = [];
    for (const j of inp.journals.filter(j => j.date <= inp.period.to).sort((x, y) => x.date.localeCompare(y.date))) for (const l of j.lines.filter(l => l.account_id === a.id)) {
      let m = sign * ((+l.dr || 0) - (+l.cr || 0));
      if (m > 0) open.push({ date: j.date, amt: m });
      else while (m < 0 && open.length) { const t = Math.min(open[0].amt, -m); open[0].amt -= t; m += t; if (open[0].amt < 0.01) open.shift(); }
    }
    const old = open.filter(o => daysBetween(o.date, inp.today) > 180);
    const amt = r2(old.reduce((s, o) => s + o.amt, 0));
    if (amt >= 1) out.push({ fingerprint: `AGEING:${a.id}`, ruleId: "D.OLD_OUTSTANDING", ruleVersion: 1, category: "ageing", priority: amt >= 100000 ? "medium" : "low", confidence: "definite",
      date: old[0].date, amount: amt, ledger: a.name, party: a.name, title: `${inr(amt)} ${isDebtor(a) ? "receivable" : "payable"} older than 180 days — ${a.name}`,
      description: `Oldest open item from ${old[0].date}. ${isDebtor(a) ? "Follow up, or consider a provision for doubtful debts." : "Confirm the balance with the supplier; MSME suppliers have a 45-day limit (s.43B(h))."}`,
      evidence: old.slice(0, 5).map(o => ev(o.date, inr(o.amt))), suggestedAction: isDebtor(a) ? "Send a statement and reminder to the customer." : "Get a balance confirmation from the supplier.", journalIds: [] });
  }

  // ── Unusual amounts: far above the ledger's own history ──
  const hist = new Map<string, number[]>();
  for (const j of inp.journals) for (const l of j.lines) { const a = acc.get(l.account_id); if (a?.type === "expense" && +l.dr > 0) (hist.get(a.id) ?? hist.set(a.id, []).get(a.id)!).push(+l.dr); }
  for (const j of live) for (const l of j.lines) {
    const a = acc.get(l.account_id); const xs = a ? hist.get(a.id) : undefined;
    if (!a || !xs || xs.length < 8 || !(+l.dr > 10000)) continue;
    const rest = xs.filter(x => x !== +l.dr); if (rest.length < 7) continue;
    const mean = rest.reduce((s, x) => s + x, 0) / rest.length;
    const sd = Math.sqrt(rest.reduce((s, x) => s + (x - mean) ** 2, 0) / rest.length);
    if (+l.dr > mean + 4 * Math.max(sd, mean * 0.25) && +l.dr > mean * 3) out.push({ fingerprint: `UNUSUAL:${j.id}:${a.id}`, ruleId: "D.UNUSUAL_AMOUNT", ruleVersion: 1, category: "unusual", priority: "low", confidence: "likely",
      date: j.date, amount: +l.dr, ledger: a.name, party: party(j), title: `${inr(+l.dr)} to ${a.name} is far above its usual`,
      description: `${a.name} usually takes about ${inr(mean)} per entry (${rest.length} earlier entries). This one is ${(+l.dr / mean).toFixed(1)}× that. It may be right — or a wrong head, an extra zero, or a capital item.`,
      evidence: [ev("Entry", j.entry_no, j.id), ev("Usual", inr(mean)), ev("This entry", inr(+l.dr))], suggestedAction: "Check the bill. If it's capital (an asset), reclassify with a correction.", journalIds: [j.id] });
  }

  // ── Period: future-dated entries ──
  for (const j of yr.filter(j => j.date > inp.today)) out.push({ fingerprint: `FUTURE:${j.id}`, ruleId: "D.FUTURE_DATED", ruleVersion: 1, category: "period", priority: "medium", confidence: "definite",
    date: j.date, amount: total(j), ledger: null, party: party(j), title: `${j.entry_no} is dated in the future (${j.date})`, description: "Entries after today usually have a wrong date (e.g. year typed wrong, or day and month swapped).",
    evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: "Reverse it and re-post with the right date.", journalIds: [j.id] });

  // ── Bank lines fetched but never booked ──
  for (const f of inp.unbookedFeed ?? []) if (daysBetween(f.date, inp.today) >= 3) out.push({ fingerprint: `FEED:${f.id}`, ruleId: "D.BANK_NOT_BOOKED", ruleVersion: 1, category: "bank", priority: Math.abs(f.amount) >= 50000 ? "high" : "medium", confidence: "definite",
    date: f.date, amount: Math.abs(f.amount), ledger: f.provider, party: f.party, title: `${f.amount < 0 ? "Payment" : "Receipt"} of ${inr(f.amount)} has no accounting entry`,
    description: `${f.description}${f.party ? ` — ${f.party}` : ""}. It came in from ${f.provider} on ${f.date} and hasn't been booked.`, evidence: [ev("Source", f.provider), ev("Narration", f.description.slice(0, 120))],
    suggestedAction: "Book it from Integrations, or ignore it if it isn't a business transaction.", journalIds: [] });

  // ── Bank payments to a supplier who has no bill at all (bill not recorded) ──
  const billParties = new Set(live.filter(j => /purchase|expense|journal/.test(j.type)).flatMap(j => j.lines.filter(l => +l.cr > 0 && isCreditor(acc.get(l.account_id))).map(l => l.account_id)));
  for (const j of live.filter(j => j.lines.some(l => isBank(acc.get(l.account_id)) && +l.cr > 0))) for (const l of j.lines.filter(l => +l.dr > 0 && isCreditor(acc.get(l.account_id)))) {
    if (billParties.has(l.account_id)) continue;
    out.push({ fingerprint: `NOBILL:${j.id}:${l.account_id}`, ruleId: "D.PAYMENT_NO_BILL", ruleVersion: 1, category: "missing_entry", priority: +l.dr >= 50000 ? "high" : "medium", confidence: "likely",
      date: j.date, amount: +l.dr, ledger: name(l.account_id), party: name(l.account_id), title: `Paid ${name(l.account_id)} ${inr(+l.dr)} — no bill from them is booked`,
      description: `The payment ${j.entry_no} reduces what you owe ${name(l.account_id)}, but no purchase or expense bill from them is in the books this year. The supplier invoice may be missing.`,
      evidence: [ev("Payment", `${j.entry_no} · ${j.date}`, j.id)], suggestedAction: "Get the supplier's invoice and book it, or treat the payment as an advance.", journalIds: [j.id], needsDocument: true });
  }

  // ── Purchases and expenses without a supporting document ──
  if (inp.documentedJournalIds) {
    const min = inp.docThreshold ?? 5000;
    for (const j of live) {
      const exp = j.lines.filter(l => +l.dr > 0 && acc.get(l.account_id)?.type === "expense");
      const amt = r2(exp.reduce((s, l) => s + +l.dr, 0));
      if (!(j.type === "purchase" || exp.length) || amt < min || inp.documentedJournalIds.has(j.id)) continue;
      if (/bank charges|interest|depreciation|salary|wages|round ?off/i.test(exp.map(l => name(l.account_id)).join(" "))) continue;
      out.push({ fingerprint: `NODOC:${j.id}`, ruleId: "D.NO_DOCUMENT", ruleVersion: 1, category: "missing_document", priority: amt >= 50000 ? "medium" : "low", confidence: "definite",
        date: j.date, amount: total(j), ledger: exp[0] ? name(exp[0].account_id) : null, party: party(j), title: `${j.entry_no}: no bill attached`,
        description: `${j.type === "purchase" ? "Purchase" : "Expense"} of ${inr(total(j))}${party(j) ? ` to ${party(j)}` : ""} on ${j.date} has no supporting bill or invoice in FreBook.`,
        evidence: [ev("Entry", j.entry_no, j.id), ev("Narration", (j.narration ?? "").slice(0, 100))], suggestedAction: "Upload the bill against this entry.", journalIds: [j.id], needsDocument: true });
    }
  }

  // ── Income tax: cash rules ──
  const cashDay = new Map<string, { amt: number; js: QJournal[]; party: string }>();
  for (const j of live) {
    const cashOut = j.lines.filter(l => isCash(acc.get(l.account_id))).reduce((s, l) => s + (+l.cr || 0), 0);
    const cashIn = j.lines.filter(l => isCash(acc.get(l.account_id))).reduce((s, l) => s + (+l.dr || 0), 0);
    const expDr = j.lines.filter(l => acc.get(l.account_id)?.type === "expense").reduce((s, l) => s + (+l.dr || 0), 0);
    const p = party(j) ?? (j.narration ?? "").slice(0, 40);
    if (cashOut > 0 && expDr > 0) { const k = `${j.date}|${p.toLowerCase()}`; const c = cashDay.get(k) ?? { amt: 0, js: [], party: p }; c.amt += Math.min(cashOut, expDr); c.js.push(j); cashDay.set(k, c); }
    const loanLine = j.lines.find(l => isLoan(acc.get(l.account_id)));
    const rl = rule("IT.CASH_LOAN", j.date);
    if (rl && loanLine && (cashIn >= rl.thresholds.amount || cashOut >= rl.thresholds.amount)) out.push({ fingerprint: `CASHLOAN:${j.id}`, ruleId: rl.ruleId, ruleVersion: rl.version, category: "income_tax", priority: "high", confidence: "requires_review",
      date: j.date, amount: Math.max(cashIn, cashOut), ledger: name(loanLine.account_id), party: party(j), provision: rl.provision, title: `Loan ${cashIn ? "taken" : "repaid"} in cash — ${inr(Math.max(cashIn, cashOut))}`,
      description: `${rl.conditions}. ${rl.provision}. Exceptions: ${rl.exceptions}.`, evidence: [ev("Entry", j.entry_no, j.id), ev("Limit", inr(rl.thresholds.amount))], suggestedAction: "Confirm how the money moved. If it was by bank, correct the entry; if cash, discuss with your CA.", journalIds: [j.id] });
    const rr = rule("IT.CASH_RECEIPT", j.date);
    if (rr && !loanLine && cashIn >= rr.thresholds.amount && j.lines.some(l => ["income", "revenue"].includes(acc.get(l.account_id)?.type ?? "") || isDebtor(acc.get(l.account_id)))) out.push({ fingerprint: `CASHRCPT:${j.id}`, ruleId: rr.ruleId, ruleVersion: rr.version, category: "income_tax", priority: "high", confidence: "requires_review",
      date: j.date, amount: cashIn, ledger: null, party: party(j), provision: rr.provision, title: `Cash received ${inr(cashIn)} in one go`,
      description: `${rr.conditions}. ${rr.provision}.`, evidence: [ev("Entry", j.entry_no, j.id), ev("Limit", inr(rr.thresholds.amount))], suggestedAction: "Check whether it was really cash and whether an exception applies.", journalIds: [j.id] });
  }
  for (const [, c] of cashDay) {
    const r = rule("IT.CASH_EXPENSE", c.js[0].date);
    const lim = r ? (/transport|freight|lorry|truck/i.test(c.js.map(j => j.lines.map(l => name(l.account_id)).join(" ")).join(" ")) ? r.thresholds.transporter_single_day : r.thresholds.single_day) : 0;
    if (r && c.amt > lim) out.push({ fingerprint: `CASHEXP:${c.js.map(j => j.id).sort().join(",")}`, ruleId: r.ruleId, ruleVersion: r.version, category: "income_tax", priority: "medium", confidence: "requires_review",
      date: c.js[0].date, amount: r2(c.amt), ledger: null, party: c.party, provision: r.provision, title: `Cash expense ${inr(c.amt)} to ${c.party || "one payee"} in a day`,
      description: `Above the ${inr(lim)} limit. ${r.provision}. The expense may be disallowed unless an exception applies (${r.exceptions}).`,
      evidence: c.js.map(j => ev(j.entry_no, inr(total(j)), j.id)), suggestedAction: "Pay such amounts by bank in future; check whether an exception covers this one.", journalIds: c.js.map(j => j.id) });
  }

  // ── TDS: payments on heads where TDS may apply, with no TDS ledger used for that party ──
  const tdsRules = inp.rules.filter(r => r.area === "tds" && r.keywords).map(r => r.ruleId).filter((v, i, a) => a.indexOf(v) === i);
  const tdsByHead = new Map<string, { amt: number; maxSingle: number; js: QJournal[]; tds: boolean }>();
  for (const j of live) for (const l of j.lines.filter(l => +l.dr > 0 && acc.get(l.account_id)?.type === "expense")) {
    const k = `${l.account_id}|${(party(j) ?? "").toLowerCase()}`;
    const t = tdsByHead.get(k) ?? { amt: 0, maxSingle: 0, js: [], tds: false };
    t.amt += +l.dr; t.maxSingle = Math.max(t.maxSingle, +l.dr); t.js.push(j); t.tds ||= j.lines.some(x => isTdsPayable(acc.get(x.account_id)));
    tdsByHead.set(k, t);
  }
  for (const [k, t] of tdsByHead) {
    if (t.tds) continue;
    const head = name(k.split("|")[0]);
    for (const id of tdsRules) {
      const r = rule(id, t.js[t.js.length - 1].date); if (!r?.keywords || !new RegExp(r.keywords, "i").test(head)) continue;
      const th = r.thresholds;
      const months = new Set(t.js.map(j => j.date.slice(0, 7))).size || 1;
      const over = (th.yearly && t.amt > th.yearly) || (th.single && t.maxSingle > th.single) || (th.monthly && t.amt / months > th.monthly);
      if (!over) continue;
      out.push({ fingerprint: `TDS:${r.ruleId}:${k}:${inp.period.from}`, ruleId: r.ruleId, ruleVersion: r.version, category: "tds", priority: "medium", confidence: "requires_review",
        date: t.js[t.js.length - 1].date, amount: r2(t.amt), ledger: head, party: k.split("|")[1] || null, provision: r.provision, title: `${r.title} — ${head}${k.split("|")[1] ? ` (${party(t.js[0])})` : ""}`,
        description: `${inr(t.amt)} this year${th.single ? `, largest single ${inr(t.maxSingle)}` : ""}; no TDS was booked. ${r.conditions}. Rates: ${Object.entries(r.rates ?? {}).map(([n, v]) => `${n.replace(/_/g, " ")} ${v}%`).join(", ")}. Whether it applies depends on the payee and the nature of payment.`,
        evidence: t.js.slice(0, 6).map(j => ev(j.entry_no, `${j.date} · ${inr(total(j))}`, j.id)), suggestedAction: "Confirm the payee's status and the nature of the payment; if TDS applies, deduct and deposit it with interest.", journalIds: t.js.map(j => j.id) });
      break;
    }
  }

  // ── GST ──
  const registered = !!inp.businessGstin;
  const gstinOf = new Map((inp.parties ?? []).map(p => [p.name.trim().toLowerCase(), p.gstin]));
  const bizState = inp.businessGstin?.slice(0, 2);
  for (const j of live) {
    const hasGst = j.lines.some(l => isGst(acc.get(l.account_id)));
    const p = party(j);
    const rm = rule("GST.MISSING_TAX", j.date);
    if (registered && rm && /^(sales|purchase)$/.test(j.type) && !hasGst && total(j) >= 1000) out.push({ fingerprint: `GSTNONE:${j.id}`, ruleId: rm.ruleId, ruleVersion: rm.version, category: "gst", priority: "medium", confidence: "requires_review",
      date: j.date, amount: total(j), ledger: null, party: p, provision: rm.provision, title: `${j.type === "sales" ? "Sale" : "Purchase"} ${j.entry_no} has no GST`,
      description: `${rm.conditions}. Fine if the supply is exempt, nil-rated or ${j.type === "purchase" ? "from an unregistered supplier" : "non-GST"}.`, evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: "Check the invoice for GST and correct the entry if tax was charged.", journalIds: [j.id] });
    const gstin = p ? gstinOf.get(p.trim().toLowerCase()) : undefined;
    const rg = rule("GST.MISSING_GSTIN", j.date);
    if (rg && inp.parties && p && j.lines.some(l => isInputGst(acc.get(l.account_id)) && +l.dr > 0) && gstinOf.has(p.trim().toLowerCase()) && !gstin) out.push({ fingerprint: `NOGSTIN:${j.id}`, ruleId: rg.ruleId, ruleVersion: rg.version, category: "gst", priority: "medium", confidence: "likely",
      date: j.date, amount: total(j), ledger: null, party: p, provision: rg.provision, title: `Input GST from ${p}, who has no GSTIN in FreBook`,
      description: `${rg.conditions}. Without a valid GSTIN on the invoice, input tax credit isn't available.`, evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: `Add ${p}'s GSTIN from the invoice, or reverse the credit.`, journalIds: [j.id], needsDocument: true });
    const rp = rule("GST.PLACE_OF_SUPPLY", j.date);
    if (rp && bizState && gstin && hasGst) {
      const igst = j.lines.some(l => /igst/i.test(name(l.account_id)) && (+l.dr || +l.cr));
      const local = j.lines.some(l => /\b(cgst|sgst|utgst)\b/i.test(name(l.account_id)) && (+l.dr || +l.cr));
      const same = gstin.slice(0, 2) === bizState;
      if ((same && igst) || (!same && local)) out.push({ fingerprint: `POS:${j.id}`, ruleId: rp.ruleId, ruleVersion: rp.version, category: "gst", priority: "medium", confidence: "requires_review",
        date: j.date, amount: total(j), ledger: null, party: p, provision: rp.provision, title: `${same ? "IGST on a same-state" : "CGST/SGST on an other-state"} party — ${j.entry_no}`,
        description: `${p} is registered in state ${gstin.slice(0, 2)}; the business is in ${bizState}. ${rp.exceptions}.`, evidence: [ev("Entry", j.entry_no, j.id), ev("Party GSTIN", gstin)], suggestedAction: "Check the place of supply on the invoice; tax paid under the wrong head has to be paid again under the right one and refunded.", journalIds: [j.id] });
    }
    const rb = rule("GST.BLOCKED_ITC", j.date);
    if (rb?.keywords && j.lines.some(l => isInputGst(acc.get(l.account_id)) && +l.dr > 0)) {
      const head = j.lines.filter(l => +l.dr > 0 && acc.get(l.account_id)?.type === "expense").map(l => name(l.account_id)).find(n => new RegExp(rb.keywords!, "i").test(n));
      if (head) out.push({ fingerprint: `BLOCKED:${j.id}`, ruleId: rb.ruleId, ruleVersion: rb.version, category: "gst", priority: "low", confidence: "requires_review",
        date: j.date, amount: total(j), ledger: head, party: p, provision: rb.provision, title: `Input GST taken on ${head}`, description: `${rb.conditions}. Exceptions: ${rb.exceptions}.`,
        evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: "If the credit is blocked, add the GST to the expense with a correction.", journalIds: [j.id] });
    }
    const rr = rule("GST.RCM", j.date);
    if (registered && rr?.keywords && !/rcm|reverse/i.test(j.lines.map(l => name(l.account_id)).join(" ") + (j.narration ?? ""))) {
      const head = j.lines.filter(l => +l.dr > 0 && acc.get(l.account_id)?.type === "expense").map(l => name(l.account_id)).find(n => new RegExp(rr.keywords!, "i").test(n));
      if (head && total(j) >= 1000) out.push({ fingerprint: `RCM:${j.id}`, ruleId: rr.ruleId, ruleVersion: rr.version, category: "gst", priority: "low", confidence: "requires_review",
        date: j.date, amount: total(j), ledger: head, party: p, provision: rr.provision, title: `${head} may be under reverse charge`, description: `${rr.conditions}. ${rr.exceptions}.`,
        evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: "Check the supplier type. If RCM applies, book output tax and the matching input credit.", journalIds: [j.id] });
    }
    const re = rule("GST.EWAY", j.date);
    if (re && j.type === "sales" && total(j) > re.thresholds.consignment && !/service|consult|fee|rent|commission/i.test(j.lines.map(l => name(l.account_id)).join(" ") + (j.narration ?? ""))) out.push({ fingerprint: `EWAY:${j.id}`, ruleId: re.ruleId, ruleVersion: re.version, category: "gst", priority: "low", confidence: "requires_review",
      date: j.date, amount: total(j), ledger: null, party: p, provision: re.provision, title: `Sale ${j.entry_no} above ${inr(re.thresholds.consignment)} — e-way bill?`, description: `${re.conditions}. ${re.exceptions}.`,
      evidence: [ev("Entry", j.entry_no, j.id)], suggestedAction: "Confirm an e-way bill was made if goods moved.", journalIds: [j.id] });
  }
  // Output GST against sales, month by month
  const ro = rule("GST.OUTPUT_RATIO", inp.period.to);
  if (ro && registered) {
    const m = new Map<string, { sales: number; out: number }>();
    for (const j of live) { const k = j.date.slice(0, 7); const x = m.get(k) ?? { sales: 0, out: 0 };
      for (const l of j.lines) { const a = acc.get(l.account_id); if (["income", "revenue"].includes(a?.type ?? "") && /sale|revenue/i.test(a!.name)) x.sales += (+l.cr || 0) - (+l.dr || 0); if (isOutputGst(a)) x.out += (+l.cr || 0) - (+l.dr || 0); }
      m.set(k, x); }
    for (const [k, x] of m) {
      const pct = x.sales > 0 ? (x.out / x.sales) * 100 : 0;
      if ((x.sales > 100000 && x.out < 1) || pct > ro.thresholds.max_rate_pct + 0.5) out.push({ fingerprint: `OUTRATIO:${k}`, ruleId: ro.ruleId, ruleVersion: ro.version, category: "gst", priority: "medium", confidence: "requires_review",
        date: `${k}-01`, amount: r2(x.out), ledger: "Output GST", party: null, provision: ro.provision, title: `${k}: output GST is ${pct.toFixed(1)}% of sales`,
        description: `Sales ${inr(x.sales)}, output GST ${inr(x.out)}. ${x.out < 1 ? "Large sales with no output tax" : "More than the highest GST rate"} — check for sales booked without tax or tax booked without sales.`,
        evidence: [ev("Sales", inr(x.sales)), ev("Output GST", inr(x.out))], suggestedAction: "Compare the month's sales register with GSTR-1.", journalIds: [] });
    }
    const rei = rule("GST.EINVOICE", inp.period.to);
    const sales = [...m.values()].reduce((s, x) => s + x.sales, 0);
    if (rei && sales > rei.thresholds.turnover) out.push({ fingerprint: `EINV:${inp.period.from}`, ruleId: rei.ruleId, ruleVersion: rei.version, category: "gst", priority: "medium", confidence: "requires_review",
      date: inp.period.to, amount: r2(sales), ledger: null, party: null, provision: rei.provision, title: `Sales this year (${inr(sales)}) are above the e-invoicing limit`,
      description: `${rei.conditions}. ${rei.exceptions}.`, evidence: [ev("Sales in books", inr(sales)), ev("Limit", inr(rei.thresholds.turnover))], suggestedAction: "Make sure B2B invoices get an IRN (FreBook → E-invoice).", journalIds: [] });
  }

  // ── Classification: a capital-looking amount on an expense head, or expense words on an asset ──
  for (const j of live) for (const l of j.lines.filter(l => +l.dr > 0)) {
    const a = acc.get(l.account_id); if (!a) continue;
    const text = `${j.narration ?? ""}`;
    if (a.type === "asset" && /machin|plant|equipment|furniture|computer|vehicle/i.test(a.name) && /\b(stationery|tea|snacks|repairs?|maintenance|rent|electricity|courier|fuel|petrol)\b/i.test(text)) out.push({ fingerprint: `CLASS:${j.id}:${a.id}`, ruleId: "D.CLASSIFICATION", ruleVersion: 1, category: "classification", priority: "medium", confidence: "likely",
      date: j.date, amount: +l.dr, ledger: a.name, party: party(j), title: `${a.name} debited for what reads like an expense`,
      description: `The narration ("${text.slice(0, 90)}") describes a running expense, but the amount went to the asset ${a.name}. Assets are depreciated; expenses are deducted in the year.`,
      evidence: [ev("Entry", j.entry_no, j.id), ev("Narration", text.slice(0, 120))], suggestedAction: "Propose a correction moving it to the right expense head.", journalIds: [j.id] });
  }

  return out;
}

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
