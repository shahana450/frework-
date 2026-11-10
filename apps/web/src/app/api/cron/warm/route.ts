import { NextRequest, NextResponse } from "next/server";

// Keeps the busiest server functions warm (Vercel Cron, every 5 minutes), so the first person to open FreBook after a
// quiet spell doesn't wait for them to start. Each call carries no login: the route answers "not signed in" at once,
// which is enough to keep it loaded. No data is read or changed.
const ROUTES = [
  "/api/finance/dashboard", "/api/finance/my-role", "/api/finance/businesses", "/api/finance/chat-book/fast",
  "/api/finance/books", "/api/finance/reports", "/api/finance/plan-limit",
];

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const base = new URL(req.url).origin;
  const t0 = Date.now();
  const res = await Promise.all(ROUTES.map(async p => {
    const s = Date.now();
    const r = await fetch(base + p, { cache: "no-store" }).catch(() => null);
    return { p, status: r?.status ?? 0, ms: Date.now() - s };
  }));
  return NextResponse.json({ ok: true, ms: Date.now() - t0, routes: res });
}
