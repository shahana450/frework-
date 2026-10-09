// B17 — unposted drafts survive a reload; posted/cancelled ones don't come back
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveDrafts, loadDrafts, pickDrafts } from "../../src/lib/frebook/draftStore";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), size: () => m.size }; };
const tx = { lines: [] };
const chat = [
  { id: "welcome", role: "system", text: "Hello" },
  { id: "u1", role: "user", text: "Paid rent 15000 cash" }, { id: "a1", role: "ai", transaction: tx, status: "pending" },
  { id: "u2", role: "user", text: "Sold to Kumar 60000" }, { id: "a2", role: "ai", transaction: tx, status: "posted" },
  { id: "u3", role: "user", text: "Bank charges 590" }, { id: "a3", role: "ai", transaction: tx, status: "cancelled" },
];

test("B17: open drafts (and the message that asked for them) are kept; posted/cancelled are not", () => {
  assert.deepEqual(pickDrafts(chat).map(m => m.id), ["u1", "a1"]);
});

test("B17: a reload restores unposted drafts per business, and clears when none remain", () => {
  const s = mem();
  saveDrafts(s, "biz-1", chat);
  assert.deepEqual(loadDrafts(s, "biz-1").map(m => m.id), ["u1", "a1"]);
  assert.deepEqual(loadDrafts(s, "biz-2"), [], "another business never sees them");
  saveDrafts(s, "biz-1", chat.map(m => m.id === "a1" ? { ...m, status: "posted" } : m));
  assert.equal(s.size(), 0);
});
