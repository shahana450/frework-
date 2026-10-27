"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PartyBoard from "@/components/finance/PartyBoard";
import { loadBookLines } from "@/lib/books";
import { partyBalances } from "@/lib/partyBalances";
import { readActiveBusiness } from "@/lib/activeBusiness";

type AREntry = {
  contact_id: string | null;
  contact_name: string;
  invoice_count: number;
  total_invoiced: number;
  total_received: number;
  outstanding: number;
  oldest_invoice: string;
  days_overdue: number;
};

export default function ReceivablesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      await loadReceivables(saved);
    });
  }, []);

  // B2 — one ledger per customer: balances, FIFO ageing and advances come from the ledgers themselves
  async function loadReceivables(bid: string) {
    setLoading(true);
    const today = new Date().toLocaleDateString("en-CA");
    const { lines, accounts } = await loadBookLines(supabase, bid, today);
    const report = partyBalances("receivable", accounts, lines, today);
    const result: AREntry[] = report.rows.map(r => {
      const own = lines.filter(l => l.account_id === r.id);
      return {
        contact_id: r.id, contact_name: r.name,
        invoice_count: own.filter(l => l.dr > 0).length,
        total_invoiced: own.reduce((s, l) => s + l.dr, 0), total_received: own.reduce((s, l) => s + l.cr, 0),
        outstanding: r.balance, oldest_invoice: r.oldest ?? "", days_overdue: r.days,
      };
    });
    setEntries(result);
    setTotalOutstanding(report.total);
    setOverdueAmount(result.filter(e => e.outstanding > 0 && e.days_overdue > 30).reduce((s, e) => s + e.outstanding, 0));
    setLoading(false);
  }

  return (
    <PartyBoard kind="receivable" loading={loading} total={totalOutstanding} overdue={overdueAmount} newHref="/finance/sales/new" cardAction="New invoice"
      cardHref={r => `/finance/sales/new?contact=${r.id}`}
      rows={entries.map(e => ({ id: e.contact_id, name: e.contact_name, count: e.invoice_count, billed: e.total_invoiced, settled: e.total_received, outstanding: e.outstanding, oldest: e.oldest_invoice, days: e.days_overdue }))} />
  );
}
