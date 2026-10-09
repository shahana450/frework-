// Speed test data: 10,000 posted vouchers in one test business (LOCAL or STAGING only — see lib/seedGuard.ts).
//   FW_SEED_EMAIL=perf@example.test FW_SEED_PASSWORD=… node --experimental-strip-types scripts/seed-10k.ts [count]
// Every voucher goes through fw_fin_post_journal (the real posting engine), so numbering, totals and the audit
// log are exactly what production would have. Then time the pages with:  E2E_PERF=1 npx playwright test perf
import { seedClient, ensureUserWithBusiness } from "./lib/seedGuard.ts";

const COUNT = Number(process.argv[2] ?? 10000);
const email = process.env.FW_SEED_EMAIL ?? "perf@example.test";
const password = process.env.FW_SEED_PASSWORD;
if (!password) throw new Error("Set FW_SEED_PASSWORD for the perf test user.");

const { sb, target } = seedClient();
const { userId, businessId, fyStartYear } = await ensureUserWithBusiness(sb, email, password, "Perf 10k Traders");
const { data: coa } = await sb.from("fw_fin_chart_of_accounts").select("id,name").eq("business_id", businessId);
const acc = (n: string) => { const a = coa?.find(x => x.name === n); if (!a) throw new Error(`missing ledger ${n}`); return a.id as string; };

// Customers so Receivables has many parties
const parties: string[] = [];
for (let i = 1; i <= 200; i++) {
  const name = `Perf Customer ${String(i).padStart(3, "0")}`;
  const { data: ex } = await sb.from("fw_fin_chart_of_accounts").select("id").eq("business_id", businessId).eq("name", name).maybeSingle();
  if (ex) { parties.push(ex.id); continue; }
  const { data } = await sb.from("fw_fin_chart_of_accounts").insert({ business_id: businessId, code: `11${String(i).padStart(3, "0")}`, name, type: "asset", sub_type: "trade_receivables" }).select("id").single();
  parties.push(data!.id);
}

const day = (i: number) => { const d = new Date(Date.UTC(fyStartYear, 3, 1) + (i % 360) * 86400000); return d.toISOString().slice(0, 10); };
const kinds = [
  (i: number) => ({ type: "sales", narration: `Perf sale ${i}`, lines: [{ account_id: parties[i % parties.length], dr: 1180 + i % 500, cr: 0 }, { account_id: acc("Sales"), dr: 0, cr: 1180 + i % 500 }] }),
  (i: number) => ({ type: "receipt", narration: `Perf receipt ${i}`, lines: [{ account_id: acc("Bank Account"), dr: 500 + i % 300, cr: 0 }, { account_id: parties[i % parties.length], dr: 0, cr: 500 + i % 300 }] }),
  (i: number) => ({ type: "payment", narration: `Perf rent ${i}`, lines: [{ account_id: acc("Office Rent"), dr: 250 + i % 100, cr: 0 }, { account_id: acc("Cash"), dr: 0, cr: 250 + i % 100 }] }),
  (i: number) => ({ type: "purchase", narration: `Perf purchase ${i}`, lines: [{ account_id: acc("Purchases"), dr: 700 + i % 200, cr: 0 }, { account_id: acc("Trade Payables"), dr: 0, cr: 700 + i % 200 }] }),
];

const { count: already } = await sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", businessId);
console.log(`Seeding ${target}: business ${businessId} has ${already ?? 0} entries; adding up to ${COUNT}.`);
const t0 = Date.now();
let done = 0, failed = 0;
const CONCURRENCY = 8;
for (let start = already ?? 0; start < COUNT; start += CONCURRENCY) {
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, COUNT - start) }, async (_, k) => {
    const i = start + k;
    const v = kinds[i % kinds.length](i);
    const { error } = await sb.rpc("fw_fin_post_journal", {
      p_business: businessId, p_actor: userId,
      p_header: { date: day(i), type: v.type, narration: v.narration, source: "seed_10k" },
      p_lines: v.lines,
    });
    if (error) { failed++; if (failed < 5) console.error(error.message); } else done++;
  }));
  if ((start / CONCURRENCY) % 125 === 0) console.log(`  ${start + CONCURRENCY}/${COUNT} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log(`Done: ${done} posted, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)}s. Business id: ${businessId}`);
