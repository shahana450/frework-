import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCashBankGrid, parseSimpleGrid, CASHBANK_HEADERS, voucherOf } from "../../src/lib/simpleTemplate";

test("receipts & payments template: receipt debits cash/bank, payment credits it", () => {
  const e = parseCashBankGrid([CASHBANK_HEADERS,
    ["05-04-2026", "Receipt", "HDFC Bank", "Asha Traders", 50000, "Against INV-101"],
    ["06-04-2026", "Payment", "Cash", "Rent", "25,000", ""],
  ])!;
  assert.equal(e.length, 2);
  assert.deepEqual(e[0].lines, [{ ledger: "HDFC Bank", debit: 50000, credit: 0 }, { ledger: "Asha Traders", debit: 0, credit: 50000 }]);
  assert.equal(voucherOf(e[0].lines), "receipt");
  assert.deepEqual(e[1].lines, [{ ledger: "Rent", debit: 25000, credit: 0 }, { ledger: "Cash", debit: 0, credit: 25000 }]);
  assert.equal(voucherOf(e[1].lines), "payment");
  assert.equal(e[1].narration, "Paid to Rent");
  assert.equal(e[0].date, "2026-04-05");
});

test("receipts & payments template: bad rows carry a reason and no lines", () => {
  const e = parseCashBankGrid([CASHBANK_HEADERS,
    ["05-04-2026", "Transfer", "Cash", "Rent", 100, ""],
    ["xx", "Payment", "Cash", "Rent", 100, ""],
    ["05-04-2026", "Payment", "", "Rent", 100, ""],
    ["", "", "", "", "", ""],
  ])!;
  assert.equal(e.length, 3);
  assert.ok(e.every(x => x.error && x.lines.length === 0));
});

test("the journal template is not mistaken for receipts & payments, and vice versa", () => {
  assert.equal(parseCashBankGrid([["Date", "Particulars", "Debit", "Credit", "Narration"]]), null);
  assert.equal(parseSimpleGrid([CASHBANK_HEADERS]), null);
});
