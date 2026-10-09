import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { COUNTRIES, CURRENCIES, COUNTRY_TAX, getTaxModule } from "@/lib/tax";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const needsSetup = (m: string) => /country|timezone|locale|tax_regime/.test(m);

export async function GET(req: NextRequest) {
  const bizId = new URL(req.url).searchParams.get("business_id");
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  let { data, error } = await supabase.from("fw_fin_businesses").select("name,state,currency,country,timezone,locale,tax_regime,fiscal_year_start").eq("id", bizId!).single();
  let setupNeeded = false;
  if (error && needsSetup(error.message)) {
    setupNeeded = true;
    ({ data, error } = await supabase.from("fw_fin_businesses").select("name,state,currency,fiscal_year_start").eq("id", bizId!).single());
  }
  if (error) return serverError("business-settings", error, "We couldn't load your settings.");
  const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId!).eq("status", "posted");
  const d = data as Record<string, string | null>;
  return NextResponse.json({
    settings: { country: d.country ?? "IN", state: d.state, currency: d.currency ?? "INR", timezone: d.timezone ?? "Asia/Kolkata", locale: d.locale ?? "en-IN", tax_regime: d.tax_regime ?? "IN_GST", fiscal_year_start: d.fiscal_year_start ?? "04-01" },
    currency_locked: (count ?? 0) > 0, setup_needed: setupNeeded, can_edit: gate.role === "owner" || gate.role === "admin",
  });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json() as { business_id: string; country: string; state?: string; currency: string; timezone: string; locale: string; tax_regime: string; fiscal_year_start?: string };
    const gate = await requireBusiness(req, b.business_id, { action: "lock" });
    if (gate instanceof NextResponse) return gate;

    if (!COUNTRIES.some(c => c.code === b.country)) return NextResponse.json({ error: "Choose a supported country." }, { status: 400 });
    if (!CURRENCIES.includes(b.currency)) return NextResponse.json({ error: "Choose a supported currency." }, { status: 400 });
    if (!(COUNTRY_TAX[b.country]?.regimes ?? ["NONE"]).includes(getTaxModule(b.tax_regime).id)) return NextResponse.json({ error: "That tax regime isn't available for this country." }, { status: 400 });
    try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); new Intl.NumberFormat(b.locale); } catch { return NextResponse.json({ error: "Invalid time zone or locale." }, { status: 400 }); }
    if (b.fiscal_year_start && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b.fiscal_year_start)) return NextResponse.json({ error: "Financial year start must be MM-DD." }, { status: 400 });

    const { data: cur } = await supabase.from("fw_fin_businesses").select("currency").eq("id", b.business_id).single();
    if ((cur?.currency ?? "INR") !== b.currency) {
      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", b.business_id).eq("status", "posted");
      if ((count ?? 0) > 0) return NextResponse.json({ error: "The base currency can't change once entries are posted — it would re-value every figure in your books." }, { status: 409 });
    }

    const { error } = await supabase.from("fw_fin_businesses").update({
      country: b.country, state: b.state ?? null, currency: b.currency, timezone: b.timezone, locale: b.locale,
      tax_regime: getTaxModule(b.tax_regime).id, ...(b.fiscal_year_start ? { fiscal_year_start: b.fiscal_year_start } : {}),
    }).eq("id", b.business_id);
    if (error) {
      if (needsSetup(error.message)) return NextResponse.json({ error: "Run the Phase 7 database update (2026-10-06_phase7_international.sql) first." }, { status: 409 });
      return serverError("business-settings", error, "We couldn't save your settings.");
    }
    await logAudit(supabase, { businessId: b.business_id, actor: gate.user.id, action: "settings_change", source: "settings", detail: { country: b.country, currency: b.currency, tax_regime: b.tax_regime, timezone: b.timezone, locale: b.locale } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("business-settings", e, "We couldn't save your settings.");
  }
}
