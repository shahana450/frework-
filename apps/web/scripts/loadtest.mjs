// FreWork load test.
//   Public (no login):     node scripts/loadtest.mjs public
//   Signed-in (read-only): FW_TOKEN=<your access token> FW_BIZ=<test business id> node scripts/loadtest.mjs books
//   AI (uses Gemini quota, makes NO entries): add  FW_AI=1  to also send FreBook chat drafts at a low rate.
// Steps up concurrent users and reports throughput, latency (p50/p95) and errors per step.
const BASE = process.env.FW_BASE ?? "https://frework.online";
const mode = process.argv[2] ?? "public";
const STEPS = (process.env.FW_STEPS ?? "5,10,25,50").split(",").map(Number);
const SECONDS = Number(process.env.FW_SECONDS ?? 20);
const token = process.env.FW_TOKEN, biz = process.env.FW_BIZ;

const month = new Date().toISOString().slice(0, 7);
const PUBLIC = [
  { name: "homepage", url: "/" },
  { name: "app shell", url: "/finance" },
  { name: "api/version", url: "/api/version" },
  { name: "api (auth check)", url: "/api/finance/dashboard?business_id=00000000-0000-0000-0000-000000000000", ok: [401, 403] },
];
const BOOKS = [
  { name: "dashboard", url: `/api/finance/dashboard?business_id=${biz}` },
  { name: "trial balance", url: `/api/finance/reports?business_id=${biz}&report=trial_balance` },
  { name: "gst summary", url: `/api/finance/gst?business_id=${biz}&month=${month}&report=summary` },
  { name: "collect", url: `/api/finance/collect?business_id=${biz}` },
];
const AI = { name: "FreBook draft (AI)", url: "/api/finance/chat-book", method: "POST",
  body: () => JSON.stringify({ message: "Paid office rent 25000 from HDFC Bank", business_id: biz, bulk: true, history: [] }) };

if (mode !== "public" && (!token || !biz)) { console.error("Set FW_TOKEN and FW_BIZ for the signed-in test."); process.exit(1); }
const targets = mode === "public" ? PUBLIC : [...BOOKS, ...(process.env.FW_AI ? [AI] : [])];

async function hit(t) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + t.url, {
      method: t.method ?? "GET",
      headers: { ...(token && mode !== "public" ? { authorization: `Bearer ${token}` } : {}), ...(t.body ? { "content-type": "application/json" } : {}) },
      body: t.body?.(), redirect: "manual",
    });
    await res.arrayBuffer();
    const good = (t.ok ?? [200, 307, 308]).includes(res.status);
    return { ms: performance.now() - t0, ok: good, status: res.status };
  } catch (e) { return { ms: performance.now() - t0, ok: false, status: "net" }; }
}

const pct = (a, p) => a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

for (const users of STEPS) {
  const end = Date.now() + SECONDS * 1000;
  const stats = new Map(targets.map(t => [t.name, { ms: [], fail: 0, codes: {} }]));
  let aiBudget = 0;
  await Promise.all(Array.from({ length: users }, async (_, u) => {
    let k = u;
    while (Date.now() < end) {
      let t = targets[k++ % targets.length];
      if (t === AI) { if (aiBudget >= 10) continue; aiBudget++; } // at most 10 AI drafts per step — protects your quota
      const r = await hit(t);
      const s = stats.get(t.name);
      s.ms.push(r.ms); if (!r.ok) { s.fail++; s.codes[r.status] = (s.codes[r.status] ?? 0) + 1; }
    }
  }));
  console.log(`\n=== ${users} concurrent users · ${SECONDS}s ===`);
  for (const [name, s] of stats) {
    const n = s.ms.length;
    console.log(`${name.padEnd(20)} req ${String(n).padStart(5)}  ${(n / SECONDS).toFixed(1).padStart(6)}/s  p50 ${pct(s.ms, 0.5).toFixed(0).padStart(5)}ms  p95 ${pct(s.ms, 0.95).toFixed(0).padStart(6)}ms  errors ${s.fail}${s.fail ? " " + JSON.stringify(s.codes) : ""}`);
  }
}
