import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize26AS, summarizeForm16, compareTds } from "../../src/lib/taxDocs";

const S26 = { code: 200, data: {
  pan: "ABVPT1571F", name: "HEENA TRIVEDI", financial_year: "2023-24", assessment_year: "2024-25",
  "Part I": [
    { name_of_deductor: "ACME LTD", tan_of_deductor: "MUMA12345B", sr_no: "1", total_amount_paid_credited: "8,100.00", total_tax_deducted: "810.00", total_tds_deposited: "810.00",
      deduction_wise: [
        { sr_no: "Sr. No.", section: "Section", transaction_date: "Transaction Date", amount_paid_credited: "Amount Paid / Credited", tax_deducted: "Tax Deducted", tds_deposited: "TDS Deposited" },
        { sr_no: "1", section: "194JB", transaction_date: "12-Jun-2023", status_of_booking: "F", amount_paid_credited: "8100.00", tax_deducted: "810.00", tds_deposited: "810.00" },
      ] },
    { name_of_deductor: "BETA PVT", tan_of_deductor: "BLRB12345C", sr_no: "2", total_amount_paid_credited: "50000", total_tax_deducted: "1000", total_tds_deposited: "1000",
      deduction_wise: [{ section: "194C", amount_paid_credited: "50000", tax_deducted: "1000", tds_deposited: "1000" }] },
  ], "Part II": [], "Part III": [] } };

test("26AS: deductors, totals and sections; header rows skipped", () => {
  const s = summarize26AS(S26);
  assert.equal(s.deductors.length, 2);
  assert.equal(s.deductors[0].rows.length, 1);
  assert.deepEqual(s.totals, { paid: 58100, tds: 1810, deposited: 1810 });
  assert.deepEqual(s.bySection.map(x => x.section), ["194C", "194JB"]);
  assert.equal(s.ay, "2024-25");
});

test("26AS vs books", () => {
  const s = summarize26AS(S26);
  assert.equal(compareTds(s, 1810).verdict, "match");
  assert.deepEqual(compareTds(s, 810), { inForm: 1810, inBooks: 810, diff: 1000, verdict: "missing_in_books" });
});

test("Form 16: salary, deductions, tax and quarterly TDS", () => {
  const f = summarizeForm16({ data: {
    "Part A": { assessment_year: "2024-25", employer: { tan: "HYDU00904B", pan: "AAACU8638B", name: "UNIMED" }, employee: { pan: "ABCDE1234F", first_name: "ASHA", last_name: "K" },
      tds: [{ quarter: "Quarter", credit_amount: "Credit" }, { quarter: "Q1", credit_amount: 230000, tax_deducted: 19249, tax_deposited: 19249 }, { quarter: "Q2", credit_amount: 250000, tax_deducted: 9704, tax_deposited: 9704 }, { quarter: "Total", credit_amount: 480000, tax_deducted: 28953 }] },
    "Part B": { details_of_salary_paid: { gross_salary: { salary_as_per_section_17_1: 1080030, value_of_perquisites_us_17_2: 0, total: 1080030 }, deduction_us_16: { standard_deduction_us_16_ia: 50000 }, total_amount_of_deductions_us_16: 50000, total_taxable_income: 1030030, net_tax_payable: 67085, opting_out_of_taxation_us_115_bac: "No" } },
  } });
  assert.equal(f.employer.tan, "HYDU00904B"); assert.equal(f.employeeName, "ASHA K");
  assert.equal(f.gross, 1080030); assert.equal(f.standardDeduction, 50000); assert.equal(f.taxable, 1030030); assert.equal(f.netTax, 67085);
  assert.equal(f.quarters.length, 2); assert.equal(f.tdsTotal, 28953); assert.equal(f.newRegime, true);
});
