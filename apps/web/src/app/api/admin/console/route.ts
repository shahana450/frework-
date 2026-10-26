import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, isAdminEmail, serverError } from "@/lib/apiAuth";

// Staff console data (/admin): users, enquiries, listings, subscriptions, leads and service requests, and the
// few changes staff make. Only signed-in staff (FW_ADMIN_EMAILS) — these tables are closed to the browser.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const LISTINGS = { workspace: "fw_workspaces", freelancer: "fw_freelancers", service: "fw_services", startup: "fw_startups" } as const;

async function staff(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "This account isn't on the staff list." }, { status: 403 });
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const u = await staff(req);
    if (u instanceof NextResponse) return u;
    const [users, enquiries, ws, fl, sv, st, subs, leads, srs] = await Promise.all([
      sb.from("fw_users").select("*").order("created_at", { ascending: false }),
      sb.from("fw_enquiries").select("*").order("created_at", { ascending: false }),
      sb.from("fw_workspaces").select("id,name,city,status,created_at,user_id").order("created_at", { ascending: false }),
      sb.from("fw_freelancers").select("id,name,city,status,created_at,user_id").order("created_at", { ascending: false }),
      sb.from("fw_services").select("id,provider_name,status,created_at,user_id").order("created_at", { ascending: false }),
      sb.from("fw_startups").select("id,company_name,city,status,created_at,user_id").order("created_at", { ascending: false }),
      sb.from("fw_subscriptions").select("*, fw_users(name, email)").order("started_at", { ascending: false }),
      sb.from("fw_leads").select("*").order("created_at", { ascending: false }),
      sb.from("fw_service_requests").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (users.error) throw users.error;
    return NextResponse.json({
      users: users.data ?? [], enquiries: enquiries.data ?? [],
      listings: { workspace: ws.data ?? [], freelancer: fl.data ?? [], service: sv.data ?? [], startup: st.data ?? [] },
      subscriptions: subs.data ?? [], leads: leads.data ?? [], serviceRequests: srs.data ?? [],
    });
  } catch (e) { return serverError("admin/console", e, "Couldn't load the staff console."); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await staff(req);
    if (u instanceof NextResponse) return u;
    const b = await req.json().catch(() => ({}));
    const id = String(b.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    if (b.action === "listing_status") {
      const table = LISTINGS[b.kind as keyof typeof LISTINGS];
      if (!table || !["active", "rejected", "pending"].includes(b.status)) return NextResponse.json({ error: "Bad listing change." }, { status: 400 });
      const { error } = await sb.from(table).update({ status: b.status }).eq("id", id);
      if (error) throw error;
    } else if (b.action === "lead_status") {
      const { error } = await sb.from("fw_leads").update({ status: String(b.status ?? "").slice(0, 40) }).eq("id", id);
      if (error) throw error;
    } else if (b.action === "sr_update") {
      const { error } = await sb.from("fw_service_requests").update({
        status: String(b.status ?? ""), admin_notes: String(b.admin_notes ?? "").slice(0, 4000),
        package_granted: b.package_granted || null, package_granted_at: b.package_granted_at ?? null,
      }).eq("id", id);
      if (error) throw error;
    } else if (b.action === "delete_user") {
      const { error } = await sb.from("fw_users").delete().eq("id", id);
      if (error) throw error;
    } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) { return serverError("admin/console", e, "That change didn't save."); }
}
