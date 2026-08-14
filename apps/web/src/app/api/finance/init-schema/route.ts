import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);

export async function POST(req: NextRequest) {
  try {
    // Verify caller is an authenticated FreWork user
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if schema already exists
    const { data: existing } = await adminSupabase
      .from("fw_fin_businesses")
      .select("id")
      .limit(1);

    if (existing !== null) {
      // Table exists — schema is already set up
      return NextResponse.json({ success: true, message: "Schema already exists" });
    }

    // Schema doesn't exist — return the SQL for the client to display
    // and instructions. The actual creation must be done via Supabase dashboard
    // since we cannot execute arbitrary DDL through the REST API without exec_sql.
    return NextResponse.json({
      success: false,
      needs_setup: true,
      message: "Schema not found. Please run the SQL in your Supabase dashboard.",
      sql_url: "/api/finance/setup-schema",
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If the error is "relation does not exist" — schema not set up
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return NextResponse.json({
        success: false,
        needs_setup: true,
        message: "Schema not found",
        sql_url: "/api/finance/setup-schema",
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
