import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, computeGst, questionFor, ACTIONS, type Intent } from "../../src/lib/accountingRules";
import { validateEntry } from "../../src/lib/posting";

const base = (o: Partial<Intent>): Intent => ({ action: "expense_payment", amount: 0, payment_mode: "bank", payment_account: "HDFC Bank", counter_account: null, party_name: null, ...o });
const pick = (r: ReturnType<typeof buildEntry>) => r.lines.map(l => [l.account, l.debit, l.credit]);
const balanced = (r: ReturnType<typeof buildEntry>) => {
  const dr = r.lines.reduce((s, l) => s + l.debit, 0), cr = r.lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(dr - cr) < 0.005;
};

test("rent paid from bank: Dr Office Rent / Cr HDFC Bank", () => {
  const r = buildEntry(base({ amount: 25000, counter_account: "Office Rent" }));
  assert.deepEqual(pick(r), [["Office Rent", 25000, 0], ["HDFC Bank", 0, 25000]]);
  assert.deepEqual(r.missing, []);
});

test("GST-inclusive purchase on credit splits CGST/SGST and credits creditors", () => {
  const r = buildEntry(base({ action: "purchase", amount: 118000, payment_mode: "credit", payment_account: null, party_name: "ABC Traders", gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }));
  assert.deepEqual(pick(r), [["Purchases", 100000, 0], ["Input CGST", 9000, 0], ["Input SGST", 9000, 0], ["Creditors Control", 0, 118000]]);
  assert.equal(r.gst.taxable_value, 100000);
});

test("GST-exclusive inter-state sale uses IGST on top", () => {
  const r = buildEntry(base({ action: "sale", amount: 50000, payment_mode: "credit", payment_account: null, gst: { applicable: true, rate: 18, inclusive: false, supply: "inter" } }));
  assert.deepEqual(pick(r), [["Debtors Control", 59000, 0], ["Sales", 0, 50000], ["Output IGST", 0, 9000]]);
});

test("professional fees with TDS 10%: net paid, TDS payable", () => {
  const r = buildEntry(base({ amount: 50000, counter_account: "Professional Fees", tds: { applicable: true, section: "194J", rate: 10 } }));
  assert.deepEqual(pick(r), [["Professional Fees", 50000, 0], ["TDS Payable", 0, 5000], ["HDFC Bank", 0, 45000]]);
  assert.equal(r.tds.net_payment, 45000);
});

test("odd GST amounts still balance to the paisa", () => {
  const g = computeGst(1001, 18, true, "intra");
  assert.equal(Math.round((g.taxable + g.cgst + g.sgst) * 100) / 100, 1001);
  const r = buildEntry(base({ action: "purchase", amount: 1001, gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }));
  assert.ok(balanced(r));
});

test("cash payments default to Cash in Hand", () => {
  const r = buildEntry(base({ amount: 500, counter_account: "Tea & Refreshments", payment_mode: "cash", payment_account: null }));
  assert.deepEqual(pick(r), [["Tea & Refreshments", 500, 0], ["Cash in Hand", 0, 500]]);
});

test("customer receipt, supplier payment, capital, drawings, transfer, loans", () => {
  const cases: [Partial<Intent>, (string | number)[][]][] = [
    [{ action: "receipt_from_customer", amount: 50000 }, [["HDFC Bank", 50000, 0], ["Debtors Control", 0, 50000]]],
    [{ action: "payment_to_supplier", amount: 20000 }, [["Creditors Control", 20000, 0], ["HDFC Bank", 0, 20000]]],
    [{ action: "capital_introduced", amount: 100000 }, [["HDFC Bank", 100000, 0], ["Capital Account", 0, 100000]]],
    [{ action: "drawings", amount: 5000 }, [["Drawings", 5000, 0], ["HDFC Bank", 0, 5000]]],
    [{ action: "bank_transfer", amount: 10000, counter_account: "Cash in Hand" }, [["Cash in Hand", 10000, 0], ["HDFC Bank", 0, 10000]]],
    [{ action: "loan_received", amount: 200000, counter_account: "SBI Term Loan" }, [["HDFC Bank", 200000, 0], ["SBI Term Loan", 0, 200000]]],
    [{ action: "gst_payment", amount: 7000 }, [["GST Payable", 7000, 0], ["HDFC Bank", 0, 7000]]],
  ];
  for (const [intent, expected] of cases) assert.deepEqual(pick(buildEntry(base(intent))), expected, intent.action);
});

test("every action produces a balanced, postable entry when facts are complete", () => {
  for (const action of ACTIONS) {
    const r = buildEntry(base({ action, amount: 1180, counter_account: "Some Ledger", manual_lines: [{ account: "Depreciation", debit: 1180, credit: 0 }, { account: "Furniture", debit: 0, credit: 1180 }], gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }));
    assert.deepEqual(r.missing, [], action);
    assert.ok(balanced(r), action);
    assert.doesNotThrow(() => validateEntry(r.lines.map(l => ({ accountId: l.account, dr: l.debit, cr: l.credit })), "2026-09-01"), action);
  }
});

