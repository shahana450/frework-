import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, mobile, email, service, source, utm_campaign, utm_medium, utm_source } = body;

    if (!name || !mobile) {
      return NextResponse.json({ error: "Name and mobile are required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.from("fw_leads").insert({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email?.trim() || null,
      service: service || null,
      source: source || "website",
      utm_campaign: utm_campaign || null,
      utm_medium: utm_medium || null,
      utm_source: utm_source || null,
      status: "new",
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save lead";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
