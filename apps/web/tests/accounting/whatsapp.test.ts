import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, normPhone, draftText } from "../../src/lib/whatsapp/format";

test("WhatsApp commands: link codes, yes/no in English and Hindi, plain text", () => {
  assert.deepEqual(parseCommand("link 482913"), { type: "link", code: "482913" });
  assert.deepEqual(parseCommand("Haan"), { type: "yes" });
  assert.deepEqual(parseCommand("post anyway"), { type: "post_anyway" });
  assert.deepEqual(parseCommand("nahi"), { type: "no" });
  assert.deepEqual(parseCommand("2"), { type: "pick", n: 2 });
  assert.deepEqual(parseCommand("Paid rent 25000 from HDFC"), { type: "text", text: "Paid rent 25000 from HDFC" });
  assert.equal(normPhone("098765 43210"), "919876543210");
  assert.equal(normPhone("+974 5555 1234"), "97455551234");
});

test("WhatsApp draft shows compliance problems first and asks for YES", () => {
  const txt = draftText({ transaction_date: "2026-10-06", narrative: "Contract work", warnings: [], lines: [{ account: "Contract Charges", debit: 150000, credit: 0 }, { account: "Cash in Hand", debit: 0, credit: 150000 }] } as never,
    [{ title: "Cash payment over ₹10,000", detail: "Not deductible (section 36(4))." }]);
  assert.ok(txt.startsWith("⚠️ *Compliance"));
  assert.match(txt, /Dr {2}Contract Charges {2}₹1,50,000/);
  assert.match(txt, /Reply \*YES\* to post/);
});
