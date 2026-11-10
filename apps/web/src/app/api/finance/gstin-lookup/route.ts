import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { BASE, accessToken } from "@/lib/portals/sandbox";
import { decodeGstin, fromGstRecord, type GstinDetails } from "@/lib/gstinInfo";

// GSTIN → business details for setup. State, PAN and type come from the number itself; the registered name,
// address, constitution and registration type come from the public GST record (Sandbox "search taxpayer") when the
// server has Sandbox keys. Nothing is stored.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const basics = decodeGstin(req.nextUrl.searchParams.get("gstin") ?? "");
  if (!basics.valid) return NextResponse.json({ error: basics.error }, { status: 400 });
  let details: GstinDetails = { ...basics, source: "gstin" };
  let note: string | null = null;
  try {
    const token = await accessToken();
    const r = await fetch(`${BASE()}/gst/compliance/public/gstin/search`, {
      method: "POST", headers: { authorization: token, "x-api-key": process.env.SANDBOX_API_KEY!, "x-api-version": "1.0.0", "Content-Type": "application/json" },
      body: JSON.stringify({ gstin: basics.gstin }), signal: AbortSignal.timeout(12000),
    });
    const body = await r.json().catch(() => null);
    if (r.ok && body) {
      const d = fromGstRecord(basics, body);
      if (d.legalName || d.address) details = d; else note = "The GST record didn't return details — fill the rest in yourself.";
    } else note = "Couldn't read the GST record just now — state, PAN and type were filled from the GSTIN.";
  } catch { note = "Only state, PAN and business type could be filled from the GSTIN itself."; }
  return NextResponse.json({ ...details, note });
}
