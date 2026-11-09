import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, type DAccount } from "../../src/lib/assurance/detective";
import { BUILTIN_TAX_RULES, ruleOn, mergeRules, type TaxRule } from "../../src/lib/assurance/taxRules";
import { planSync } from "../../src/lib/assurance/workflow";
import { reconInputs, suggestMatches, validateAllocation } from "../../src/lib/assurance/bankRecon";
import { requestFor, validateDocument, followUpDraft } from "../../src/lib/assurance/docRequests";
import { buildReclass, validateCorrection } from "../../src/lib/assurance/correction";
import type { QJournal } from "../../src/lib/bookQueries";

const A = (id: string, name: string, type: string, sub_type: string | null = null): DAccount => ({ id, name, type, sub_type });
const accounts = [
  A("bank", "HDFC Bank", "asset", "bank"), A("cash", "Cash in Hand", "asset", "cash"), A("susp", "Suspense", "liability"),
  A("abc", "ABC Traders", "liability", "trade_payables"), A("cust", "Ravi Stores", "asset", "trade_receivables"),
  A("rent", "Rent", "expense"), A("off", "Office Expenses", "expense"), A("mach", "Machinery", "asset"), A("sales", "Sales", "income"),
  A("pur", "Purchases", "expense"), A("igst", "Input IGST", "asset"), A("loan", "Loan from Ramesh", "liability"), A("prof", "Professional Fees", "expense"),
];
let n = 0;
const J = (date: string, type: string, lines: [string, number, number][], extra: Partial<QJournal> = {}): QJournal =>
  ({ id: `j${++n}`, entry_no: `JV-${n}`, date, type, narration: "", party_name: null, reference_no: null, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })), ...extra });
const period = { from: "2026-04-01", to: "2027-03-31" };
const base = { accounts, period, rules: BUILTIN_TAX_RULES, today: "2026-11-09" };
const ids = (fs: { ruleId: string }[]) => fs.map(f => f.ruleId);

test("unbalanced entry is a definite, high-priority finding", () => {
  const f = detect({ ...base, journals: [J("2026-05-01", "journal", [["rent", 1000, 0], ["bank", 0, 900]])] });
  const u = f.find(x => x.ruleId === "D.UNBALANCED")!;
  assert.equal(u.confidence, "definite"); assert.equal(u.priority, "high"); assert.equal(u.amount, 100);
});

test("same supplier invoice number booked twice is flagged once, with both entries", () => {
  const a = J("2026-06-01", "purchase", [["pur", 5000, 0], ["abc", 0, 5000]], { reference_no: "B-77", party_name: "ABC Traders" });
  const b = J("2026-06-09", "purchase", [["pur", 5000, 0], ["abc", 0, 5000]], { reference_no: "b-77 ", party_name: "ABC Traders" });
  const f = detect({ ...base, journals: [a, b] }).filter(x => x.category === "duplicate");
  assert.equal(f.length, 1); assert.equal(f[0].ruleId, "D.DUPLICATE_INVOICE"); assert.deepEqual(f[0].journalIds.sort(), [a.id, b.id].sort());
});

test("a reversed entry and its reversal are not duplicates", () => {
  const a = J("2026-06-01", "journal", [["rent", 5000, 0], ["bank", 0, 5000]]);
  const r = J("2026-06-01", "journal", [["bank", 5000, 0], ["rent", 0, 5000]], { narration: `Reversal of ${a.entry_no}` });
  assert.ok(!ids(detect({ ...base, journals: [a, r] })).includes("D.DUPLICATE_ENTRY"));
});

test("suspense balance and negative cash", () => {
  const f = detect({ ...base, journals: [J("2026-05-02", "journal", [["susp", 0, 700], ["bank", 700, 0]]), J("2026-05-03", "payment", [["off", 300, 0], ["cash", 0, 300]])] });
  assert.ok(ids(f).includes("D.SUSPENSE")); assert.ok(ids(f).includes("D.NEGATIVE_CASH"));
});

