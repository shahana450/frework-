// Tally push: sales and purchases go in as Sales / Purchase vouchers (accounting mode), with the party marked
import { test } from "node:test";
import assert from "node:assert/strict";
import { voucherXml, type PushLine } from "../../src/lib/integrations/tally";

const acc = (name: string, type: string, sub_type: string | null = null) => ({ name, type, sub_type });
const L = (a: PushLine["account"], dr: number, cr: number): PushLine => ({ account: a, dr, cr });

test("a credit sale is a Sales voucher with the customer as party", () => {
  const x = voucherXml({ entry_no: "INV-1", date: "2026-08-01", narration: "Sale", type: "sales", lines: [
    L(acc("ABC Traders", "asset", "trade_receivables"), 11800, 0), L(acc("Sales", "income", "revenue"), 0, 10000), L(acc("Output CGST", "liability"), 0, 900), L(acc("Output SGST", "liability"), 0, 900)] });
  assert.match(x, /VCHTYPE="Sales"/);
  assert.match(x, /<PARTYLEDGERNAME>ABC Traders<\/PARTYLEDGERNAME>/);
  assert.match(x, /<LEDGERNAME>ABC Traders<\/LEDGERNAME><ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes/);
  assert.match(x, /<LEDGERNAME>Sales<\/LEDGERNAME><ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE><ISPARTYLEDGER>No/);
});

test("a cash purchase is a Purchase voucher with cash as party", () => {
  const x = voucherXml({ entry_no: "PUR-1", date: "2026-08-02", narration: "Bought", type: "purchase", lines: [
    L(acc("Purchases", "expense", "direct_expense"), 1000, 0), L(acc("Cash", "asset", "cash"), 0, 1000)] });
  assert.match(x, /VCHTYPE="Purchase"/);
  assert.match(x, /<PARTYLEDGERNAME>Cash<\/PARTYLEDGERNAME>/);
});

test("a sale with no single party falls back to Journal", () => {
  const x = voucherXml({ entry_no: "J-1", date: "2026-08-01", narration: "Adj", type: "sales", lines: [
    L(acc("Misc", "expense"), 500, 0), L(acc("Sales", "income", "revenue"), 0, 500)] });
  assert.match(x, /VCHTYPE="Journal"/);
  assert.doesNotMatch(x, /PARTYLEDGERNAME/);
});
