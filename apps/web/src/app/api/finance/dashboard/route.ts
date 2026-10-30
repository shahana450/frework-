import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks, loadBusinessContext } from "@/lib/intentEngine";
import { computeDashboard } from "@/lib/dashboard";
import { markFiled, type FetchedStatus } from "@/lib/portals/match";

// Runs at the edge nearest the user (Mumbai for India) — next to the database, not across the world
export const runtime = "edge";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Every figure is computed from posted entries; nothing is cached or estimated
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;

    const today = new Date().toLocaleDateString("en-CA");
    const fyId = sp.get("fy_id");
    const fyQ = fyId
      ? supabase.from("fw_fin_financial_years").select("label,start_date,end_date").eq("id", fyId).eq("business_id", bizId!).maybeSingle()
      : supabase.from("fw_fin_financial_years").select("label,start_date,end_date").eq("business_id", bizId!).lte("start_date", today).gte("end_date", today).maybeSingle();
    const [{ data: fy }, pending, drafts] = await Promise.all([
      fyQ,
      supabase.from("fw_fin_ai_suggestions").select("id", { count: "exact", head: true }).eq("business_id", bizId!).eq("status", "pending"),
      supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId!).eq("status", "draft"),
    ]);
    const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const pf = sp.get("from"), pt = sp.get("to"), iso = /^\d{4}-\d{2}-\d{2}$/;
    const custom = pf && pt && iso.test(pf) && iso.test(pt) && pf <= pt ? { from: pf, to: pt, label: (sp.get("label") ?? "").slice(0, 40) || `${pf} to ${pt}` } : null;
    const period = custom ?? (fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${fy.label.replace(/^FY\s*/i, "")}` } : { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` });

    const books = await loadQueryBooks(supabase, bizId!, [period.to, today].sort().pop()!);
    if (books.error) return serverError("dashboard", books.error, "We couldn't load your dashboard right now.");
    const biz = await loadBusinessContext(supabase, bizId!);
    const { data: bizRow } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).maybeSingle();
    const b = (bizRow ?? {}) as Record<string, unknown>;
    const dash = computeDashboard(books.accounts, books.journals, today, period, { pendingReview: pending.count ?? 0, drafts: drafts.count ?? 0, business: { gstin: (b.gstin as string) ?? null, tan: (b.tan as string) ?? null, audit: !!b.tax_audit, state: (b.state as string) ?? null, country: (b.country as string) ?? "IN", fyStart: (b.fiscal_year_start as string) ?? null } }, { currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
    // Open notices on the Shelf with a reply date join the Due dates list
    const { data: notices } = await supabase.from("fw_fin_shelf_items").select("id,title,period,reply_due,amount").eq("business_id", bizId!).is("deleted_at", null).eq("status", "open").not("reply_due", "is", null).lte("reply_due", new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
    for (const n of (notices ?? []) as { id: string; title: string; period: string | null; reply_due: string; amount: number | null }[]) {
      dash.compliance.push({ key: `notice-${n.id}`, kind: "notice", title: `Reply to ${n.title}`, period: n.period ?? "Notice", due: n.reply_due, daysLeft: Math.round((Date.parse(n.reply_due) - Date.parse(today)) / 86400000), amount: n.amount ? Number(n.amount) : null, href: "/finance/shelf?rack=notices", note: "From the Shelf — mark it replied there when done." });
    }
    dash.compliance.sort((a, b) => a.due.localeCompare(b.due));
    // Returns already filed on the GST / Income-tax portal show as Filed instead of a countdown
    const { data: filed } = await supabase.from("fw_fin_portal_status").select("portal,form,period,status,arn,filed_on,demo").eq("business_id", bizId!).in("kind", ["return", "itr"]);
    if (filed?.length) dash.compliance = markFiled(dash.compliance, filed as FetchedStatus[]);
    // Tax desk tile: latest GST / IT filing statuses from the portals + open notices on the Shelf
    const [links, latest, openNotices] = await Promise.all([
      supabase.from("fw_fin_portal_links").select("portal,identifier,status,last_sync_at,provider").eq("business_id", bizId!),
      supabase.from("fw_fin_portal_status").select("portal,kind,form,period,status,arn,filed_on,amount,demo").eq("business_id", bizId!).in("kind", ["return", "itr", "refund"]).order("period", { ascending: false }).limit(12),
      supabase.from("fw_fin_shelf_items").select("id,title,authority,reply_due,amount").eq("business_id", bizId!).is("deleted_at", null).eq("rack", "notices").eq("status", "open").order("reply_due", { ascending: true, nullsFirst: false }).limit(5),
    ]);
    const taxDesk = {
      links: links.error ? [] : links.data ?? [],
      statuses: latest.error ? [] : latest.data ?? [],
      notices: openNotices.error ? [] : openNotices.data ?? [],
    };
    return NextResponse.json({ ...dash, taxDesk });
  } catch (e) {
    return serverError("dashboard", e, "We couldn't load your dashboard right now.");
  }
}
