import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { headByKey } from "@/lib/ledgerHeads";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, postingErrorMessage } from "@/lib/posting";
import { logAudit } from "@/lib/audit";

export const maxDuration = 120;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const key = (s: string) => String(s ?? "").trim().toLowerCase();
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Bring FreWork's books in line with Tally's:
//  regroup — every FreWork ledger that has a Tally ledger of the same name takes Tally's group
//  stock   — the year's change in stock-in-hand (opening − closing) posted once, on the last day of the year
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      business_id?: string; action?: "regroup" | "stock";
      ledgers?: { name: string; head: string }[];
      fy_id?: string; stock_ledger?: string; opening?: number; closing?: number;
    };
    const bizId = body.business_id;
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;

    if (body.action === "regroup") {
      const want = new Map((body.ledgers ?? []).slice(0, 3000).map(l => [key(l.name), headByKey(l.head)]).filter(([, h]) => !!h) as [string, NonNullable<ReturnType<typeof headByKey>>][]);
      const { data: accounts, error } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type").eq("business_id", bizId!).eq("is_group", false).limit(5000);
      if (error) throw error;
      const changes: { name: string; from: string; to: string }[] = [];
      for (const a of accounts ?? []) {
        const h = want.get(key(a.name));
        if (!h || (a.type === h.type && a.sub_type === h.sub_type)) continue;
        const { error: uErr } = await supabase.from("fw_fin_chart_of_accounts").update({ type: h.type, sub_type: h.sub_type }).eq("id", a.id).eq("business_id", bizId!);
        if (uErr) throw uErr;
        changes.push({ name: a.name, from: `${a.type}/${a.sub_type ?? ""}`, to: h.label });
      }
      if (changes.length) await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "tally_regroup", source: "integration", detail: { changed: changes.length, sample: changes.slice(0, 20) } });
      return NextResponse.json({ ok: true, changed: changes.length, changes: changes.slice(0, 200) });
    }

    if (body.action === "stock") {
      const opening = r2(body.opening ?? 0), closing = r2(body.closing ?? 0), change = r2(opening - closing);
      const stockName = String(body.stock_ledger ?? "").trim();
      if (!stockName) return NextResponse.json({ error: "No stock-in-hand ledger in Tally." }, { status: 400 });
      const { data: fy } = await supabase.from("fw_fin_financial_years").select("id,label,end_date,is_locked").eq("business_id", bizId!).eq("id", body.fy_id ?? "").maybeSingle();
      if (!fy) return NextResponse.json({ error: "Choose the financial year." }, { status: 400 });
      const clientKey = `tally-stock:${fy.id}`;
      const { data: prior } = await supabase.from("fw_fin_journals").select("entry_no,total_debit").eq("business_id", bizId!).eq("metadata->>client_key", clientKey).neq("status", "voided").limit(1).maybeSingle();
      if (prior) return NextResponse.json({ ok: true, already: true, entry_no: prior.entry_no, amount: prior.total_debit });
      if (!change) return NextResponse.json({ ok: true, nothing: true });
      const CHANGE = "Change in Stock";
      const resolved = await resolveLedgers(supabase, bizId!, [{ name: stockName }, { name: CHANGE }], { [stockName]: "stock", [CHANGE]: "direct_expense" }, "Tally stock");
      if (!resolved.ok) return NextResponse.json({ error: "Couldn't set up the stock ledgers." }, { status: 422 });
      const stockId = resolved.ids.get(stockName)!.id, changeId = resolved.ids.get(CHANGE)!.id;
      const amt = Math.abs(change);
      // Stock went down → the fall is a cost (Dr Change in Stock, Cr Stock); stock went up → the reverse
      const lines = change > 0
        ? [{ accountId: changeId, dr: amt, cr: 0 }, { accountId: stockId, dr: 0, cr: amt }]
        : [{ accountId: stockId, dr: amt, cr: 0 }, { accountId: changeId, dr: 0, cr: amt }];
      const posted = await postJournal(supabase, {
        businessId: bizId!, actorId: gate.user.id, date: fy.end_date, type: "journal", source: "tally_import", force: fy.is_locked,
        narration: `Change in stock for FY ${fy.label}: opening ₹${opening.toLocaleString("en-IN")} → closing ₹${closing.toLocaleString("en-IN")} (from Tally's ${stockName})`,
        lines, metadata: { client_key: clientKey, tally_stock: { opening, closing, change, ledger: stockName } },
      });
      await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "tally_stock", source: "integration", detail: { fy: fy.label, entry_no: posted.entryNo, opening, closing, change } });
      return NextResponse.json({ ok: true, entry_no: posted.entryNo, amount: amt });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const p = postingErrorMessage(e);
    if (p.status !== 500) return NextResponse.json({ error: p.message }, { status: p.status });
    return serverError("integrations/tally/books", e, "Couldn't update the books from Tally.");
  }
}