test("bank payment to a supplier with no bill booked asks for the invoice", () => {
  const f = detect({ ...base, journals: [J("2026-11-05", "payment", [["abc", 25000, 0], ["bank", 0, 25000]])] });
  const m = f.find(x => x.ruleId === "D.PAYMENT_NO_BILL")!;
  assert.ok(m.needsDocument);
  assert.equal(requestFor(m)!.message, "Payment of ₹25,000 to ABC Traders on 5 November 2026 has no linked invoice. Please upload the supporting purchase invoice.");
});

test("expense without a document is found only when not documented", () => {
  const j = J("2026-07-01", "payment", [["off", 8000, 0], ["bank", 0, 8000]]);
  assert.ok(ids(detect({ ...base, journals: [j], documentedJournalIds: new Set() })).includes("D.NO_DOCUMENT"));
  assert.ok(!ids(detect({ ...base, journals: [j], documentedJournalIds: new Set([j.id]) })).includes("D.NO_DOCUMENT"));
});

test("cash rules use the registry limits and are 'requires review'", () => {
  const f = detect({ ...base, journals: [J("2026-08-01", "payment", [["off", 12000, 0], ["cash", 0, 12000]]), J("2026-08-02", "receipt", [["cash", 25000, 0], ["loan", 0, 25000]]), J("2026-07-01", "receipt", [["cash", 200000, 0], ["bank", 0, 0], ["sales", 0, 200000]])] });
  for (const r of ["IT.CASH_EXPENSE", "IT.CASH_LOAN", "IT.CASH_RECEIPT"]) { const x = f.find(y => y.ruleId === r); assert.ok(x, r); assert.equal(x!.confidence, "requires_review"); }
  // A higher limit in a newer version stops the cash-expense finding
  const raised: TaxRule = { ...BUILTIN_TAX_RULES.find(r => r.ruleId === "IT.CASH_EXPENSE")!, version: 2, thresholds: { single_day: 15000, transporter_single_day: 35000 } };
  assert.ok(!ids(detect({ ...base, rules: mergeRules([raised]), journals: [J("2026-08-01", "payment", [["off", 12000, 0], ["cash", 0, 12000]])] })).includes("IT.CASH_EXPENSE"));
});

test("TDS: professional fees over the yearly limit with no TDS ledger", () => {
  const js = [J("2026-05-01", "payment", [["prof", 30000, 0], ["bank", 0, 30000]], { party_name: "K & Co" }), J("2026-09-01", "payment", [["prof", 30000, 0], ["bank", 0, 30000]], { party_name: "K & Co" })];
  const t = detect({ ...base, journals: js }).find(x => x.category === "tds")!;
  assert.equal(t.ruleId, "TDS.PROFESSIONAL"); assert.equal(t.amount, 60000); assert.equal(t.confidence, "requires_review");
});

test("ruleOn picks the version in force on the date, business override first", () => {
  const v2: TaxRule = { ...BUILTIN_TAX_RULES[0], version: 2, effectiveFrom: "2027-04-01" };
  const own: TaxRule = { ...BUILTIN_TAX_RULES[0], version: 3, businessId: "b1" };
  const rules = mergeRules([v2, own]);
  assert.equal(ruleOn(rules, "IT.CASH_EXPENSE", "2026-06-01")!.version, 1);
  assert.equal(ruleOn(rules, "IT.CASH_EXPENSE", "2027-06-01")!.version, 2);
  assert.equal(ruleOn(rules, "IT.CASH_EXPENSE", "2026-06-01", "b1")!.version, 3);
});

