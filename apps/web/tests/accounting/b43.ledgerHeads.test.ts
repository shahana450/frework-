// Common ledger names get the right group by rule (AI only decides the unclear ones)
import { test } from "node:test";
import assert from "node:assert/strict";
import { inferHead } from "../../src/lib/ledgerHeads";

test("cash and capital by name", () => {
  assert.equal(inferHead("Cash")?.key, "cash");
  assert.equal(inferHead("Petty Cash")?.key, "cash");
  assert.equal(inferHead("Capital Account")?.key, "capital");
});

test("expense words match whole words only", () => {
  assert.equal(inferHead("Rent")?.key, "indirect_expense");
  assert.notEqual(inferHead("Jino Current Account")?.key, "indirect_expense");
  assert.notEqual(inferHead("Steam Boilers")?.key, "indirect_expense");
});
