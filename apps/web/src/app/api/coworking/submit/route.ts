import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const authHeader = req.headers.get("authorization");
    let ownerId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
      ownerId = user?.id ?? null;
    }

    const { error } = await supabase.from("coworking_spaces").insert({
      owner_id: ownerId,
      space_name: body.space_name,
      city: body.city,
      address: body.address,
      pincode: body.pincode,
      space_types: body.space_types,
      price_per_day: body.price_per_day || null,
      price_per_month: body.price_per_month || null,
      total_seats: body.total_seats || null,
      amenities: body.amenities,
      description: body.description,
      opening_hours: body.opening_hours,
      website: body.website,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      contact_whatsapp: body.contact_whatsapp || body.contact_phone,
      status: "pending",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