test("planSync is idempotent and respects closed decisions", () => {
  const f = detect({ ...base, journals: [J("2026-05-01", "journal", [["rent", 1000, 0], ["bank", 0, 900]])] });
  const p1 = planSync([], f); assert.equal(p1.insert.length, f.length);
  const stored = f.map((x, i) => ({ id: `e${i}`, fingerprint: x.fingerprint, status: "detected" as const, rule_id: x.ruleId, confidence: x.confidence }));
  const p2 = planSync(stored, f); assert.equal(p2.insert.length, 0); assert.equal(p2.refresh.length, f.length);
  const fp = planSync(stored.map(s => ({ ...s, status: "false_positive" as const })), f); assert.equal(fp.insert.length + fp.refresh.length + fp.reopen.length, 0);
  const gone = planSync(stored, []); assert.deepEqual(gone.autoResolve, stored.filter(s => s.confidence === "definite").map(s => s.id));
});

test("bank reconciliation: exact match on amount + party, several invoices, and allocation limits", () => {
  const inv1 = J("2026-06-01", "sales", [["cust", 11800, 0], ["sales", 0, 11800]], { reference_no: "INV-9" });
  const inv2 = J("2026-06-05", "sales", [["cust", 5000, 0], ["sales", 0, 5000]], { reference_no: "INV-10" });
  const rcpt = J("2026-06-07", "receipt", [["bank", 11800, 0], ["cust", 0, 11800]], { narration: "NEFT RAVI STORES INV-9" });
  // receipt already pays inv1 in the books, so match a fresh unbooked-to-party receipt instead
  const rcpt2 = J("2026-06-20", "receipt", [["bank", 5000, 0], ["sales", 0, 5000]], { narration: "UPI RAVI STORES" });
  const { lines, open } = reconInputs(accounts, [inv1, inv2, rcpt, rcpt2], new Set());
  assert.equal(open.length, 1); assert.equal(open[0].journalId, inv2.id);
  const s = suggestMatches(lines, open).find(x => x.line.journalId === rcpt2.id)!;
  assert.ok(["probable", "exact"].includes(s.cls)); assert.equal(s.candidates[0].items[0].journalId, inv2.id);
  assert.match(validateAllocation(5000, [{ allocate: 3000 }, { allocate: 2500 }])!, /more than the bank amount/);
  assert.equal(validateAllocation(5000, [{ allocate: 3000 }, { allocate: 2000 }]), null);
});

test("document validation closes a request only when amount, date and supplier agree", () => {
  const req = { amount: 25000, date: "2026-11-05", party: "ABC Traders", docKind: "purchase_invoice" as const };
  assert.ok(validateDocument(req, { amount: 25000, date: "2026-11-03", party: "M/s ABC Traders Pvt Ltd" }).ok);
  const bad = validateDocument(req, { amount: 2500, date: "2026-11-03", party: "XYZ" });
  assert.ok(!bad.ok); assert.deepEqual(bad.checks.filter(c => !c.ok).map(c => c.label), ["Amount", "Supplier"]);
  const draft = followUpDraft("Sai Ignite", [{ journalId: null, party: "ABC", date: null, amount: 1, docKind: "bill", message: "Need bill 1", status: "open" }, { journalId: null, party: "ABC", date: null, amount: 1, docKind: "bill", message: "Got it", status: "fulfilled" }], "whatsapp")!;
  assert.match(draft.body, /Need bill 1/); assert.doesNotMatch(draft.body, /Got it/);
});

test("correction moves the amount with a balanced new journal and never edits the original", () => {
  const j = J("2026-10-01", "payment", [["mach", 25000, 0], ["bank", 0, 25000]], { narration: "office stationery and courier" });
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const c = buildReclass(j, names, "mach", "off", "Office expense booked to machinery");
  assert.deepEqual(c.lines.map(l => [l.accountId, l.dr, l.cr]), [["off", 25000, 0], ["mach", 0, 25000]]);
  assert.equal(validateCorrection(c.lines), null);
  assert.match(c.taxNote, /depreciation/);
  assert.throws(() => buildReclass(j, names, "mach", "off", "x", 30000));
  assert.match(validateCorrection([{ accountId: "a", account: "a", dr: 10, cr: 0 }, { accountId: "b", account: "b", dr: 0, cr: 9 }])!, /don't agree/);
  assert.ok(ids(detect({ ...base, journals: [j] })).includes("D.CLASSIFICATION"));
});
