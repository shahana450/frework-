import { NextRequest, NextResponse } from "next/server";
import { requireUser, isAdminEmail, serverError } from "@/lib/apiAuth";

// Staff only. GET: is FreBook's WhatsApp healthy (token works, number status, which apps get its messages)?
// POST: connect the WhatsApp Business Account to the app the current access token belongs to, so its webhook
// receives messages. Uses the token stored on the server — it is never shown.
const GRAPH = "https://graph.facebook.com/v21.0";
const env = (k: string) => (process.env[k] ?? "").trim();
const WABA = () => env("WHATSAPP_WABA_ID") || "1677956173948933";

async function graph(path: string, init?: RequestInit) {
  const r = await fetch(`${GRAPH}/${path}`, { ...init, headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  return { ok: !!r?.ok, status: r?.status ?? 0, body: j as Record<string, unknown> & { error?: { message?: string; code?: number } } };
}

async function gate(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const g = await gate(req); if (g) return g;
    const phone = await graph(`${env("WHATSAPP_PHONE_ID")}?fields=display_phone_number,verified_name,name_status,quality_rating,code_verification_status,platform_type,status`);
    const apps = await graph(`${WABA()}/subscribed_apps`);
    return NextResponse.json({
      token_ok: phone.ok, token_error: phone.ok ? null : phone.body.error?.message ?? `HTTP ${phone.status}`,
      phone: phone.ok ? phone.body : null,
      subscribed_apps: apps.ok ? ((apps.body.data as { whatsapp_business_api_data?: { name?: string; id?: string } }[] | undefined) ?? []).map(a => a.whatsapp_business_api_data ?? a) : null,
      apps_error: apps.ok ? null : apps.body.error?.message ?? null,
    });
  } catch (e) { return serverError("admin/whatsapp", e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = await gate(req); if (g) return g;
    const r = await graph(`${WABA()}/subscribed_apps`, { method: "POST" });
    if (!r.ok) return NextResponse.json({ error: r.body.error?.message ?? `Meta said ${r.status}` }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) { return serverError("admin/whatsapp", e); }
}
