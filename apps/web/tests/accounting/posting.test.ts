import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntry, voucherTypeFor, postJournal, PostingError } from "../../src/lib/posting";

const L = (accountId: string, dr: number, cr: number) => ({ accountId, dr, cr });

test("balanced entry passes and is rounded to paise", () => {
  const lines = validateEntry([L("a", 0.1, 0), L("b", 0.2, 0), L("c", 0, 0.3)], "2026-09-01");
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map(l => l.dr + l.cr), [0.1, 0.2, 0.3]);
});

test("debits must equal credits", () => {
  assert.throws(() => validateEntry([L("a", 100, 0), L("b", 0, 99.99)], "2026-09-01"), (e: unknown) => e instanceof PostingError && e.code === "UNBALANCED");
});

test("zero-value entries are rejected", () => {
  assert.throws(() => validateEntry([L("a", 0, 0), L("b", 0, 0)], "2026-09-01"), PostingError);
});

test("needs at least two non-zero lines", () => {
  assert.throws(() => validateEntry([L("a", 100, 0), L("b", 0, 0)], "2026-09-01"), (e: unknown) => e instanceof PostingError && e.code === "INVALID");
});

test("negative amounts are rejected", () => {
  assert.throws(() => validateEntry([L("a", -100, 0), L("b", 0, -100)], "2026-09-01"), (e: unknown) => e instanceof PostingError && e.code === "INVALID");
});

test("a line cannot be both debit and credit", () => {
  assert.throws(() => validateEntry([L("a", 100, 100), L("b", 0, 0), L("c", 0, 0)], "2026-09-01"), PostingError);
});

test("every line needs an account", () => {
  assert.throws(() => validateEntry([L("", 100, 0), L("b", 0, 100)], "2026-09-01"), (e: unknown) => e instanceof PostingError && e.code === "ACCOUNT");
});

test("invalid dates are rejected", () => {
  assert.throws(() => validateEntry([L("a", 1, 0), L("b", 0, 1)], "02-09-2026"), PostingError);
  assert.throws(() => validateEntry([L("a", 1, 0), L("b", 0, 1)], "2026-13-45"), PostingError);
});

test("described transactions map to the voucher types the books use", () => {
  const cases: [string, string][] = [
    ["credit_sale", "sales"], ["cash_sale", "sales"], ["credit_purchase", "purchase"], ["expense_payment", "payment"],
    ["salary_payment", "payment"], ["bank_receipt_from_customer", "receipt"], ["capital_introduced", "receipt"],
    ["bank_transfer", "contra"], ["credit_note", "credit_note"], ["debit_note", "debit_note"], ["depreciation", "journal"], ["", "journal"],
  ];
  for (const [input, expected] of cases) assert.equal(voucherTypeFor(input), expected, input);
});

// Minimal stand-in for the Supabase client
function fakeDb(opts: { rpcError?: { code?: string; message: string } } = {}) {
  const calls: { rpc: unknown[]; inserts: { table: string; rows: unknown }[] } = { rpc: [], inserts: [] };
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    for (const m of ["select", "eq", "in", "lte", "gte", "like", "order", "limit"]) q[m] = self;
    q.maybeSingle = async () => ({ data: table === "fw_fin_financial_years" ? { id: "fy1", is_locked: false } : null, error: null });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: table === "fw_fin_chart_of_accounts" ? [{ id: "bank", name: "HDFC Bank", type: "asset", sub_type: "bank", is_group: false }, { id: "rent", name: "Rent", type: "expense", sub_type: "indirect_expense", is_group: false }] : [], error: null });
    q.insert = (rows: unknown) => { calls.inserts.push({ table, rows }); return { select: () => ({ single: async () => ({ data: { id: "j1" }, error: null }) }), then: (r: (v: unknown) => void) => r({ error: null }) }; };
    q.delete = () => ({ eq: async () => ({}) });
    return q;
  };
  const sb = {
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      return opts.rpcError ? { data: null, error: opts.rpcError } : { data: { id: "j1", entry_no: "JV-2026-0007", total: 25000 }, error: null };
    },
    from: chain,
  };
  return { sb: sb as never, calls };
}

const rent = { businessId: "b1", actorId: "u1", date: "2026-09-01", type: "payment", narration: "Office rent", source: "test", lines: [L("rent", 25000, 0), L("bank", 0, 25000)] };

test("posting goes through the database posting function", async () => {
  const { sb, calls } = fakeDb();
  const r = await postJournal(sb, rent);
  assert.equal(r.entryNo, "JV-2026-0007");
  assert.equal(calls.rpc.length, 1);
  const args = (calls.rpc[0] as { args: { p_lines: { dr: number; cr: number }[] } }).args;
  assert.deepEqual(args.p_lines.map(l => [l.dr, l.cr]), [[25000, 0], [0, 25000]]);
});

test("an unbalanced entry never reaches the database", async () => {
  const { sb, calls } = fakeDb();
  await assert.rejects(postJournal(sb, { ...rent, lines: [L("rent", 25000, 0), L("bank", 0, 2500)] }), PostingError);
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.inserts.length, 0);
});

test("database refusals come back as plain posting errors", async () => {
  const { sb } = fakeDb({ rpcError: { message: "FW_LOCKED: the financial year containing 2026-09-01 is locked" } });
  await assert.rejects(postJournal(sb, rent), (e: unknown) => e instanceof PostingError && e.code === "LOCKED");
});

test("falls back to validated inserts when the posting function isn't installed", async () => {
  const { sb, calls } = fakeDb({ rpcError: { code: "PGRST202", message: "Could not find the function" } });
  const r = await postJournal(sb, rent);
  assert.equal(r.entryNo, "JV-2026-0001");
  const lines = calls.inserts.find(i => i.table === "fw_fin_journal_lines")!.rows as { dr_amount: number; cr_amount: number }[];
  assert.equal(lines.reduce((s, l) => s + l.dr_amount, 0), lines.reduce((s, l) => s + l.cr_amount, 0));
});
