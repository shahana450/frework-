import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { fileToShelf } from "@/lib/shelf";

// Live Income-tax portal fetch through FreWork's portal worker (services/portal-worker).
// The taxpayer types PAN, password and OTP each time; FreBook passes them straight to the worker and stores
// none of them. Downloaded notices, 26AS, AIS and TIS are filed on the Shelf (Notices / Income Tax racks).
//   POST action=start  { pan, password }  → { session, state: "otp_required" | "logged_in" }
//   POST action=otp    { session, otp }   → { state }
//   POST action=fetch  { session, items, fy } → files saved to the Shelf + a report
//   POST action=close  { session }
export const maxDuration = 300;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const URL_ = () => (process.env.PORTAL_WORKER_URL ?? "").replace(/\/$/, "");

async function worker(path: string, body: unknown) {
  const r = await fetch(`${URL_()}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-worker-key": process.env.PORTAL_WORKER_KEY ?? "" }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, status: 502, d: { detail: "The portal worker isn't reachable. Is it running on the office PC?" } as Record<string, unknown> };
  return { ok: r.ok, status: r.status, d: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}
const errOf = (d: Record<string, unknown>) => {
  const det = d.detail as { message?: string; screenshot?: string } | string | undefined;
  return typeof det === "string" ? { error: det } : { error: det?.message ?? "The portal step failed.", screenshot: det?.screenshot ?? null };
};

export async function GET() {
  return NextResponse.json({ configured: !!(process.env.PORTAL_WORKER_URL && process.env.PORTAL_WORKER_KEY) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bizId = String(body.business_id ?? "");
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!URL_() || !process.env.PORTAL_WORKER_KEY) return NextResponse.json({ error: "The Income-tax portal link isn't switched on yet (portal worker not set up)." }, { status: 503 });

    if (body.action === "start") {
      if (!body.consent) return NextResponse.json({ error: "Confirm you are the taxpayer or authorised by them." }, { status: 400 });
      const { ok, status, d } = await worker("/it/start", { pan: String(body.pan ?? ""), password: String(body.password ?? "") });
      return ok ? NextResponse.json(d) : NextResponse.json(errOf(d), { status });
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
      const { ok, status, d } = await worker("/it/fetch", { session: String(body.session ?? ""), items, fy });
      if (!ok) return NextResponse.json(errOf(d), { status });
      const files = (d.files ?? []) as { kind: string; name: string; data: string }[];
      let saved = 0;
      for (const f of files) {
        const bytes = new Uint8Array(Buffer.from(f.data, "base64"));
        const isText = /\.txt$/i.test(f.name);
        const rack = f.kind === "notice" || f.kind === "notice_text" ? "notices" : "income_tax";
        const docType = { notice: "Income-tax notice", notice_text: "Portal page (text)", "26as": "Form 26AS", ais: "AIS", tis: "TIS", filed_returns: "Filed returns" }[f.kind] ?? "Income-tax document";
        const ok2 = await fileToShelf(sb, { businessId: bizId, actorId: gate.user.id, rack, title: `${docType} · ${f.name.replace(/\.(pdf|txt|zip|json)$/i, "")}`.slice(0, 180),
          fileName: f.name, mime: isText ? "text/plain" : /\.zip$/i.test(f.name) ? "application/zip" : /\.json$/i.test(f.name) ? "application/json" : "application/pdf",
          bytes, source: "system", fy, docType, notes: "Fetched from the Income-tax portal" + (/(AIS|TIS)/.test(docType) ? " · PDF password: PAN in small letters + date of birth (ddmmyyyy)" : f.kind === "26as" ? " · if protected, password is date of birth (ddmmyyyy)" : "") });
        if (ok2) saved++;
      }
      return NextResponse.json({ report: d.report ?? [], saved, screenshots: d.screenshots ?? [] });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return serverError("it-fetch", e, "The Income-tax portal fetch didn't go through.");
  }
}
