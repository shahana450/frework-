import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, isAdminEmail, serverError } from "@/lib/apiAuth";

// System health for the staff console: the running deployment, the database, the Income-tax portal worker, the
// scheduled jobs and which services are configured. Staff only; no secret values are returned, only whether set.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const has = (...k: string[]) => k.every(x => !!(process.env[x] ?? "").trim());
const CRONS = [
  { path: "/api/cron/wa-health", schedule: "Daily 9:00 AM IST", what: "Checks FreBook's WhatsApp can send and receive; emails an alert if not" },
  { path: "/api/cron/collect-alerts", schedule: "Daily 9:00 AM IST", what: "WhatsApp alerts for overdue customers" },
];

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null }> {
  try { return { value: await fn(), error: null }; } catch (e) { return { value: null, error: e instanceof Error ? e.message : String(e) }; }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const t0 = Date.now();
    const db = await sb.from("fw_fin_businesses").select("id", { count: "exact", head: true });
    const dbMs = Date.now() - t0;

    const workerUrl = (process.env.PORTAL_WORKER_URL ?? "").replace(/\/$/, "");
    const worker = workerUrl ? await timed(async () => {
      const t = Date.now();
      const r = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(8000) });
      return { ok: r.ok, status: r.status, ms: Date.now() - t };
    }) : null;

    return NextResponse.json({
      deployment: {
        env: process.env.VERCEL_ENV ?? "local", region: process.env.VERCEL_REGION ?? "—",
        commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null, message: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0].slice(0, 120) || null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null, url: process.env.VERCEL_URL ?? null,
      },
      database: { ok: !db.error, ms: dbMs, businesses: db.count ?? null, error: db.error?.message ?? null },
      worker: !workerUrl ? { configured: false } : { configured: true, ok: !!worker?.value?.ok, ms: worker?.value?.ms ?? null, error: worker?.error ?? (worker?.value && !worker.value.ok ? `Worker answered ${worker.value.status}` : null) },
      crons: CRONS.map(c => ({ ...c, secretSet: has("CRON_SECRET") })),
      services: {
        "AI (Anthropic)": has("ANTHROPIC_API_KEY"), "WhatsApp": has("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_ID") || has("GUPSHUP_APP_ID"),
        "Email alerts (Resend)": has("RESEND_API_KEY"), "Income-tax worker": has("PORTAL_WORKER_URL", "PORTAL_WORKER_KEY"),
        "Payments (Razorpay)": has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"), "Scheduled jobs secret": has("CRON_SECRET"),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (e) { return serverError("admin/health", e, "Couldn't check system health."); }
}
