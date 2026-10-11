import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsFromTrack, periodOf, isoDate } from "../../src/lib/portals/sandbox";

test("Sandbox track response becomes filing rows", () => {
  const rows = rowsFromTrack({ code: 200, data: { status_cd: "1", data: { EFiledlist: [
    { arn: "AA330820000343Z", dof: "01-02-2023", mof: "GSP", ret_prd: "082020", rtntype: "GSTR1", status: "Filed", valid: "Y" },
    { arn: "AB2", dof: "20-09-2020", ret_prd: "082020", rtntype: "GSTR3B", status: "Filed", valid: "Y" },
    { arn: "X", dof: "20-09-2020", ret_prd: "082020", rtntype: "GSTR3B", status: "Filed", valid: "N" },
  ] } } });
  assert.equal(rows.length, 2);
  assert.deepEqual({ form: rows[0].form, period: rows[0].period, status: rows[0].status, arn: rows[0].arn, filedOn: rows[0].filedOn }, { form: "GSTR-1", period: "2020-08", status: "filed", arn: "AA330820000343Z", filedOn: "2023-02-01" });
  assert.equal(rows[1].form, "GSTR-3B");
});

test("no record is an empty list; other errors throw", () => {
  assert.deepEqual(rowsFromTrack({ data: { status_cd: "0", error: { error_code: "RET13510", message: "No Record found" } } }), []);
  assert.throws(() => rowsFromTrack({ data: { status_cd: "0", error: { error_code: "RTN_22", message: "Please select a valid financial year" } } }));
});

test("period and date formats", () => { assert.equal(periodOf("032026"), "2026-03"); assert.equal(isoDate("05-04-2026"), "2026-04-05"); assert.equal(isoDate("bad"), null); });
