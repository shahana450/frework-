import { test } from "node:test";
import assert from "node:assert/strict";
import { profitLoss, compare, receivables, payables, search, topExpenses, gstSummary, balances, monthPeriod, resolvePeriod, type QJournal } from "../../src/lib/bookQueries";

const accounts = [
  { id: "hdfc", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "cash", name: "Cash in Hand", type: "asset", sub_type: "cash" },
  { id: "sales", name: "Sales", type: "income", sub_type: null },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "elec", name: "Electricity Charges", type: "expense", sub_type: "indirect_expense" },
  { id: "pur", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { id: "deb", name: "Debtors Control", type: "asset", sub_type: "trade_receivables" },
  { id: "cred", name: "Creditors Control", type: "liability", sub_type: "trade_payables" },
  { id: "ocgst", name: "Output CGST", type: "liability", sub_type: "current_liability" },
  { id: "osgst", name: "Output SGST", type: "liability", sub_type: "current_liability" },
  { id: "icgst", name: "Input CGST", type: "asset", sub_type: "current_asset" },
  { id: "isgst", name: "Input SGST", type: "asset", sub_type: "current_asset" },
];
let n = 0;
const J = (date: string, narration: string, party: string | null, lines: [string, number, number][], type = "journal"): QJournal =>
  ({ id: `j${++n}`, date, entry_no: `JV-${n}`, narration, type, party_name: party, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });

const journals: QJournal[] = [
  J("2026-08-05", "Sale to Rahul INV-101", "Rahul", [["deb", 118000, 0], ["sales", 0, 100000], ["ocgst", 0, 9000], ["osgst", 0, 9000]], "sales"),
  J("2026-08-10", "Rent August", null, [["rent", 25000, 0], ["hdfc", 0, 25000]], "payment"),
  J("2026-08-20", "Purchase from ABC Traders", "ABC Traders", [["pur", 40000, 0], ["icgst", 3600, 0], ["isgst", 3600, 0], ["cred", 0, 47200]], "purchase"),
  J("2026-09-03", "Rahul paid part of INV-101", "Rahul", [["hdfc", 50000, 0], ["deb", 0, 50000]], "receipt"),
  J("2026-09-05", "Sale to Meera", "Meera", [["deb", 20000, 0], ["sales", 0, 20000]], "sales"),
  J("2026-09-10", "Rent September", null, [["rent", 25000, 0], ["hdfc", 0, 25000]], "payment"),
  J("2026-09-12", "KSEB electricity", null, [["elec", 3450, 0], ["hdfc", 0, 3450]], "payment"),
  J("2026-09-15", "Capital", null, [["hdfc", 100000, 0], ["cash", 0, 0]], "receipt"),
];
journals[journals.length - 1].lines = [{ account_id: "hdfc", dr: 100000, cr: 0 }, { account_id: "cash", dr: 0, cr: 100000 }];

