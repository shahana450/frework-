import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const type = searchParams.get("type");

  let query = supabase
    .from("coworking_spaces")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (city) query = query.eq("city", city);
  if (type) query = query.contains("space_types", [type]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spaces: data });
}
