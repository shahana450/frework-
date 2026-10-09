import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatementGrid, cellDate } from "../../src/lib/bankExcel";

test("SBI layout: 'Description' is not mistaken for the Credit column", () => {
  const g = [["State Bank of India"], ["Account No", "1234"], [],
    ["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Debit", "Credit", "Balance"],
    ["01 Apr 2026", "01 Apr 2026", "NEFT CR ACME TRADERS", "N123", "", "59,000.00", "1,59,000.00"],
    ["02 Apr 2026", "02 Apr 2026", "UPI/DR/AIRTEL", "U9", "1,179.00", "", "1,57,821.00"],
    ["", "", "**Statement Summary**", "", "", "", ""]];
  const r = parseStatementGrid(g);
  assert.equal(r.rows.length, 2);
  assert.deepEqual([r.rows[0].date, r.rows[0].credit, r.rows[0].debit], ["2026-04-01", 59000, 0]);
  assert.deepEqual([r.rows[1].debit, r.rows[1].credit], [1179, 0]);
});

test("HDFC layout: Withdrawal/Deposit Amt, dd/mm/yy dates, wrapped narration", () => {
  const g = [["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
    ["05/04/26", "IMPS-612399-RAHUL S", "0000612", "05/04/26", "25000", "", "75000"],
    ["", "office rent oct", "", "", "", "", ""],
    ["06/04/26", "SALARY CREDIT", "", "06/04/26", "", "90000", "165000"]];
  const r = parseStatementGrid(g);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].description, "IMPS-612399-RAHUL S office rent oct");
  assert.deepEqual([r.rows[0].date, r.rows[0].debit, r.rows[1].credit], ["2026-04-05", 25000, 90000]);
});

test("Axis/Kotak layout: one Amount column with Dr/Cr; Excel serial dates; no time-zone shift", () => {
  const g = [["Tran Date", "Particulars", "Amount", "DR/CR", "Balance"],
    [46113, "ATM WDL", "10,000.00", "DR", "50,000.00"],
    [46114, "INT PD", "125.50", "CR", "50,125.50"]];
  const r = parseStatementGrid(g);
  assert.deepEqual(r.rows.map(x => [x.date, x.debit, x.credit]), [["2026-04-01", 10000, 0], ["2026-04-02", 0, 125.5]]);
  assert.equal(cellDate(new Date(2026, 3, 1)), "2026-04-01");
});
