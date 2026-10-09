// B1 — negative cash/bank must never appear as positive assets; displayed lines must foot to displayed totals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrialBalance, buildPL, buildBS } from "../../src/lib/books";
import { presentBalanceSheet, presentPL, signedMoney } from "../../src/lib/statements";
import { ACCOUNTS, LINES } from "./step0.baseline.test";

const tb = buildTrialBalance(ACCOUNTS, LINES, "2026-04-01", "2027-03-31");
const pl = buildPL(tb);
const bs = presentBalanceSheet(buildBS(tb, pl.netProfit), tb.map(r => ({ ...r, sub_type: ACCOUNTS.find(a => a.id === r.id)?.sub_type ?? null })));
const all = [...bs.assets, ...bs.liabilities].flatMap(s => s.lines.map(l => ({ ...l, section: s.key })));

test("B1: overdrawn bank and cash move to Current Liabilities, not shown as positive assets", () => {
  const ca = bs.assets.find(s => s.key === "current_assets")!;
  assert.ok(!ca.lines.some(l => l.id === "bank" || l.id === "cash"), "no bank/cash line under Current Assets");
  const od = all.filter(l => l.id === "bank" || l.id === "cash");
  assert.deepEqual(od.map(l => [l.section, l.amount]), [["current_liabilities", 40000], ["current_liabilities", 15000]]);
  assert.match(od.find(l => l.id === "bank")!.name, /^Bank overdraft — Bank$/);
  assert.match(od.find(l => l.id === "cash")!.name, /^Cash credit balance — Cash$/);
});

test("B1: every displayed section foots, and the balance sheet balances", () => {
  assert.equal(bs.footed, true, bs.problems.join("; "));
  for (const s of [...bs.assets, ...bs.liabilities]) assert.equal(Math.round(s.lines.reduce((a, l) => a + l.amount, 0) * 100) / 100, s.total, s.title);
  assert.equal(bs.totalAssets, bs.totalLiabilities);
});

test("B1: a debtor in advance shows with a visible minus, never as an absolute amount", () => {
  const abc = all.find(l => l.id === "abc")!;
  assert.equal(abc.amount, -25000);
  assert.equal(abc.note, "Credit balance");
  assert.equal(signedMoney(abc.amount), "−₹25,000.00");
});

test("B1: P&L presented from signed lines agrees with the engine", () => {
  const p = presentPL(pl);
  assert.equal(p.footed, true, p.problems.join("; "));
  assert.deepEqual([p.grossProfit, p.netProfit], [90000, 75000]);
});

test("B1: a footing break is reported, not hidden", () => {
  const broken = presentBalanceSheet({ ...buildBS(tb, pl.netProfit), netProfit: pl.netProfit + 100 });
  assert.equal(broken.footed, false);
  assert.match(broken.problems.join(" "), /≠/);
});
