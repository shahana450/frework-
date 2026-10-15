// A supplier/customer ledger is a party, never the expense or asset itself
import { test } from "node:test";
import assert from "node:assert/strict";
import { accountListForAI, isPartyLedger } from "../../src/lib/intentEngine";

test("suppliers and customers are marked as parties for the AI", () => {
  const list = accountListForAI([
    { name: "AISWARYA FURNITURE&BED HOUSE", type: "liability", sub_type: "trade_payables" },
    { name: "Asha Traders", type: "asset", sub_type: "trade_receivables" },
    { name: "Furniture & Fixtures", type: "asset", sub_type: "fixed_asset" },
  ]);
  assert.match(list, /AISWARYA FURNITURE&BED HOUSE \(supplier — a party, not an expense or asset\)/);
  assert.match(list, /Asha Traders \(customer — a party, not income\)/);
  assert.match(list, /Furniture & Fixtures \(asset\/fixed_asset\)/);
  assert.equal(isPartyLedger({ name: "x", sub_type: "trade_payables" }), true);
  assert.equal(isPartyLedger({ name: "x", sub_type: "fixed_asset" }), false);
});
