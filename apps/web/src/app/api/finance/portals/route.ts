import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { providerFor, PortalError, GSTIN_RE, PAN_RE, type Portal } from "@/lib/portals";
import { seal, open } from "@/lib/portals/secretBox";

export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "Portal Connect needs its database setup — run 2026-10-12_portals.sql in Supabase.";
const missing = (m?: string) => /fw_fin_portal_|does not exist|schema cache/i.test(m ?? "");
const fyStartYear = (d = new Date()) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const [links, rows, { data: biz }] = await Promise.all([
      supabase.from("fw_fin_portal_links").select("portal,identifier,provider,status,expires_at,last_sync_at,last_error").eq("business_id", bizId!),
      supabase.from("fw_fin_portal_status").select("portal,kind,form,period,status,arn,filed_on,amount,details,demo,fetched_at").eq("business_id", bizId!).order("period", { ascending: false }).limit(400),
      supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).maybeSingle(),
    ]);
    if (links.error && missing(links.error.message)) return NextResponse.json({ setup_needed: NEEDS_SQL, links: [], statuses: [] });
    const b = (biz ?? {}) as Record<string, string | null>;
    return NextResponse.json({
      links: links.data ?? [], statuses: rows.data ?? [],
      defaults: { gstin: b.gstin ?? "", pan: b.pan ?? (b.gstin && GSTIN_RE.test(b.gstin) ? b.gstin.slice(2, 12) : "") },
      providers: Object.fromEntries((["gst", "it"] as const).map(p => { const v = providerFor(p); return [p, { id: v.id, demo: v.demo, credential: v.credential ?? "otp" }]; })),
    });
  } catch (e) {
    return serverError("portals", e, "Couldn't load portal connections.");
  }
}

// `password` is only for providers that link with the portal password (Deepvue). It is passed to the provider once and never stored or logged.
type Body = { business_id?: string; action?: "start" | "verify" | "sync" | "unlink"; portal?: Portal; identifier?: string; otp?: string; password?: string };

async function sync(bizId: string, portal: Portal) {
  const { data: link } = await supabase.from("fw_fin_portal_links").select("*").eq("business_id", bizId).eq("portal", portal).maybeSingle();
  if (!link || link.status !== "linked" || !link.session_enc) throw new PortalError("SESSION_EXPIRED", "Link the portal first.");
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await supabase.from("fw_fin_portal_links").update({ status: "expired" }).eq("id", link.id);
    throw new PortalError("SESSION_EXPIRED", "Portal access has expired — approve again with a new OTP.");
  }
  const provider = providerFor(portal);
  const rows = await provider.fetchStatuses(link.identifier, { token: open(link.session_enc), expiresAt: link.expires_at }, fyStartYear());
  if (rows.length) {
    const { error } = await supabase.from("fw_fin_portal_status").upsert(rows.map(r => ({
      business_id: bizId, portal, kind: r.kind, form: r.form, period: r.period, status: r.status, arn: r.arn ?? null, filed_on: r.filedOn ?? null,
      amount: r.amount ?? null, details: r.details ?? {}, demo: provider.demo, fetched_at: new Date().toISOString(),
    })), { onConflict: "business_id,portal,form,period" });
    if (error) throw error;
  }
  await supabase.from("fw_fin_portal_links").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", link.id);
  return rows.length;
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as Body;
  const gate = await requireBusiness(req, b.business_id, { action: "integrate" });
  if (gate instanceof NextResponse) return gate;
  const bizId = b.business_id!;
  const portal = b.portal === "it" ? "it" : "gst";
  try {
    if (b.action === "start") {
      const id = (b.identifier ?? "").toUpperCase().replace(/\s/g, "");
      if (portal === "gst" ? !GSTIN_RE.test(id) : !PAN_RE.test(id)) return NextResponse.json({ error: portal === "gst" ? "Enter a valid 15-character GSTIN." : "Enter a valid PAN (e.g. ABCDE1234F)." }, { status: 400 });
      const provider = providerFor(portal);
      const otp = await provider.requestOtp(id);
      const { error } = await supabase.from("fw_fin_portal_links").upsert({ business_id: bizId, portal, identifier: id, provider: provider.id, status: "otp_pending", otp_ref: otp.otpRef, session_enc: null, last_error: null, created_by: gate.user.id }, { onConflict: "business_id,portal" });
      if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS_SQL }, { status: 409 }) : serverError("portals start", error, "Couldn't start the link.");
      if (provider.noOtp) {
        const session = await provider.verifyOtp(id, otp.otpRef, "");
        await supabase.from("fw_fin_portal_links").update({ status: "linked", session_enc: seal(session.token, provider.demo), expires_at: session.expiresAt, otp_ref: null }).eq("business_id", bizId).eq("portal", portal);
        await logAudit(supabase, { businessId: bizId, actor: gate.user.id, action: "portal_link", source: "portals", detail: { portal, identifier: id, provider: provider.id } });
        const n = await sync(bizId, portal);
        return NextResponse.json({ ok: true, linked: true, synced: n, message: `${otp.message} ${n} filing statuses fetched.`, demo: false });
      }
      return NextResponse.json({ ok: true, message: otp.message, demo: provider.demo });
    }
    if (b.action === "verify") {
      const { data: link } = await supabase.from("fw_fin_portal_links").select("*").eq("business_id", bizId).eq("portal", portal).maybeSingle();
      if (!link?.otp_ref) return NextResponse.json({ error: "Request an OTP first." }, { status: 400 });
      const provider = providerFor(portal);
      const secret = provider.credential === "password" ? String(b.password ?? "") : (b.otp ?? "").trim();
      const session = await provider.verifyOtp(link.identifier, link.otp_ref, secret);
      await supabase.from("fw_fin_portal_links").update({ status: "linked", session_enc: seal(session.token, provider.demo), expires_at: session.expiresAt, otp_ref: null }).eq("id", link.id);
      await logAudit(supabase, { businessId: bizId, actor: gate.user.id, action: "portal_link", source: "portals", detail: { portal, identifier: link.identifier, provider: provider.id } });
      const n = await sync(bizId, portal);
      return NextResponse.json({ ok: true, synced: n, expires_at: session.expiresAt });
    }
    if (b.action === "sync") return NextResponse.json({ ok: true, synced: await sync(bizId, portal) });
    if (b.action === "unlink") {
      await supabase.from("fw_fin_portal_links").delete().eq("business_id", bizId).eq("portal", portal);
      await supabase.from("fw_fin_portal_status").delete().eq("business_id", bizId).eq("portal", portal);
      await logAudit(supabase, { businessId: bizId, actor: gate.user.id, action: "portal_unlink", source: "portals", detail: { portal } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) {
      await supabase.from("fw_fin_portal_links").update({ last_error: e.message }).eq("business_id", bizId).eq("portal", portal);
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "OTP_INVALID" || e.code === "INVALID" ? 400 : e.code === "SESSION_EXPIRED" ? 401 : 409 });
    }
    if (e instanceof Error && missing(e.message)) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    return serverError("portals", e, "The portal didn't respond. Please try again.");
  }
}
