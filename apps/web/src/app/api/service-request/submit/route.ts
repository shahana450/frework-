import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify the user token
    const authHeader = req.headers.get("authorization");
    let userId: string | null = body.user_id ?? null;
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
      if (user) userId = user.id;
    }

    const { data, error } = await supabase
      .from("fw_service_requests")
      .insert({
        user_id: userId,
        user_email: body.user_email,
        user_phone: body.user_phone,
        service_key: body.service_key,
        service_name: body.service_name,
        notes: body.notes || null,
        status: "docs_received",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
