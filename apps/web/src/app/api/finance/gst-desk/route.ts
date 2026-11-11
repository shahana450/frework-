import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { monthJournals } from "@/lib/gstr1Export";
import { gstSummary } from "@/lib/gstSummary";
import { createSandboxGstProvider } from "@/lib/portals/sandbox";

// GST desk — every GST-registered business the signed-in person can open (owned, or as a team member / CA), with the
// month's figures from the books and the GSTR-1 / GSTR-3B filing status recorded from the portal. Read-only.
export const runtime = "nodejs";
export const maxDuration = 60;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FILED = ["filed", "e_verified", "processed"];

// The businesses this person can open, with a GSTIN
async function gstBusinesses(user: { id: string; email?: string | null }) {
  const [{ data: owned }, { data: member }] = await Promise.all([
    supabase.from("fw_fin_businesses").select("id,name,gstin,deleted_at").eq("owner_id", user.id),
    user.email ? supabase.from("fw_fin_team_members").select("business_id").ilike("invited_email", user.email.replace(/[\\%_]/g, c => `\\${c}`)).in("status", ["active", "pending"]) : Promise.resolve({ data: [] }),
  ]);
  const ids = ((member ?? []) as { business_id: string }[]).map(m => m.business_id).filter(id => !(owned ?? []).some(b => b.id === id));
  const { data: shared } = ids.length ? await supabase.from("fw_fin_businesses").select("id,name,gstin,deleted_at").in("id", ids) : { data: [] };
  return [...(owned ?? []), ...(shared ?? [])].filter(b => !b.deleted_at && b.gstin && String(b.gstin).trim().length === 15) as { id: string; name: string; gstin: string }[];
}

// Check filings: read every client's GSTR-1 / GSTR-3B filing status from the public GST record (no OTP) and save it
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const list = await gstBusinesses(user);
    const provider = createSandboxGstProvider();
    const now = new Date(), fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    let updated = 0; const failed: { name: string; error: string }[] = [];
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map(async b => {
        try {
          const rows = await provider.fetchStatuses(b.gstin.trim().toUpperCase(), { token: "public", expiresAt: "" }, fyStart);
          if (rows.length) {
            const { error } = await supabase.from("fw_fin_portal_status").upsert(rows.map(r => ({
              business_id: b.id, portal: "gst", kind: r.kind, form: r.form, period: r.period, status: r.status, arn: r.arn ?? null, filed_on: r.filedOn ?? null,
              amount: r.amount ?? null, details: r.details ?? {}, demo: false, fetched_at: new Date().toISOString(),
            })), { onConflict: "business_id,portal,form,period" });
            if (error) throw error;
          }
          updated++;
        } catch (e) { failed.push({ name: b.name, error: e instanceof Error ? e.message : "Couldn't read the GST record" }); }
      }));
    }
    return NextResponse.json({ ok: true, checked: list.length, updated, failed });
  } catch (e) { return serverError("gst-desk refresh", e, "Couldn't check filings right now."); }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const month = req.nextUrl.searchParams.get("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Choose a month." }, { status: 400 });
    const from = `${month}-01`, to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);

    // Businesses this person can open: owned, plus team memberships by email
    const [{ data: owned }, { data: member }] = await Promise.all([
      supabase.from("fw_fin_businesses").select("*").eq("owner_id", user.id),
      user.email ? supabase.from("fw_fin_team_members").select("business_id,role").ilike("invited_email", user.email.replace(/[\\%_]/g, c => `\\${c}`)).in("status", ["active", "pending"]) : Promise.resolve({ data: [] }),
    ]);
    const memberIds = ((member ?? []) as { business_id: string }[]).map(m => m.business_id).filter(id => !(owned ?? []).some(b => b.id === id));
    const { data: shared } = memberIds.length ? await supabase.from("fw_fin_businesses").select("*").in("id", memberIds) : { data: [] };
    const all = [...(owned ?? []), ...(shared ?? [])].filter(b => !(b as { deleted_at?: string | null }).deleted_at) as { id: string; name: string; gstin: string | null; state: string | null }[];
    const gst = all.filter(b => b.gstin && b.gstin.trim().length === 15);

    // Filing status for the month, all businesses in one read
    const { data: st } = gst.length ? await supabase.from("fw_fin_portal_status").select("business_id,form,period,status,arn,filed_on").in("business_id", gst.map(b => b.id)).eq("portal", "gst").eq("period", month).in("form", ["GSTR-1", "GSTR-3B"]) : { data: [] };
    // The latest return actually filed for each client, whatever the month
    const { data: lastRows } = gst.length ? await supabase.from("fw_fin_portal_status").select("business_id,form,period,arn,filed_on,status").in("business_id", gst.map(b => b.id)).eq("portal", "gst").in("form", ["GSTR-1", "GSTR-3B"]).in("status", FILED).order("period", { ascending: false }).limit(2000) : { data: [] };
    const lastFiled = (id: string, form: string) => { const r = ((lastRows ?? []) as { business_id: string; form: string; period: string; arn: string | null; filed_on: string | null }[]).find(x => x.business_id === id && x.form === form); return r ? { period: r.period, on: r.filed_on, arn: r.arn } : null; };
    const status = (id: string, form: string) => ((st ?? []) as { business_id: string; form: string; status: string; arn: string | null; filed_on: string | null }[]).find(s => s.business_id === id && s.form === form) ?? null;

    // Each business's month from its books — a few at a time
    const out: unknown[] = [];
    for (let i = 0; i < gst.length; i += 5) {
      const part = await Promise.all(gst.slice(i, i + 5).map(async b => {
        try {
          const rows = await monthJournals(supabase, b.id, from, to);
          const s = gstSummary(rows.map(j => ({ type: j.type, metadata: (j.metadata ?? null) as never, lines: (j.fw_fin_journal_lines ?? []).map(l => ({ account: l.fw_fin_chart_of_accounts?.name ?? "", accType: l.fw_fin_chart_of_accounts?.type ?? null, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })) })));
          const g1 = status(b.id, "GSTR-1"), g3 = status(b.id, "GSTR-3B");
          return { id: b.id, name: b.name, gstin: b.gstin, entries: rows.length, taxable: s.taxable_sales, exempt: s.nil_exempt_sales + s.non_gst_sales, output: s.output_tax, itc: s.input_credit, net: s.net_gst_payable,
            gstr1: g1 ? { status: g1.status, filed: FILED.includes(g1.status), arn: g1.arn, on: g1.filed_on } : null,
            gstr3b: g3 ? { status: g3.status, filed: FILED.includes(g3.status), arn: g3.arn, on: g3.filed_on } : null,
            last1: lastFiled(b.id, "GSTR-1"), last3: lastFiled(b.id, "GSTR-3B") };
        } catch (e) { return { id: b.id, name: b.name, gstin: b.gstin, error: e instanceof Error ? e.message : "Couldn't read the books" }; }
      }));
      out.push(...part);
    }
    return NextResponse.json({ month, businesses: out, without_gstin: all.length - gst.length });
  } catch (e) {
    return serverError("gst-desk", e, "Couldn't load the GST desk.");
  }
}
