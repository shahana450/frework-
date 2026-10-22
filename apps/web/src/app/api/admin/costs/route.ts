import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, isAdminEmail, serverError } from "@/lib/apiAuth";
import { aiCostUsd, WA_BUSINESS_INR } from "@/lib/usage";

// Running costs, measured: AI calls and tokens, WhatsApp messages, file storage, database size. Staff only.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const USD_INR = 85;

type Row = { day: string; kind: string; provider: string; model: string; calls: number; input_tokens: number; output_tokens: number };

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const since = new Date(now.getTime() - 30 * 86400000) < monthStart ? new Date(now.getTime() - 30 * 86400000) : monthStart;
    const { data, error } = await sb.rpc("fw_usage_summary", { p_since: since.toISOString() });
    const setup = error && /fw_usage|function|does not exist|schema cache/i.test(error.message) ? "Run 2026-10-27_usage_log.sql in Supabase to start measuring." : null;
    if (error && !setup) throw error;
    const rows = ((data ?? []) as Row[]).map(r => ({ ...r, calls: Number(r.calls), input_tokens: Number(r.input_tokens), output_tokens: Number(r.output_tokens) }));
    const mStart = monthStart.toISOString().slice(0, 10);
    const month = rows.filter(r => r.day >= mStart);

    // AI by model, month to date
    const byModel = new Map<string, { model: string; provider: string; calls: number; input: number; output: number; usd: number }>();
    for (const r of month.filter(x => x.kind === "ai")) {
      const k = `${r.provider}|${r.model}`;
      const m = byModel.get(k) ?? { model: r.model || "unknown", provider: r.provider, calls: 0, input: 0, output: 0, usd: 0 };
      m.calls += r.calls; m.input += r.input_tokens; m.output += r.output_tokens; m.usd += aiCostUsd(r.model, r.input_tokens, r.output_tokens);
      byModel.set(k, m);
    }
    const ai = [...byModel.values()].sort((a, b) => b.usd - a.usd);
    const aiUsd = ai.reduce((s, m) => s + m.usd, 0);
    const waReplies = month.filter(r => r.kind === "wa_reply").reduce((s, r) => s + r.calls, 0);
    const waBusiness = month.filter(r => r.kind === "wa_business").reduce((s, r) => s + r.calls, 0);

    // Last 30 days, per day
    const days = Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - (29 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    const daily = days.map(d => {
      const ds = rows.filter(r => r.day === d);
      return { day: d, ai: ds.filter(r => r.kind === "ai").reduce((s, r) => s + r.calls, 0), wa: ds.filter(r => r.kind !== "ai").reduce((s, r) => s + r.calls, 0),
        inr: ds.filter(r => r.kind === "ai").reduce((s, r) => s + aiCostUsd(r.model, r.input_tokens, r.output_tokens), 0) * USD_INR + ds.filter(r => r.kind === "wa_business").reduce((s, r) => s + r.calls, 0) * WA_BUSINESS_INR };
    });

    // Storage (Shelf files) and size of the books
    const [{ data: files }, { count: journals }, { count: businesses }] = await Promise.all([
      sb.from("fw_fin_shelf_items").select("size_bytes").limit(100000),
      sb.from("fw_fin_journals").select("id", { count: "exact", head: true }),
      sb.from("fw_fin_businesses").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ]);
    const storageBytes = ((files ?? []) as { size_bytes: number | null }[]).reduce((s, f) => s + Number(f.size_bytes ?? 0), 0);

    // Capacity: database, file storage, active users (Supabase) and the WhatsApp daily limit (Meta)
    const { data: capRows, error: capErr } = await sb.rpc("fw_capacity");
    const cap = Array.isArray(capRows) ? capRows[0] : capRows;
    let wa: { tier: string | null; limit: number | null; quality: string | null; name_status: string | null } | null = null;
    const token = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim(), phoneId = (process.env.WHATSAPP_PHONE_ID ?? "").trim();
    if (token && phoneId) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=messaging_limit_tier,quality_rating,name_status`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      if (j) {
        const t: string | null = j.messaging_limit_tier ?? null;
        const lim = t ? ({ TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: null } as Record<string, number | null>)[t] ?? null : null;
        wa = { tier: t, limit: lim, quality: j.quality_rating ?? null, name_status: j.name_status ?? null };
      }
    }
    const peakBusinessPerDay = Math.max(0, ...days.map(d => rows.filter(r => r.day === d && r.kind === "wa_business").reduce((s, r) => s + r.calls, 0)));

    // Outside services: is each one set up (its keys are present) and what FreBook used this month
    const has = (...k: string[]) => k.every(x => !!(process.env[x] ?? "").trim());
    const todayIst = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const calls = (rs: Row[], p: string) => rs.filter(r => r.kind === "ai" && r.provider === p).reduce((s, r) => s + r.calls, 0);
    const { count: itJobs } = await sb.from("fw_fin_it_jobs").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString());
    const services = {
      vercel: true, supabase: true, github: true,
      gemini: has("GEMINI_API_KEY"), claude: has("ANTHROPIC_API_KEY"),
      whatsapp: has("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_ID"), gupshup: has("GUPSHUP_APP_TOKEN"),
      resend: has("RESEND_API_KEY"), fly: has("PORTAL_WORKER_URL", "PORTAL_WORKER_KEY"),
      sandbox: has("SANDBOX_API_KEY"), deepvue: has("DEEPVUE_CLIENT_ID"), setu: has("SETU_AA_CLIENT_ID"),
      razorpay: has("RAZORPAY_KEY_ID"), phonepe: has("PHONEPE_MERCHANT_ID"), zoho: has("ZOHO_CLIENT_ID"), qbo: has("QBO_CLIENT_ID"),
      geminiModel: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
      used: {
        geminiToday: calls(rows.filter(r => r.day === todayIst), "gemini"), geminiMonth: calls(month, "gemini"),
        claudeMonth: calls(month, "anthropic"), itJobsMonth: itJobs ?? 0,
      },
    };

    // Days into the month → projection for the whole month
    const dayOfMonth = now.getDate(), daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mtdInr = aiUsd * USD_INR + waBusiness * WA_BUSINESS_INR;
    return NextResponse.json({
      setup, usdInr: USD_INR, services,
      month: { label: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), dayOfMonth, daysInMonth },
      ai: ai.map(m => ({ ...m, inr: Math.round(m.usd * USD_INR) })),
      totals: {
        aiCalls: ai.reduce((s, m) => s + m.calls, 0), aiInr: Math.round(aiUsd * USD_INR),
        waReplies, waBusiness, waInr: Math.round(waBusiness * WA_BUSINESS_INR),
        mtdInr: Math.round(mtdInr), projectedInr: Math.round(dayOfMonth ? mtdInr / dayOfMonth * daysInMonth : 0),
      },
      storage: { files: (files ?? []).length, bytes: storageBytes },
      books: { journals: journals ?? 0, businesses: businesses ?? 0 },
      capacity: cap && !capErr ? { dbBytes: Number(cap.db_bytes), storageBytes: Number(cap.storage_bytes), storageFiles: Number(cap.storage_files), users: Number(cap.users_total), mau: Number(cap.mau) } : null,
      capacitySetup: capErr ? "Run 2026-10-28_capacity.sql in Supabase to see database and storage size." : null,
      whatsapp: wa ? { ...wa, peakBusinessPerDay } : null,
      daily: daily.map(d => ({ ...d, inr: Math.round(d.inr * 100) / 100 })),
    });
  } catch (e) {
    return serverError("admin/costs", e, "Couldn't load running costs.");
  }
}
