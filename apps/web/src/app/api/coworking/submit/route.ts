import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      space_name, city, address, pincode,
      space_types, price_per_day, price_per_month,
      total_seats, amenities, description,
      contact_name, contact_email, contact_phone, contact_whatsapp,
      opening_hours, website,
    } = body;

    if (!space_name || !city || !address || !contact_name || !contact_email || !contact_phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("coworking_spaces")
      .insert({
        space_name,
        city,
        address,
        pincode: pincode || null,
        space_types: space_types || [],
        price_per_day: price_per_day ? Number(price_per_day) : null,
        price_per_month: price_per_month ? Number(price_per_month) : null,
        total_seats: total_seats ? Number(total_seats) : null,
        amenities: amenities || [],
        description: description || null,
        contact_name,
        contact_email,
        contact_phone,
        contact_whatsapp: contact_whatsapp || contact_phone,
        opening_hours: opening_hours || null,
        website: website || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Coworking submit error:", err);
    return NextResponse.json({ error: "Failed to submit listing" }, { status: 500 });
  }
}
