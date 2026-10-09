import { test } from "node:test";
import assert from "node:assert/strict";
import { groupKeyOf, groupStatement, learnHistory } from "../../src/lib/statementGroups";

test("narrations reduce to the payee or purpose", () => {
  assert.equal(groupKeyOf("UPI/DR/412345678901/SWIGGY LTD/YESB/swiggy@ybl").label, "Food & refreshments");
  assert.equal(groupKeyOf("NEFT-HDFCN52026100412345-RAGESH KUMAR-HDFC0001234").label, "Ragesh Kumar");
  assert.equal(groupKeyOf("IMPS/P2A/612345678/RAGESH KUMAR/SBIN/x").label, "Ragesh Kumar");
  assert.equal(groupKeyOf("ATM WDL 04-10-2026 CALICUT 1234").label, "Cash withdrawal");
  assert.equal(groupKeyOf("SMS ALERT CHRGS QTR SEP").label, "Bank charges");
  assert.equal(groupKeyOf("123456789").label, "Other");
});

test("groups by payee and direction, with suggestions from history, rules and AI", () => {
  const rows = [
    { id: "1", date: "2026-10-01", description: "UPI/DR/4111/ACME TRADERS/HDFC/acme@okhdfcbank", debit: 0, credit: 50000, aiLedger: "Sales", confidence: 0.9 },
    { id: "2", date: "2026-10-03", description: "NEFT-N5202-ACME TRADERS-HDFC0000001", debit: 0, credit: 25000, aiLedger: "Sales", confidence: 0.8 },
    { id: "3", date: "2026-10-02", description: "IMPS/P2A/6123/RAGESH KUMAR/SBIN", debit: 15000, credit: 0, aiLedger: "Salary & Wages", confidence: 0.6 },
    { id: "4", date: "2026-10-04", description: "IMPS/P2A/6999/RAGESH KUMAR/SBIN", debit: 15000, credit: 0, aiLedger: "Commission Expenses", confidence: 0.4 },
    { id: "5", date: "2026-10-05", description: "SMS ALERT CHRGS", debit: 17.7, credit: 0 },
    { id: "6", date: "2026-10-06", description: "ATM WDL CALICUT", debit: 10000, credit: 0 },
  ];
  const history = learnHistory([{ description: "NEFT RAGESH KUMAR SBIN", ledger: "Salary & Wages", debit: 15000 }]);
  const g = groupStatement(rows, history);
  const acme = g.find(x => x.label === "Acme Traders")!;
  assert.deepEqual([acme.dir, acme.count, acme.total, acme.suggested, acme.source], ["in", 2, 75000, "Sales", "ai"]);
  const ragesh = g.find(x => x.label === "Ragesh Kumar")!;
  assert.deepEqual([ragesh.count, ragesh.suggested, ragesh.source], [2, "Salary & Wages", "history"]);
  assert.equal(g.find(x => x.label === "Bank charges")!.suggested, "Bank Charges");
  assert.equal(g.find(x => x.label === "Cash withdrawal")!.suggested, "Cash in Hand");
});