const sep = monthPeriod("2026-09-20"), aug = monthPeriod("2026-09-20", -1);
const fy = { from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" };

test("month periods resolve correctly", () => {
  assert.deepEqual(sep, { from: "2026-09-01", to: "2026-09-30", label: "Sep 2026" });
  assert.deepEqual(aug, { from: "2026-08-01", to: "2026-08-31", label: "Aug 2026" });
  assert.deepEqual(monthPeriod("2026-01-15", -1), { from: "2025-12-01", to: "2025-12-31", label: "Dec 2025" });
});

test("bad AI date ranges fall back instead of being trusted", () => {
  assert.equal(resolvePeriod({ from: "2026-09-30", to: "2026-09-01" }, fy), fy);
  assert.equal(resolvePeriod({ from: "Sept", to: "Oct" }, fy), fy);
  assert.equal(resolvePeriod(null, fy), fy);
  assert.deepEqual(resolvePeriod({ from: "2026-09-01", to: "2026-09-30", label: "September" }, fy), { from: "2026-09-01", to: "2026-09-30", label: "September" });
});

test("profit for a month comes from that month's entries only", () => {
  const a = profitLoss(accounts, journals, sep);
  const m = Object.fromEntries(a.metrics.map(x => [x.label, x.value]));
  assert.equal(m["Sales"], 20000);
  assert.equal(m["Expenses"], 28450);
  assert.equal(m["Net loss"], -8450);
});

test("comparison explains the change with the accounts that moved", () => {
  const a = compare(accounts, journals, sep, aug);
  const m = Object.fromEntries(a.metrics.map(x => [x.label, x.value]));
  assert.equal(m["Profit Sep 2026"], -8450);
  assert.equal(m["Profit Aug 2026"], 35000);
  assert.equal(m["Change"], -43450);
  assert.match(a.summary, /fell by ₹43,450/);
  assert.match(a.summary, /Sales down ₹80,000/);
  assert.equal(a.table!.rows[0][0], "Sales");
});

test("receivables: total and per customer", () => {
  const a = receivables(accounts, journals, "2026-09-30");
  assert.equal(a.metrics[0].value, 88000);                                   // 118000 - 50000 + 20000
  assert.deepEqual(a.table!.rows.map(r => [r[0], r[1]]), [["Rahul", 68000], ["Meera", 20000]]);
  assert.ok(a.transactions!.every(t => t.id.startsWith("j")));               // every row traces to an entry
});

test("payables: total and per supplier", () => {
  const a = payables(accounts, journals, "2026-09-30");
  assert.equal(a.metrics[0].value, 47200);
  assert.deepEqual(a.table!.rows[0].slice(0, 2), ["ABC Traders", 47200]);
});

test("search filters by amount, kind and party", () => {
  const big = search(accounts, journals, fy, { min_amount: 10000, kind: "expense" });
  assert.deepEqual(big.transactions!.map(t => t.narration).sort(), ["Purchase from ABC Traders", "Rent August", "Rent September"].sort());
  const rahul = search(accounts, journals, fy, { party: "rahul" });
  assert.equal(rahul.transactions!.length, 2);
  const none = search(accounts, journals, sep, { party: "nobody" });
  assert.equal(none.transactions!.length, 0);
  assert.match(none.summary, /^No /);
});

test("top expenses are ranked with their share", () => {
  const a = topExpenses(accounts, journals, fy);
  assert.deepEqual(a.table!.rows.map(r => [r[0], r[1]]), [["Office Rent", 50000], ["Purchases", 40000], ["Electricity Charges", 3450]]);
});

test("GST summary nets output against input credit", () => {
  const a = gstSummary(accounts, journals, aug);
  const m = Object.fromEntries(a.metrics.map(x => [x.label, x.value]));
  assert.equal(m["Output GST"], 18000);
  assert.equal(m["Input credit"], 7200);
  assert.equal(m["Net payable"], 10800);
});

test("cash and bank balances", () => {
  const a = balances(accounts, journals, "2026-09-30");
  // HDFC: −25,000 rent + 50,000 receipt − 25,000 rent − 3,450 power + 1,00,000 from cash = 96,550
  assert.deepEqual(a.table!.rows, [["Cash in Hand", -100000], ["HDFC Bank", 96550]]);
  const one = balances(accounts, journals, "2026-09-30", "hdfc");
  assert.match(one.summary, /HDFC Bank: ₹96,550 Dr/);
});

test("asking about a ledger ('TDS payable for Oct') gives the ledger's figures, not entry totals", () => {
  const accs = [...accounts, { id: "tds", name: "TDS Payable", type: "liability", sub_type: "current_liability" }];
  const js: QJournal[] = [J("2026-10-14", "Paid office rent of 50,000 to Arun from bank with 10% TDS", null, [["rent", 50000, 0], ["tds", 0, 5000], ["hdfc", 0, 45000]], "payment")];
  const oct = monthPeriod("2026-10-20");
  const a = search(accs, js, oct, { text: "TDS" });
  assert.match(a.summary, /TDS Payable: added ₹5,000/);
  assert.match(a.summary, /balance ₹5,000(\.00)? Cr/);
  assert.doesNotMatch(a.summary, /50,000/);
  // plain words that are not a ledger still search narrations
  assert.match(search(accs, js, oct, { text: "arun" }).summary, /1 matching "arun"/);
});
