// Ledger names match whole words only: "Rent" must never swallow "Jikku Jose Current Account"
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFinder } from "../../src/lib/ledgerResolve";

const find = makeFinder([{ id: "1", name: "Rent" }, { id: "2", name: "HDFC Bank" }, { id: "3", name: "Salary" }]);

test("part of a word is not a match", () => {
  assert.equal(find("Jikku Jose Current Account"), undefined);
});

test("a different ledger with an extra real word is not a match", () => {
  assert.equal(find("Rent Payable"), undefined);
  assert.equal(find("Salary Advance"), undefined);
});

test("close variants still match", () => {
  assert.equal(find("rent")?.id, "1");
  assert.equal(find("HDFC")?.id, "2");
  assert.equal(find("HDFC Bank A/c")?.id, "2");
});
