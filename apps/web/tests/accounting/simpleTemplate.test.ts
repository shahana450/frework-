import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimpleGrid, voucherOf } from "../../src/lib/simpleTemplate";

test("simple template: dated row starts an entry, following rows join it", () => {
  const g = [["Date", "Particulars", "Debit", "Credit", "Narration"],
    ["01-04-2026", "Rent", "25,000", "", "Office rent April"], ["", "HDFC Bank", "", "25000", ""],
    ["02-04-2026", "Cash", 11800, "", "Sale to Asha"], ["", "Sales", "", 10000, ""], ["", "Output GST", "", 1800, ""],
    ["", "Electricity", 2000, "", "Power bill"], ["", "Cash", "", 2000, ""]];
  const e = parseSimpleGrid(g)!;
  assert.equal(e.length, 3);
  assert.deepEqual([e[0].date, e[0].debit, e[0].error, e[0].narration], ["2026-04-01", 25000, null, "Office rent April"]);
  assert.equal(e[1].lines.length, 3);
  assert.equal(e[2].date, "2026-04-02", "undated entry after a balanced one keeps the last date");
  assert.equal(voucherOf(e[0].lines), "payment");
  assert.equal(voucherOf(e[1].lines), "receipt");
});

test("simple template: unbalanced and incomplete entries are flagged, other sheets ignored", () => {
  const g = [["Date", "Particulars", "Debit", "Credit"], ["05-04-2026", "Rent", 500, ""], ["", "Cash", "", 400]];
  assert.match(parseSimpleGrid(g)![0].error!, /≠/);
  assert.equal(parseSimpleGrid([["Date", "Type", "Amount"]]), null);
});
