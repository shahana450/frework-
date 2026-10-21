import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { seal, open as unseal } from "@/lib/portals/secretBox";

// Income-tax portal fetch through FreWork's portal worker (services/portal-worker).
//   GET  ?business_id                → is it switched on, which PANs have a remembered password, the last job
//   GET  ?business_id&job=<id>       → a background fetch's progress
//   POST action=start  { pan, password?, remember, consent } → { session, state }   (saved password used if none typed)
//   POST action=otp    { session, otp }
//   POST action=fetch  { session, items, fy } → starts a background job; the worker sends each document to
//                       /api/finance/it-fetch/callback, so the fetch carries on if this page is closed
//   POST action=close  { session }
//   POST action=forget { pan }      → deletes the remembered password
// A password is stored only when "Remember password" is ticked — AES-256-GCM encrypted (PORTAL_TOKEN_KEY).
export const maxDuration = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const URL_ = () => (process.env.PORTAL_WORKER_URL ?? "").replace(/\/$/, "");
const NEEDS_SQL = "Run 2026-11-03_it_portal.sql in Supabase to switch on saved passwords and background fetches.";

async function worker(path: string, body: unknown) {
  const r = await fetch(`${URL_()}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-worker-key": process.env.PORTAL_WORKER_KEY ?? "" }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, status: 502, d: { detail: "The portal worker isn't reachable right now. Try again in a minute." } as Record<string, unknown> };
  return { ok: r.ok, status: r.status, d: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}
const errOf = (d: Record<string, unknown>) => {
  const det = d.detail as { message?: string; screenshot?: string } | string | undefined;
  return typeof det === "string" ? { error: det } : { error: det?.message ?? "The portal step failed.", screenshot: det?.screenshot ?? null };
};
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

export async function GET(req: NextRequest) {
  const configured = !!(process.env.PORTAL_WORKER_URL && process.env.PORTAL_WORKER_KEY);
  const bizId = req.nextUrl.searchParams.get("business_id");
  if (!bizId) return NextResponse.json({ configured });
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  const job = req.nextUrl.searchParams.get("job");
  if (job) {
    const { data } = await sb.from("fw_fin_it_jobs").select("status,saved,report,created_at,finished_at").eq("id", job).eq("business_id", bizId).maybeSingle();
    return data ? NextResponse.json(data) : NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const { data, error } = await sb.from("fw_fin_it_credentials").select("pan,updated_at").eq("business_id", bizId);
  const last = error ? null : (await sb.from("fw_fin_it_jobs").select("id,status,saved,report,created_at").eq("business_id", bizId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
  return NextResponse.json({ configured, saved: (data ?? []).map(r => r.pan), setup_needed: error ? NEEDS_SQL : null, last_job: last ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bizId = String(body.business_id ?? "");
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!URL_() || !process.env.PORTAL_WORKER_KEY) return NextResponse.json({ error: "The Income-tax portal link isn't switched on yet (portal worker not set up)." }, { status: 503 });

    if (body.action === "forget") {
      await sb.from("fw_fin_it_credentials").delete().eq("business_id", bizId).eq("pan", String(body.pan ?? "").toUpperCase());
      return NextResponse.json({ ok: true });
    }

    if (body.action === "start") {
      if (!body.consent) return NextResponse.json({ error: "Confirm you are the taxpayer or authorised by them." }, { status: 400 });
      const pan = String(body.pan ?? "").trim().toUpperCase();
      if (!PAN.test(pan)) return NextResponse.json({ error: "Enter a valid PAN." }, { status: 400 });
      let password = String(body.password ?? "");
      if (!password) {
        const { data } = await sb.from("fw_fin_it_credentials").select("enc_password").eq("business_id", bizId).eq("pan", pan).maybeSingle();
        if (!data) return NextResponse.json({ error: "Enter the Income-tax portal password." }, { status: 400 });
        try { password = unseal(data.enc_password); } catch { return NextResponse.json({ error: "The saved password can't be read any more. Enter it again." }, { status: 400 }); }
      }
      const { ok, status, d } = await worker("/it/start", { pan, password });
      if (!ok) return NextResponse.json(errOf(d), { status });
      // Remember only after the portal accepted it, and only when asked
      if (body.remember && body.password) {
        const { error } = await sb.from("fw_fin_it_credentials").upsert({ business_id: bizId, pan, enc_password: seal(String(body.password), false), saved_by: gate.user.id, updated_at: new Date().toISOString() });
        if (error) return NextResponse.json({ ...d, warning: NEEDS_SQL });
      }
      return NextResponse.json(d);
    }

    if (body.action === "otp") {
      const { ok, status, d } = await worker("/it/otp", { session: String(body.session ?? ""), otp: String(body.otp ?? "") });
      return ok ? NextResponse.json(d) : NextResponse.json(errOf(d), { status });
    }

    if (body.action === "close") {
      await worker("/it/close", { session: String(body.session ?? "") });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "fetch") {
      const items = (Array.isArray(body.items) ? body.items : []).map(String);
      const fy = /^\d{4}-\d{2}$/.test(String(body.fy ?? "")) ? String(body.fy) : null;
      const token = randomBytes(24).toString("base64url");
      const { data: job, error } = await sb.from("fw_fin_it_jobs").insert({ business_id: bizId, user_id: gate.user.id, token_hash: createHash("sha256").update(token).digest("hex"), fy }).select("id").single();
      if (error || !job) return NextResponse.json({ error: NEEDS_SQL }, { status: 400 });
      const callback = `${req.nextUrl.origin}/api/finance/it-fetch/callback`;
      const { ok, status, d } = await worker("/it/fetch_async", { session: String(body.session ?? ""), items, fy, callback_url: callback, job_id: job.id, job_token: token });
      if (!ok) {
        await sb.from("fw_fin_it_jobs").update({ status: "failed", report: [{ item: "start", ok: false, note: errOf(d).error }], finished_at: new Date().toISOString() }).eq("id", job.id);
        return NextResponse.json(errOf(d), { status });
      }
      return NextResponse.json({ job: job.id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return serverError("it-fetch", e, "The Income-tax portal fetch didn't go through.");
  }
}
