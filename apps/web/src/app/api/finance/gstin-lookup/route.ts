import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { BASE, accessToken } from "@/lib/portals/sandbox";
import { decodeGstin, fromGstRecord, type GstinDetails } from "@/lib/gstinInfo";

// GSTIN → business details for setup. State, PAN and type come from the number itself; the registered name,
// address, constitution and registration type come from the public GST record (Sandbox "search taxpayer").
// Nothing is stored. When the record can't be read, the reason is returned so it can be fixed.
export const maxDuration = 30;

async function search(gstin: string, token: string) {
  const r = await fetch(`${BASE()}/gst/compliance/public/gstin/search`, {
    method: "POST", headers: { authorization: token, "x-api-key": process.env.SANDBOX_API_KEY!, "x-api-version": "1.0.0", "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ gstin }), signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let body: unknown = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { ok: r.ok, status: r.status, body, text };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const basics = decodeGstin(req.nextUrl.searchParams.get("gstin") ?? "");
  if (!basics.valid) return NextResponse.json({ error: basics.error }, { status: 400 });
  let details: GstinDetails = { ...basics, source: "gstin" };
  let note: string | null = null, reason: string | null = null;
  try {
    const token = await accessToken();
    let res = await search(basics.gstin, token).catch(e => ({ ok: false, status: 0, body: null, text: String((e as Error)?.message ?? e) }));
    if (!res.ok && (res.status === 0 || res.status >= 500)) res = await search(basics.gstin, token).catch(e => ({ ok: false, status: 0, body: null, text: String((e as Error)?.message ?? e) }));
    if (res.ok && res.body) {
      const d = fromGstRecord(basics, res.body);
      if (d.legalName || d.address) details = d;
      else { note = "The GST record came back without a name or address — fill the rest in yourself."; reason = `empty: ${res.text.slice(0, 200)}`; }
    } else {
      const msg = (res.body as { message?: string; data?: { message?: string; error?: { message?: string } } } | null);
      reason = `HTTP ${res.status}: ${msg?.message ?? msg?.data?.error?.message ?? msg?.data?.message ?? res.text.slice(0, 200)}`;
      note = res.status === 403 || res.status === 401 ? "The GST record search isn't switched on for FreBook's GST data account yet — state, PAN and type were filled from the GSTIN." : "Couldn't read the GST record just now — state, PAN and type were filled from the GSTIN. Try again in a minute.";
    }
  } catch (e) {
    reason = (e as Error)?.message ?? String(e);
    note = "Couldn't sign in to the GST data service — state, PAN and type were filled from the GSTIN.";
  }
  if (reason) console.error("gstin-lookup", basics.gstin.slice(0, 2) + "…", reason);
  return NextResponse.json({ ...details, note, reason });
}
