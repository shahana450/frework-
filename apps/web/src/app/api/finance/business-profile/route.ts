import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Editable business details. The GST portal password is never stored — only username and trade name.
const FIELDS = ["name", "legal_name", "business_type", "gstin", "pan", "tan", "gst_registration_type", "gst_username", "gst_trade_name", "address", "city", "state", "pincode", "email", "phone", "logo_url"] as const;
type Profile = Partial<Record<typeof FIELDS[number], string | null>>;

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const TAN_RE = /^[A-Z]{4}\d{5}[A-Z]$/;

export async function GET(req: NextRequest) {
  const bizId = new URL(req.url).searchParams.get("business_id");
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  const { data, error } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).single();
  if (error || !data) return serverError("business-profile", error, "We couldn't load your business details.");
  const profile: Profile = {};
  for (const f of FIELDS) profile[f] = (data as Record<string, unknown>)[f] as string ?? "";
  return NextResponse.json({ profile, can_edit: gate.role === "owner" || gate.role === "admin" });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as Profile & { business_id?: string };
    const gate = await requireBusiness(req, b.business_id, { action: "lock" });
    if (gate instanceof NextResponse) return gate;

    const clean: Profile = {};
    for (const f of FIELDS) if (f in b) clean[f] = typeof b[f] === "string" ? b[f]!.trim() || null : null;
    if (clean.logo_url && (!/^data:image\/(png|jpeg|webp);base64,/.test(clean.logo_url) || clean.logo_url.length > 300_000)) return NextResponse.json({ error: "The logo must be a PNG, JPG or WebP image under about 200 KB." }, { status: 400 });
    for (const k of ["gstin", "pan", "tan"] as const) if (clean[k]) clean[k] = clean[k]!.toUpperCase().replace(/\s/g, "");

    if (!clean.name) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    if (clean.gstin && !GSTIN_RE.test(clean.gstin)) return NextResponse.json({ error: "That GSTIN doesn't look right — it should be 15 characters, like 32ABCDE1234F1Z5." }, { status: 400 });
    if (clean.pan && !PAN_RE.test(clean.pan)) return NextResponse.json({ error: "That PAN doesn't look right — it should be like ABCDE1234F." }, { status: 400 });
    if (clean.gstin && clean.pan && clean.gstin.slice(2, 12) !== clean.pan) return NextResponse.json({ error: "The PAN doesn't match the PAN inside your GSTIN (characters 3–12)." }, { status: 400 });
    if (clean.tan && !TAN_RE.test(clean.tan)) return NextResponse.json({ error: "That TAN doesn't look right — it should be like ABCD12345E." }, { status: 400 });
    if (clean.pincode && !/^\d{6}$/.test(clean.pincode)) return NextResponse.json({ error: "PIN code should be 6 digits." }, { status: 400 });
    if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });

    // Another of your businesses with the same GSTIN or name? Ask before saving.
    if (req.headers.get("x-confirm-duplicate") !== "1") {
      const { data: owner } = await supabase.from("fw_fin_businesses").select("owner_id").eq("id", b.business_id!).single();
      const { data: others } = await supabase.from("fw_fin_businesses").select("id,name,gstin").eq("owner_id", owner?.owner_id ?? gate.user.id).neq("id", b.business_id!);
      const same = (others ?? []).find(o => (clean.gstin && o.gstin && o.gstin.toUpperCase() === clean.gstin) || o.name?.trim().toLowerCase() === clean.name!.toLowerCase());
      if (same) return NextResponse.json({ code: "POSSIBLE_DUPLICATE", error: `You already have a business "${same.name}"${same.gstin ? ` (GSTIN ${same.gstin})` : ""} with the same ${clean.gstin && same.gstin?.toUpperCase() === clean.gstin ? "GSTIN" : "name"}.` }, { status: 409 });
    }

    const { error } = await supabase.from("fw_fin_businesses").update(clean).eq("id", b.business_id!);
    if (error) {
      if (/logo_url/.test(error.message)) return NextResponse.json({ error: "To save a logo, run 2026-10-08_invoices_logo.sql in Supabase first." }, { status: 409 });
      return serverError("business-profile", error, "We couldn't save your business details.");
    }
    await logAudit(supabase, { businessId: b.business_id!, actor: gate.user.id, action: "settings_change", source: "business_profile", detail: { fields: Object.keys(clean) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("business-profile", e, "We couldn't save your business details.");
  }
}
