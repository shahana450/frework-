import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { fileFetchedDoc, type FetchedFile } from "@/lib/itShelf";

// Called by the portal worker during a background Income-tax fetch: one document per call, then a final report.
// Trusted only with the shared worker key AND the job's own one-time token (stored hashed).
export const maxDuration = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(req: NextRequest) {
  const key = process.env.PORTAL_WORKER_KEY ?? "";
  if (!key || !same(req.headers.get("x-worker-key") ?? "", key)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { job_id?: string; job_token?: string; file?: FetchedFile; done?: boolean; report?: unknown[] };
  const { data: job } = await sb.from("fw_fin_it_jobs").select("id,business_id,user_id,token_hash,fy,status,saved").eq("id", String(body.job_id ?? "")).maybeSingle();
  if (!job || !same(createHash("sha256").update(String(body.job_token ?? "")).digest("hex"), job.token_hash)) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  if (job.status !== "running") return NextResponse.json({ error: "Job already finished" }, { status: 409 });

  if (body.file) {
    const ok = await fileFetchedDoc(sb, job.business_id, job.user_id, body.file, job.fy);
    if (ok) await sb.from("fw_fin_it_jobs").update({ saved: job.saved + 1 }).eq("id", job.id);
    return NextResponse.json({ ok });
  }
  if (body.done) {
    const report = Array.isArray(body.report) ? body.report.slice(0, 20) : [];
    const anyOk = job.saved > 0 || report.some(r => (r as { ok?: boolean }).ok);
    await sb.from("fw_fin_it_jobs").update({ status: anyOk ? "done" : "failed", report, finished_at: new Date().toISOString() }).eq("id", job.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
