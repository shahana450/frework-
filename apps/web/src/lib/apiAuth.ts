import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { can, ROLE_LABEL, ACTION_LABEL, type Role, type Action } from "./permissions";
export type { Role, Action } from "./permissions";

// Server-only. Every finance API route that uses the service-role key must pass through here,
// because the service role bypasses row level security.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAILS = (process.env.FW_ADMIN_EMAILS ?? "admin.frework@gmail.com,auditmanagercswa@gmail.com")
  .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

/** FreWork staff (FW_ADMIN_EMAILS). */
export const isAdminEmail = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());

export type Access = { user: User; role: Role };

const deny = (status: 401 | 403, message: string) => NextResponse.json({ error: message }, { status });

/** The signed-in user from the `Authorization: Bearer <token>` header, or a 401 response. */
export async function requireUser(req: NextRequest): Promise<User | NextResponse> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return deny(401, "Please sign in again.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return deny(401, "Your session has expired. Please sign in again.");
  return data.user;
}

/**
 * Signed-in user who owns, or is a team member of, the business, and whose role allows `action`
 * (default "view"; `write: true` means "post").
 */
export async function requireBusiness(req: NextRequest, businessId: string | null | undefined, opts: { write?: boolean; action?: Action } = {}): Promise<Access | NextResponse> {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) return deny(403, "You don't have access to this business.");
  const role = await roleOf(user, businessId);
  if (!role) return deny(403, "You don't have access to this business.");
  const action: Action = opts.action ?? (opts.write ? "post" : "view");
  if (!can(role, action)) return deny(403, `Your role (${ROLE_LABEL[role]}) can't ${ACTION_LABEL[action]}. Ask the business owner for access.`);
  return { user, role };
}

/** The user's role in a business (owner, FreWork admin or team member), or null. Also used where there's no web request, e.g. WhatsApp. */
export async function roleOf(user: { id: string; email?: string | null }, businessId: string): Promise<Role | null> {
  // select(*) so this works before and after the deleted_at column exists (2026-10-20_t5_business_delete.sql)
  const { data: biz } = await admin.from("fw_fin_businesses").select("*").eq("id", businessId).maybeSingle();
  if (!biz) return null;
  if ((biz as { deleted_at?: string | null }).deleted_at) return null;   // deleted: nobody reaches it until restored or purged
  if (biz.owner_id === user.id) return "owner";
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return "admin";
  if (!user.email) return null;
  const email = user.email.replace(/[\\%_]/g, c => `\\${c}`);
  const { data: member } = await admin.from("fw_fin_team_members").select("id,role,status")
    .eq("business_id", businessId).ilike("invited_email", email).in("status", ["active", "pending"]).maybeSingle();
  if (!member) return null;
  // An invitation becomes active the first time the invited person signs in
  if (member.status === "pending") await admin.from("fw_fin_team_members").update({ status: "active" }).eq("id", member.id);
  return (member.role as Role) ?? "viewer";
}

/** Logs the technical detail with a request id and returns a plain message the user can act on. */
export function serverError(route: string, e: unknown, userMessage = "Something went wrong. Please try again.") {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(JSON.stringify({ requestId, route, error: e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e).slice(0, 500) : String(e), at: new Date().toISOString() }));
  return NextResponse.json({ error: `${userMessage} (ref ${requestId})`, request_id: requestId }, { status: 500 });
}
