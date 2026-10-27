"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PartyBoard from "@/components/finance/PartyBoard";
import { loadBookLines } from "@/lib/books";
import { partyBalances } from "@/lib/partyBalances";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { msmeReport, type MsmeReport, type MsmeSupplier } from "@/lib/msme43bh";
import MsmePanel from "./MsmePanel";

type APEntry = {
  contact_id: string | null;
  contact_name: string;
  bill_count: number;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  oldest_bill: string;
  days_pending: number;
};

export default function PayablesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [entries, setEntries] = useState<APEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [msme, setMsme] = useState<{ report: MsmeReport | null; setup: boolean; marked: number }>({ report: null, setup: false, marked: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      await loadPayables(saved);
    });
  }, []);

  // B2 — one ledger per supplier: balances, FIFO ageing and advances paid come from the ledgers themselves
  async function loadPayables(bid: string) {
    setLoading(true);
    const today = new Date().toLocaleDateString("en-CA");
    const { lines, accounts } = await loadBookLines(supabase, bid, today);
    const report = partyBalances("payable", accounts, lines, today);
    const result: APEntry[] = report.rows.map(r => {
      const own = lines.filter(l => l.account_id === r.id);
      return {
        contact_id: r.id, contact_name: r.name,
        bill_count: own.filter(l => l.cr > 0).length,
        total_billed: own.reduce((s, l) => s + l.cr, 0), total_paid: own.reduce((s, l) => s + l.dr, 0),
        outstanding: r.balance, oldest_bill: r.oldest ?? "", days_pending: r.days,
      };
    });
    setEntries(result);
    setTotalOutstanding(report.total);
    setOverdueAmount(result.filter(e => e.outstanding > 0 && e.days_pending > 30).reduce((s, e) => s + e.outstanding, 0));
    // Section 43B(h): MSME suppliers (marked in Customers & Suppliers) matched to their ledgers by name
    const { data: cs, error: ce } = await supabase.from("fw_fin_contacts").select("name,msme_type,msme_written_terms,credit_days").eq("business_id", bid).not("msme_type", "is", null);
    if (ce) setMsme({ report: null, setup: /msme|column/i.test(ce.message), marked: 0 });
    else {
      const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const byName = new Map(((cs ?? []) as { name: string; msme_type: MsmeSupplier["type"]; msme_written_terms: boolean; credit_days: number | null }[]).map(x => [key(x.name), x]));
      const sups: MsmeSupplier[] = accounts.filter(a => byName.has(key(a.name))).map(a => { const x = byName.get(key(a.name))!; return { accountId: a.id, name: a.name, type: x.msme_type, creditDays: x.msme_written_terms ? x.credit_days : null }; });
      setMsme({ report: msmeReport(sups, lines, today), setup: false, marked: (cs ?? []).length });
    }
    setLoading(false);
  }

  return (
    <PartyBoard kind="payable" loading={loading} total={totalOutstanding} overdue={overdueAmount} newHref="/finance/purchases/new" cardAction="Record payment"
      cardHref={() => "/finance/journals/new"}
      notice={!loading ? <MsmePanel report={msme.report} setupNeeded={msme.setup} marked={msme.marked} /> : null}
      rows={entries.map(e => ({ id: e.contact_id, name: e.contact_name, count: e.bill_count, billed: e.total_billed, settled: e.total_paid, outstanding: e.outstanding, oldest: e.oldest_bill, days: e.days_pending }))} />
  );
}
