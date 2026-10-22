// WhatsApp month words → YYYY-MM, for "GSTR1 JSON August 2026"
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthFromText } from "../../src/lib/monthFromText";

const now = new Date("2026-10-22T08:00:00Z");

test("named month with a year", () => {
  assert.equal(monthFromText("Prepare GSTr1 JSON for August 2026", now), "2026-08");
  assert.equal(monthFromText("gstr1 file aug 26", now), "2026-08");
  assert.equal(monthFromText("gstr1 json sept'25", now), "2025-09");
});

test("named month without a year is the latest one not in the future", () => {
  assert.equal(monthFromText("gstr1 json september", now), "2026-09");
  assert.equal(monthFromText("gstr1 json december", now), "2025-12");
});

test("numbers and relative words", () => {
  assert.equal(monthFromText("gstr1 json 08/2026", now), "2026-08");
  assert.equal(monthFromText("gstr1 json last month", now), "2026-09");
  assert.equal(monthFromText("gstr1 json this month", now), "2026-10");
  assert.equal(monthFromText("gstr1 json last month", new Date("2026-01-10T08:00:00Z")), "2025-12");
});

test("no month", () => {
  assert.equal(monthFromText("gstr1 json please", now), null);
});
