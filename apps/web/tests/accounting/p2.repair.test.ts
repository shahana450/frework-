// Phase 2 — the bank mis-map repair plan, on the AUDIT TEST TRADERS evidence (mirrors the SQL function).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planBankRepair } from "../../src/lib/repairPlan";

const L = (accountId: string, name: string, dr: number, cr: number, bank = false) => ({ accountId, name, dr, cr, bank });

test("RTGS ₹20,00,000 'Dr Creditors Control / Cr Bank Charges' → Dr Creditors Control / Cr HDFC Bank (payment)", () => {
  const p = planBankRepair("journal", [L("cred", "Creditors Control", 2000000, 0), L("chg", "Bank Charges", 0, 2000000)], "hdfc");
  assert.equal(p.status, "repair");
  if (p.status !== "repair") return;
  assert.deepEqual(p.newLines, [{ accountId: "cred", dr: 2000000, cr: 0 }, { accountId: "hdfc", dr: 0, cr: 2000000 }]);
  assert.equal(p.newType, "payment"); assert.match(p.problem, /Bank Charges" acted as the bank/);
});

test("CTS ₹5,00,000 'Dr Bank Charges / Cr Debtors Control' → Dr HDFC Bank / Cr Debtors Control (receipt)", () => {
  const p = planBankRepair("journal", [L("chg", "Bank Charges", 500000, 0), L("deb", "Debtors Control", 0, 500000)], "hdfc");
  assert.equal(p.status === "repair" && p.newType, "receipt");
  assert.deepEqual(p.status === "repair" && p.newLines, [{ accountId: "hdfc", dr: 500000, cr: 0 }, { accountId: "deb", dr: 0, cr: 500000 }]);
});

test("₹9 'Dr Bank Charges / Cr Bank Charges' → Dr Bank Charges / Cr HDFC Bank (payment)", () => {
  const p = planBankRepair("payment", [L("chg", "Bank Charges", 9, 0), L("chg", "Bank Charges", 0, 9)], "hdfc");
  assert.deepEqual(p.status === "repair" && p.newLines, [{ accountId: "chg", dr: 9, cr: 0 }, { accountId: "hdfc", dr: 0, cr: 9 }]);
});

test("correct entries are left alone; unclear ones go to manual review", () => {
  assert.equal(planBankRepair("payment", [L("rent", "Rent", 25000, 0), L("hdfc", "HDFC Bank", 0, 25000, true)], "hdfc").status, "ok");
  assert.equal(planBankRepair("journal", [L("rent", "Rent", 100, 0), L("sal", "Salary", 0, 100)], "hdfc").status, "manual");
});
