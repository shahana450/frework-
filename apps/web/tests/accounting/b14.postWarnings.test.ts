// B14 — all warnings for a draft are gathered into one list for a single in-app confirmation
import { test } from "node:test";
import assert from "node:assert/strict";
import { postWarnings } from "../../src/lib/frebook/postWarnings";

test("B14: compliance, open questions and a duplicate appear together, in one list", () => {
  const w = postWarnings({
    compliance: ["Cash payment over ₹10,000: Not deductible (s.36(4))."],
    questions: [{ text: "Which bank account?" }],
    duplicate: { entry_no: "PV/2026-27/0008", date: "2026-04-09" },
  });
  assert.deepEqual(w, ["Cash payment over ₹10,000: Not deductible (s.36(4)).", "Unanswered: Which bank account?", "Possible duplicate of PV/2026-27/0008 (2026-04-09)"]);
});

test("B14: a clean draft has nothing to confirm (posts straight away)", () => {
  assert.deepEqual(postWarnings({}), []);
});
