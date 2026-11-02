import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";

// The signed-in person's role in a business, so the app can open in view-only mode for a client.
// The server and the database enforce the role anyway — this only shapes what the screen offers.
export async function GET(req: NextRequest) {
  try {
    const gate = await requireBusiness(req, req.nextUrl.searchParams.get("business_id"));
    if (gate instanceof NextResponse) return gate;
    return NextResponse.json({ role: gate.role, canPost: can(gate.role, "post"), canManage: can(gate.role, "manage_team") });
  } catch (e) {
    return serverError("my-role", e);
  }
}
