import { test } from "node:test";
import assert from "node:assert/strict";
import { openDocs, matchLine, type MatchJournal } from "../../src/lib/billMatch";

const J: MatchJournal[] = [
  { id: "s1", entry_no: "SV-1", date: "2026-04-02", type: "sales", lines: [{ name: "Asha Traders", dr: 11800, cr: 0 }, { name: "Sales", dr: 0, cr: 10000 }, { name: "Output CGST", dr: 0, cr: 900 }, { name: "Output SGST", dr: 0, cr: 900 }] },
  { id: "s2", entry_no: "SV-2", date: "2026-04-05", type: "sales", lines: [{ name: "Kumar Stores", dr: 5000, cr: 0 }, { name: "Sales", dr: 0, cr: 5000 }] },
  { id: "p1", entry_no: "PV-1", date: "2026-04-03", type: "purchase", lines: [{ name: "Purchase", dr: 20000, cr: 0 }, { name: "Ravi Suppliers", dr: 0, cr: 20000 }] },
  { id: "s3", entry_no: "SV-3", date: "2026-04-06", type: "sales", lines: [{ name: "Cash", dr: 3000, cr: 0 }, { name: "Sales", dr: 0, cr: 3000 }] },
  { id: "r1", entry_no: "RV-1", date: "2026-04-10", type: "receipt", lines: [{ name: "HDFC Bank", dr: 5000, cr: 0 }, { name: "Kumar Stores", dr: 0, cr: 5000 }] },
];

test("open documents: cash sales and settled bills drop out", () => {
  const d = openDocs(J);
  assert.deepEqual(d.map(x => x.entryNo).sort(), ["PV-1", "SV-1"]);
  assert.equal(d.find(x => x.entryNo === "SV-1")!.open, 11800);
});

test("money in with the party name and exact amount is a sure match", () => {
  const m = matchLine({ description: "NEFT CR ASHA TRADERS INV 12", debit: 0, credit: 11800 }, openDocs(J));
  assert.equal(m?.doc.ledger, "Asha Traders"); assert.equal(m?.sure, true);
});

test("money out matches a supplier bill", () => {
  const m = matchLine({ description: "IMPS RAVI SUPPLIERS", debit: 20000, credit: 0 }, openDocs(J));
  assert.equal(m?.doc.entryNo, "PV-1"); assert.equal(m?.sure, true);
});

test("part payment by name is suggested but not sure; amount alone is not sure", () => {
  assert.equal(matchLine({ description: "UPI asha traders", debit: 0, credit: 5000 }, openDocs(J))?.sure, false);
  const m = matchLine({ description: "NEFT CR 99231", debit: 0, credit: 11800 }, openDocs(J));
  assert.equal(m?.doc.entryNo, "SV-1"); assert.equal(m?.sure, false);
});

test("no match when nothing fits", () => {
  assert.equal(matchLine({ description: "ATM WDL", debit: 777, credit: 0 }, openDocs(J)), null);
});
