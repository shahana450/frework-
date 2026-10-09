import { test } from "node:test";
import assert from "node:assert/strict";

// Same rule as FreBook's voice input: join phrases without repeating words
const merge = (sofar: string, next: string) => {
  const a = sofar.trim(), b = next.trim();
  if (!a) return b; if (!b) return a;
  const la = a.toLowerCase(), lb = b.toLowerCase();
  if (lb.startsWith(la)) return b;
  if (la.endsWith(lb) || la.includes(lb)) return a;
  const aw = a.split(/\s+/), bw = b.split(/\s+/);
  for (let k = Math.min(aw.length, bw.length); k > 0; k--) {
    if (aw.slice(-k).join(" ").toLowerCase() === bw.slice(0, k).join(" ").toLowerCase()) return [...aw, ...bw.slice(k)].join(" ");
  }
  return `${a} ${b}`;
};

test("Android-style growing phrases don't repeat", () => {
  let s = "";
  for (const p of ["Saleem", "Saleem a salary", "Saleem a salary", "Saleem a salary for September", "salary for September 2026"]) s = merge(s, p);
  assert.equal(s, "Saleem a salary for September 2026");
});
test("separate sentences are joined", () => {
  assert.equal(merge("Paid rent 25000", "from HDFC bank"), "Paid rent 25000 from HDFC bank");
});
