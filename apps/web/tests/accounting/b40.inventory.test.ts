// Inventory engine: FIFO / average cost, COGS and margin, trading-account tie-out, godowns, batches & expiry, job work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runItem, periodSummary, stockByLocation, batches, jobWork, movers, reorderList, type InvItem, type InvMove, type Godown } from "../../src/lib/inventory";

const rice: InvItem = { id: "rice", name: "Rice 25 kg", opening_qty: 10, opening_rate: 100, reorder_level: 15, max_qty: 50 };
const mv = (id: string, date: string, qty: number, rate: number, kind: string, extra: Partial<InvMove> = {}): InvMove => ({ id, item_id: "rice", date, qty, rate, kind, ...extra });

test("FIFO: sales take the oldest cost first", () => {
  const moves = [mv("p1", "2026-04-10", 10, 120, "purchase"), mv("s1", "2026-04-20", -15, 200, "sale")];
  const r = runItem(rice, moves);
  assert.equal(r.qty, 5);
  assert.equal(r.cogs, 10 * 100 + 5 * 120);      // 1,600
  assert.equal(r.value, 5 * 120);                 // 600 left, at the newer cost
  assert.equal(r.salesValue, 3000);
});

test("Weighted average: one blended cost", () => {
  const moves = [mv("p1", "2026-04-10", 10, 120, "purchase"), mv("s1", "2026-04-20", -15, 200, "sale")];
  const r = runItem({ ...rice, valuation: "avg" }, moves);
  assert.equal(r.qty, 5);
  assert.equal(r.cogs, 1650);                     // 15 × 110
  assert.equal(r.value, 550);
});

test("Transfers and job work don't change what the business owns", () => {
  const moves = [mv("t1", "2026-05-01", -4, 0, "transfer_out", { godown_id: "g1", transfer_id: "T" }), mv("t2", "2026-05-01", 4, 0, "transfer_in", { godown_id: "g2", transfer_id: "T" })];
  assert.equal(runItem(rice, moves).qty, 10);
  assert.equal(runItem(rice, moves).value, 1000);
});

test("Trading account ties out: opening + purchases − closing = COGS when stock only goes out by sale", () => {
  const moves = [mv("p1", "2026-04-10", 10, 120, "purchase"), mv("s1", "2026-04-20", -15, 200, "sale"), mv("p2", "2026-05-02", 20, 130, "purchase"), mv("s2", "2026-05-15", -12, 210, "sale")];
  const may = periodSummary([rice], moves, "2026-05-01", "2026-05-31");
  const row = may.rows[0];
  assert.equal(row.openQty, 5); assert.equal(row.openValue, 600);
  assert.equal(row.inValue, 2600);
  assert.equal(row.closeQty, 13);
  assert.equal(may.totals.tradingCogs, may.totals.cogs);
  assert.equal(row.margin, row.salesValue - row.cogs);
});

test("Purchase and sales returns", () => {
  const moves = [mv("p1", "2026-04-10", 10, 120, "purchase"), mv("pr", "2026-04-11", -2, 120, "return"), mv("s1", "2026-04-20", -5, 200, "sale"), mv("sr", "2026-04-21", 1, 200, "return")];
  const r = runItem(rice, moves, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(r.qty, 10 + 10 - 2 - 5 + 1);
  assert.equal(r.inQty, 8);                       // 10 bought, 2 sent back
  assert.equal(r.soldQty, 4);                     // 5 sold, 1 came back
});

test("Stock by place: opening at the default godown, transfers move it", () => {
  const g: Godown[] = [{ id: "g1", name: "Main", kind: "godown", is_default: true }, { id: "g2", name: "Kochi branch", kind: "branch" }];
  const moves = [mv("t1", "2026-05-01", -4, 0, "transfer_out", { godown_id: "g1", transfer_id: "T" }), mv("t2", "2026-05-01", 4, 0, "transfer_in", { godown_id: "g2", transfer_id: "T" })];
  const { grid } = stockByLocation([rice], moves, g);
  assert.equal(grid.get("rice")!.get("g1"), 6);
  assert.equal(grid.get("rice")!.get("g2"), 4);
});

test("Batches: expired and expiring soon", () => {
  const moves = [mv("b1", "2026-01-01", 5, 100, "purchase", { batch: "A1", expiry: "2026-11-20" }), mv("b2", "2026-02-01", 8, 100, "purchase", { batch: "B2", expiry: "2026-12-20" }), mv("s", "2026-03-01", -2, 150, "sale", { batch: "B2", expiry: "2026-12-20" })];
  const b = batches([rice], moves, "2026-11-28");
  assert.equal(b.length, 2);
  assert.equal(b[0].status, "expired"); assert.equal(b[0].qty, 5);
  assert.equal(b[1].status, "30"); assert.equal(b[1].qty, 6);
});

test("Job work: pending quantity and the 1-year return deadline", () => {
  const g: Godown[] = [{ id: "g1", name: "Main", kind: "godown", is_default: true }, { id: "jw", name: "Anil Polishing", kind: "job_worker", gstin: "32ABCDE1234F1Z5" }];
  const moves = [
    mv("o1", "2025-10-01", -6, 100, "jobwork_out", { godown_id: "g1", transfer_id: "C1", ref_no: "DC-7" }), mv("o2", "2025-10-01", 6, 100, "jobwork_out", { godown_id: "jw", transfer_id: "C1", ref_no: "DC-7" }),
    mv("i1", "2026-01-10", -4, 0, "jobwork_in", { godown_id: "jw", transfer_id: "C1" }), mv("i2", "2026-01-10", 4, 0, "jobwork_in", { godown_id: "g1", transfer_id: "C1" }),
  ];
  const [row] = jobWork([rice], moves, g, "2026-11-28");
  assert.equal(row.worker, "Anil Polishing");
  assert.equal(row.sent, 6); assert.equal(row.back, 4); assert.equal(row.pending, 2);
  assert.equal(row.dueBy, "2026-10-01");
  assert.equal(row.status, "overdue");
  assert.equal(runItem(rice, moves).qty, 10);     // still the business's stock
});

test("Movers and reorder", () => {
  const moves = [mv("s1", "2026-11-01", -3, 150, "sale")];
  const [m] = movers([rice], moves, "2026-11-28");
  assert.equal(m.qty, 7); assert.equal(m.outQty, 3);
  const [r] = reorderList([rice], moves, "2026-11-28");
  assert.equal(r.orderQty, 43);                   // up to the 50 maximum
  const [dead] = movers([{ ...rice, id: "x" }], [], "2026-11-28");
  assert.equal(dead.speed, "dead");
});
