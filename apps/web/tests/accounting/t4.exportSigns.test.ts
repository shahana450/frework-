// Task 4 — Excel/PDF exports of the Balance Sheet and P&L use the presented statements, so signs match the screen (step-0 book).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrialBalance, buildPL, buildBS } from "../../src/lib/books";
import { presentBalanceSheet, presentPL } from "../../src/lib/statements";
import { bsExportRows, plExportRows, exportAmounts, exportFileName } from "../../src/lib/statementExport";
import { ACCOUNTS, LINES } from "./step0.baseline.test";

const tb = buildTrialBalance(ACCOUNTS, LINES, "2026-04-01", "2027-03-31");
const pl = buildPL(tb);
const bs = presentBalanceSheet(buildBS(tb, pl.netProfit), tb.map(r => ({ ...r, sub_type: ACCOUNTS.find(a => a.id === r.id)?.sub_type ?? null })));
const ppl = presentPL(pl);
const meta = { business: "AUDIT TEST TRADERS", period: "FY 2026-27" };
const bsRows = bsExportRows(bs, meta);
const plRows = plExportRows(ppl, meta);
const amountOf = (rows: (string | number | null)[][], label: RegExp) => rows.find(r => typeof r[0] === "string" && label.test(r[0]))?.[1];

test("T4: Balance Sheet export has exactly the screen's lines and signs, in order", () => {
  const screen = [
    ...bs.assets.flatMap(s => [...s.lines.map(l => l.amount), s.total]), bs.totalAssets,
    ...bs.liabilities.flatMap(s => [...s.lines.map(l => l.amount), s.total]), bs.totalLiabilities,
  ];
  assert.deepEqual(exportAmounts(bsRows), screen);
});

test("T4: overdrawn bank and cash export under Current Liabilities as positive overdrafts, never as assets", () => {
  assert.equal(amountOf(bsRows, /^\s+Bank overdraft — Bank/), 40000);
  assert.equal(amountOf(bsRows, /^\s+Cash credit balance — Cash/), 15000);
  const assetsEnd = bsRows.findIndex(r => r[0] === "Total Assets");
  assert.ok(!bsRows.slice(0, assetsEnd).some(r => typeof r[0] === "string" && /^\s+(Bank|Cash)( |$)/.test(r[0])), "no bank/cash line among assets");
});

test("T4/P3: a customer in credit exports under liabilities as 'Advances from customers'", () => {
  assert.equal(amountOf(bsRows, /^\s+Advances from customers — ABC Traders/), 25000);
});

test("T4: the exported Balance Sheet foots and balances", () => {
  assert.equal(amountOf(bsRows, /^Total Assets$/), amountOf(bsRows, /^Total Liabilities & Equity$/));
  assert.ok(!bsRows.some(r => typeof r[0] === "string" && r[0].startsWith("⚠")));
});

test("T4: P&L export matches the screen, including the reversed bank charge and net profit", () => {
  const screen: number[] = [];
  ppl.sections.forEach((s, i) => { screen.push(...s.lines.map(l => l.amount), s.total); if (i === 1) screen.push(ppl.grossProfit); });
  screen.push(ppl.netProfit);
  assert.deepEqual(exportAmounts(plRows), screen);
  assert.equal(amountOf(plRows, /^(Net Profit|Net Loss)$/), ppl.netProfit);
  assert.equal(ppl.netProfit, Math.round(pl.netProfit * 100) / 100);
});

test("T4: the Reports page exports from the presented statements only", () => {
  const page = readFileSync(join(process.cwd(), "src/app/finance/reports/page.tsx"), "utf8");
  assert.match(page, /plExportRows\(presented as PresentedPL/);
  assert.match(page, /bsExportRows\(presented as PresentedBS/);
  assert.equal(exportFileName("Balance-Sheet", meta), "Balance-Sheet-AUDIT-TEST-TRADERS-FY-2026-27.xlsx");
});