test("missing facts become one plain question instead of a guessed entry", () => {
  const noAmount = buildEntry(base({ counter_account: "Office Rent" }));
  assert.ok(noAmount.missing.includes("amount"));
  const noPayment = buildEntry(base({ amount: 1000, counter_account: "Office Rent", payment_mode: null, payment_account: null }));
  assert.deepEqual(noPayment.missing, ["payment_account"]);
  assert.match(questionFor("payment_account", base({})), /paid/i);
  const noExpense = buildEntry(base({ amount: 1000 }));
  assert.deepEqual(noExpense.missing, ["expense_account"]);
});

test("unbalanced AI adjustment lines are caught by posting validation", () => {
  const r = buildEntry(base({ action: "journal_adjustment", manual_lines: [{ account: "Depreciation", debit: 1000, credit: 0 }, { account: "Furniture", debit: 0, credit: 900 }] }));
  assert.throws(() => validateEntry(r.lines.map(l => ({ accountId: l.account, dr: l.debit, cr: l.credit })), "2026-09-01"));
});

test("TDS as an amount: paid 45,000 from bank after deducting 5,000 → gross 50,000", () => {
  const base = { action: "expense_payment" as const, payment_mode: "bank" as const, payment_account: "HDFC Bank", counter_account: "Commission Expenses", party_name: "Ragesh" };
  const net = buildEntry({ ...base, amount: 45000, tds: { applicable: true, section: null, rate: 0, amount: 5000, amount_is_net: true } });
  assert.deepEqual(net.lines.map(l => [l.account, l.debit, l.credit]), [["Commission Expenses", 50000, 0], ["TDS Payable", 0, 5000], ["HDFC Bank", 0, 45000]]);
  assert.equal(net.tds.rate, 10);
  // Gross stated, TDS amount given
  const gross = buildEntry({ ...base, amount: 50000, tds: { applicable: true, section: null, rate: 0, amount: 5000, amount_is_net: false } });
  assert.deepEqual(gross.lines.map(l => [l.account, l.debit, l.credit]), [["Commission Expenses", 50000, 0], ["TDS Payable", 0, 5000], ["HDFC Bank", 0, 45000]]);
  // Net stated with a rate: 45,000 after 10% → 50,000
  const byRate = buildEntry({ ...base, amount: 45000, tds: { applicable: true, section: null, rate: 10, amount: 0, amount_is_net: true } });
  assert.deepEqual(byRate.lines.map(l => [l.account, l.debit, l.credit]), [["Commission Expenses", 50000, 0], ["TDS Payable", 0, 5000], ["HDFC Bank", 0, 45000]]);
});

test("TDS deducted by the customer becomes TDS Receivable", () => {
  const t = (amount: number, net: boolean) => ({ applicable: true, section: null, rate: 0, amount, amount_is_net: net });
  const rows = (r: ReturnType<typeof buildEntry>) => r.lines.map(l => [l.account, l.debit, l.credit]);
  // Client paid an earlier invoice: 45,000 into bank after TDS 5,000
  assert.deepEqual(rows(buildEntry({ action: "receipt_from_customer", amount: 45000, payment_mode: "bank", payment_account: "HDFC Bank", counter_account: null, party_name: "Acme", tds: t(5000, true) })),
    [["HDFC Bank", 45000, 0], ["TDS Receivable", 5000, 0], ["Debtors Control", 0, 50000]]);
  // New sale received net of TDS
  assert.deepEqual(rows(buildEntry({ action: "sale", amount: 45000, payment_mode: "bank", payment_account: "HDFC Bank", counter_account: "Sales", party_name: "Acme", tds: t(5000, true) })),
    [["TDS Receivable", 5000, 0], ["HDFC Bank", 45000, 0], ["Sales", 0, 50000]]);
  // Bank FD interest credited after 10% TDS
  assert.deepEqual(rows(buildEntry({ action: "interest_income", amount: 9000, payment_mode: "bank", payment_account: "SBI", counter_account: "Interest on FD", party_name: null, tds: { applicable: true, section: null, rate: 10, amount: 0, amount_is_net: true } })),
    [["SBI", 9000, 0], ["TDS Receivable", 1000, 0], ["Interest on FD", 0, 10000]]);
  // Paying a supplier's bill after deducting our TDS
  assert.deepEqual(rows(buildEntry({ action: "payment_to_supplier", amount: 100000, payment_mode: "bank", payment_account: "HDFC Bank", counter_account: null, party_name: "BuildCo", tds: t(2000, false) })),
    [["Creditors Control", 100000, 0], ["TDS Payable", 0, 2000], ["HDFC Bank", 0, 98000]]);
});
