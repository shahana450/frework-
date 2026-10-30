import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, postingErrorMessage, PostingError } from "@/lib/posting";
import { headForTallyGroup, importEntryNo, xmlDec } from "@/lib/integrations/tally";
import { tallyVoucherTypeToFP } from "@/lib/tallyUtils";
import { inferHead } from "@/lib/ledgerHeads";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type InVoucher = { date: string; voucherType: string; voucherNumber: string; narration: string; seq?: number; lines: { ledgerName: string; amount: number; isDeemed: boolean }[] };

// Tally → FreWork. Every voucher goes through the posting engine (balance, year lock, audit log)
// and keeps Tally's number as its entry number, so importing the same voucher twice is impossible.
export async function POST(req: NextRequest) {
  try {
    let { business_id, vouchers, ledger_groups, company } = await req.json().catch(() => ({})) as {
      business_id: string; vouchers: InVoucher[]; ledger_groups?: Record<string, string>; company?: string;
    };
    const gate = await requireBusiness(req, business_id, { action: "integrate" });
    if (gate instanceof NextResponse) return gate;
    if (!Array.isArray(vouchers) || !vouchers.length) return NextResponse.json({ imported: 0, skipped: 0, failed: [] });
    if (vouchers.length > 500) return NextResponse.json({ error: "Send at most 500 vouchers per request." }, { status: 400 });

    // Vouchers FreWork pushed to Tally carry "[FW <entry-no>]" in the narration — they are already here, so never import them back
    const fwTag = (n: string) => xmlDec(n ?? "").match(/\[FW ([^\]]+)\]/)?.[1]?.trim() ?? null;
    const tagged = [...new Set(vouchers.map(v => fwTag(v.narration)).filter((x): x is string => !!x))];
    const ours = new Set<string>();
    for (let i = 0; i < tagged.length; i += 200) {
      const { data } = await supabase.from("fw_fin_journals").select("entry_no").eq("business_id", business_id).in("entry_no", tagged.slice(i, i + 200));
      for (const j of data ?? []) ours.add(j.entry_no);
    }
    const fromFreWork = vouchers.filter(v => { const t = fwTag(v.narration); return !!t && ours.has(t); }).length;
    vouchers = vouchers.filter(v => { const t = fwTag(v.narration); return !(t && ours.has(t)); });
    if (!vouchers.length) return NextResponse.json({ imported: 0, skipped: 0, from_frework: fromFreWork, failed: [] });

    // Ledger group: Tally's own group when known, else by name, else a safe holding group
    const groups = Object.fromEntries(Object.entries(ledger_groups ?? {}).map(([k, v]) => [xmlDec(k), xmlDec(v)]));
    const names = [...new Set(vouchers.flatMap(v => v.lines.map(l => xmlDec(l.ledgerName))).filter(Boolean))];
    const heads: Record<string, string> = {};
    for (const n of names) heads[n] = (groups[n] && headForTallyGroup(groups[n])?.key) || inferHead(n)?.key || "current_liability";
    const resolved = await resolveLedgers(supabase, business_id, names.map(name => ({ name })), heads, "Tally import");
    if (!resolved.ok) return NextResponse.json({ error: "Some Tally ledgers couldn't be matched." }, { status: 422 });

    let imported = 0, skipped = 0, repaired = 0;
    // Tally's lines → FreWork lines. Tally allows one ledger on both sides of a voucher (e.g. Salary Dr 30,000 and
    // Cr 2,000); FreWork's books don't, so each ledger is netted to one line. Lines that cancel out are dropped.
    const linesFor = (v: InVoucher) => {
      const net = new Map<string, number>();
      for (const l of v.lines) {
        const id = resolved.ids.get(xmlDec(l.ledgerName))?.id ?? "";
        net.set(id, Math.round(((net.get(id) ?? 0) + (l.isDeemed ? 1 : -1) * Math.abs(l.amount)) * 100) / 100);
      }
      return [...net].filter(([, n]) => Math.abs(n) >= 0.005).map(([accountId, n]) => ({ accountId, dr: n > 0 ? n : 0, cr: n < 0 ? -n : 0 }));
    };
    const failed: { voucher: string; error: string }[] = [];
    // Number every voucher first (stable TLY-… numbers), then skip the ones already imported in one query
    const seq = new Map<string, number>();
    const todo = vouchers.map(v => {
      const k = `${v.voucherType}|${v.date}`;
      const n = (seq.get(k) ?? 0) + 1; seq.set(k, n);
      return { v, entryNo: importEntryNo(v, Number.isInteger(v.seq) && v.seq! > 0 ? v.seq! : n) };   // the browser's count covers every batch
    });
    const have = new Map<string, { id: string; total: number }>();
    for (let i = 0; i < todo.length; i += 300) {
      const { data } = await supabase.from("fw_fin_journals").select("id,entry_no,total_debit").eq("business_id", business_id).in("entry_no", todo.slice(i, i + 300).map(t => t.entryNo));
      for (const j of data ?? []) have.set(j.entry_no, { id: j.id, total: Number(j.total_debit) || 0 });
    }
    // Already imported: check its lines still say what Tally says (an earlier import may have used the wrong ledger,
    // or a failed clear may have left it empty) and put Tally's lines back when they don't. Totals never change.
    const old = todo.filter(t => have.has(t.entryNo));
    const sig = (ls: { accountId: string; dr: number; cr: number }[]) => ls.map(l => `${l.accountId}:${l.dr.toFixed(2)}:${l.cr.toFixed(2)}`).sort().join("|");
    for (let i = 0; i < old.length; i += 100) {
      const chunk = old.slice(i, i + 100);
      const ids = chunk.map(t => have.get(t.entryNo)!.id);
      const cur = new Map<string, { accountId: string; dr: number; cr: number }[]>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("fw_fin_journal_lines").select("id,journal_id,account_id,dr_amount,cr_amount").in("journal_id", ids).order("id").range(from, from + 999);
        if (error) throw error;
        for (const l of data ?? []) { const a = cur.get(l.journal_id) ?? []; a.push({ accountId: l.account_id, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 }); cur.set(l.journal_id, a); }
        if (!data || data.length < 1000) break;
      }
      for (const t of chunk) {
        const j = have.get(t.entryNo)!, want = linesFor(t.v);
        if (!want.length || want.some(l => !l.accountId) || sig(want) === sig(cur.get(j.id) ?? [])) { skipped++; continue; }
        const total = Math.round(want.reduce((s, l) => s + l.dr, 0) * 100) / 100;
        if (Math.abs(total - j.total) >= 0.01) { skipped++; failed.push({ voucher: t.entryNo.replace(/^TLY-/, ""), error: "Amount changed in Tally — clear Tally imports and import again" }); continue; }
        const d = await supabase.from("fw_fin_journal_lines").delete().eq("journal_id", j.id);
        if (d.error) { failed.push({ voucher: t.entryNo.replace(/^TLY-/, ""), error: d.error.message }); continue; }
        const ins = await supabase.from("fw_fin_journal_lines").insert(want.map((l, k) => ({ journal_id: j.id, account_id: l.accountId, dr_amount: l.dr, cr_amount: l.cr, narration: (xmlDec(t.v.narration) || t.entryNo).slice(0, 200), sort_order: k + 1 })));
        if (ins.error) failed.push({ voucher: t.entryNo.replace(/^TLY-/, ""), error: ins.error.message }); else repaired++;
      }
    }
    // Post the rest several at a time — each voucher is still atomic and keeps its own number
    const fresh = todo.filter(t => !have.has(t.entryNo));
    const CONCURRENCY = 8;
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      await Promise.all(fresh.slice(i, i + CONCURRENCY).map(async ({ v, entryNo }) => {
        const lines = linesFor(v);
        if (!lines.length) { skipped++; return; }   // the voucher cancels itself out — nothing to post
        try {
          await postJournal(supabase, {
            businessId: business_id, actorId: gate.user.id, date: String(v.date).slice(0, 10), type: tallyVoucherTypeToFP(v.voucherType),
            narration: xmlDec(v.narration) || entryNo, referenceNo: v.voucherNumber || null, source: "tally_import", entryNo,
            lines, metadata: { tally: { voucher_type: v.voucherType, voucher_number: v.voucherNumber, company: company ?? null } },
          });
          imported++;
        } catch (e) {
          if (e instanceof PostingError && e.code === "DUPLICATE") { skipped++; return; }
          failed.push({ voucher: entryNo.replace(/^TLY-/, ""), error: postingErrorMessage(e).message });
        }
      }));
    }    if (imported || repaired) await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "tally_import", source: "integration", detail: { imported, repaired, skipped, from_frework: fromFreWork, failed: failed.length, company: company ?? null, new_ledgers: resolved.created.length } });
    return NextResponse.json({ imported, repaired, skipped, from_frework: fromFreWork, failed: failed.slice(0, 50), failed_count: failed.length, created_ledgers: resolved.created });
  } catch (e) {
    return serverError("integrations/tally/import", e, "We couldn't import from Tally. Please try again.");
  }
}
