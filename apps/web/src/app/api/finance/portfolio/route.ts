import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { loadQueryBooks, loadBusinessContext } from "@/lib/intentEngine";
import { computeDashboard } from "@/lib/dashboard";
import { markFiled, type FetchedStatus } from "@/lib/portals/match";

// All businesses on one screen: every business this person can open (owned, or as a team member / CA) with the same
// figures as each business's Home — cash & bank, receivables, payables, this year's profit, drafts, the next due date,
// overdue filings and the last GST returns filed. Read-only.
export const runtime = "nodejs";
export const maxDuration = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FILED = ["filed", "e_verified", "processed"];

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const [{ data: owned }, { data: member }] = await Promise.all([
      sb.from("fw_fin_businesses").select("*").eq("owner_id", user.id),
      user.email ? sb.from("fw_fin_team_members").select("business_id,role").ilike("invited_email", user.email.replace(/[\\%_]/g, c => `\\${c}`)).in("status", ["active", "pending"]) : Promise.resolve({ data: [] }),
    ]);
    const roleOf = new Map(((member ?? []) as { business_id: string; role: string }[]).map(m => [m.business_id, m.role]));
    const memberIds = [...roleOf.keys()].filter(id => !(owned ?? []).some(b => b.id === id));
    const { data: shared } = memberIds.length ? await sb.from("fw_fin_businesses").select("*").in("id", memberIds) : { data: [] };
    const all = [...(owned ?? []), ...(shared ?? [])].filter(b => !(b as { deleted_at?: string | null }).deleted_at) as Record<string, unknown>[];
    if (!all.length) return NextResponse.json({ businesses: [] });
    // ?list=1 → just the businesses, at once; ?id=… → one business's figures (the page loads them in parallel)
    const sp = req.nextUrl.searchParams;
    if (sp.get("list")) return NextResponse.json({ businesses: all.map(b => ({ id: b.id, name: b.name, gstin: (b.gstin as string) ?? null, role: b.owner_id === user.id ? "owner" : roleOf.get(b.id as string) ?? "member" })) });
    const only = sp.get("id");
    if (only && !all.some(b => b.id === only)) return NextResponse.json({ error: "Not your business." }, { status: 403 });
    const pick = only ? all.filter(b => b.id === only) : all;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const ids = pick.map(b => b.id as string);
    const [fys, drafts, pending, portal] = await Promise.all([
      sb.from("fw_fin_financial_years").select("business_id,label,start_date,end_date").in("business_id", ids).lte("start_date", today).gte("end_date", today),
      sb.from("fw_fin_journals").select("business_id").in("business_id", ids).eq("status", "draft").limit(5000),
      sb.from("fw_fin_ai_suggestions").select("business_id").in("business_id", ids).eq("status", "pending").limit(5000),
      sb.from("fw_fin_portal_status").select("business_id,portal,form,period,status,arn,filed_on,demo").in("business_id", ids).in("kind", ["return", "itr"]).order("period", { ascending: false }).limit(5000),
    ]);
    const count = (rows: { business_id: string }[] | null, id: string) => (rows ?? []).filter(r => r.business_id === id).length;
    type P = FetchedStatus & { business_id: string; form: string; period: string; status: string; arn: string | null; filed_on: string | null };
    const portalRows = (portal.error ? [] : portal.data ?? []) as P[];
    const lastFiled = (id: string, form: string) => { const r = portalRows.find(x => x.business_id === id && x.form === form && FILED.includes(x.status)); return r ? { period: r.period, on: r.filed_on, arn: r.arn } : null; };

    const one = async (b: Record<string, unknown>) => {
      const id = b.id as string;
      try {
        const fy = (fys.data ?? []).find(f => f.business_id === id);
        const y = today.slice(5) >= "04-01" ? +today.slice(0, 4) : +today.slice(0, 4) - 1;
        const period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${String(fy.label).replace(/^FY\s*/i, "")}` } : { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` };
        const [books, ctx] = await Promise.all([loadQueryBooks(sb, id, [period.to, today].sort().pop()!), loadBusinessContext(sb, id)]);
        if (books.error) throw new Error("Couldn't read the books");
        const d = computeDashboard(books.accounts, books.journals, today, period, { pendingReview: count(pending.data as never, id), drafts: count(drafts.data as never, id), business: { gstin: (b.gstin as string) ?? null, tan: (b.tan as string) ?? null, audit: !!b.tax_audit, state: (b.state as string) ?? null, country: (b.country as string) ?? "IN", fyStart: (b.fiscal_year_start as string) ?? null } }, { currency: ctx.baseCurrency, locale: "en-IN" });
        const comp = markFiled(d.compliance, portalRows.filter(r => r.business_id === id) as FetchedStatus[]);
        const open = comp.filter(c => !c.filed);
        const lastEntry = books.journals.reduce((m, j) => (j.date <= today && j.date > m ? j.date : m), "");
        return {
          id, name: b.name as string, gstin: (b.gstin as string) ?? null, role: (b.owner_id === user.id ? "owner" : roleOf.get(id) ?? "member"), period: period.label,
          cash: d.cash, receivables: d.receivables, payables: d.payables, revenue: d.revenue, expenses: d.expenses, profit: d.profit, monthRevenue: d.monthRevenue,
          drafts: count(drafts.data as never, id), pendingReview: count(pending.data as never, id), health: d.health.score, alerts: d.alerts.length, entries: books.journals.length, lastEntry: lastEntry || null,
          overdue: open.filter(c => c.daysLeft < 0).map(c => ({ title: c.title, period: c.period, due: c.due, daysLeft: c.daysLeft })),
          next: open.filter(c => c.daysLeft >= 0).slice(0, 1).map(c => ({ title: c.title, period: c.period, due: c.due, daysLeft: c.daysLeft }))[0] ?? null,
          gstr1: lastFiled(id, "GSTR-1"), gstr3b: lastFiled(id, "GSTR-3B"),
        };
      } catch (e) { return { id, name: b.name as string, gstin: (b.gstin as string) ?? null, error: e instanceof Error ? e.message : "Couldn't read the books" }; }
    };
    const out: unknown[] = [];
    for (let i = 0; i < pick.length; i += 4) out.push(...await Promise.all(pick.slice(i, i + 4).map(one)));
    return NextResponse.json({ today, businesses: out });
  } catch (e) { return serverError("portfolio", e, "Couldn't load your businesses."); }
}
