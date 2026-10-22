// Section 43B(h): a payment owed to a micro or small enterprise (Udyam-registered, as a supplier of goods or services)
// is deductible only in the year it is actually paid, unless it is paid within the MSMED Act limit — the agreed credit
// period, at most 45 days, or 15 days when nothing was agreed in writing. Medium enterprises and traders on
// Udyam as "trading" are outside it. Pure — no database.
export type MsmeSupplier = { accountId: string; name: string; type: "micro" | "small" | "medium" | null; creditDays: number | null };
export type MsmeLine = { account_id: string; dr: number; cr: number; date: string };
export type MsmeBill = { supplier: string; billDate: string; unpaid: number; dueDate: string; daysLeft: number; status: "overdue" | "due_soon" | "ok" };
export type MsmeReport = { bills: MsmeBill[]; overdue: number; dueSoon: number; fyEnd: string; atRiskAtFyEnd: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (iso: string, d: number) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const days = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);

/** Allowed days for a supplier: the agreed period capped at 45, or 15 when none was agreed. */
export const allowedDays = (creditDays: number | null) => creditDays && creditDays > 0 ? Math.min(45, creditDays) : 15;

/** Indian financial year end (31 March) for a date. */
export const fyEndOf = (iso: string) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return `${m >= 4 ? y + 1 : y}-03-31`; };

/**
 * Unpaid bills to micro and small suppliers, oldest paid first (payments settle the earliest bills).
 * atRiskAtFyEnd: what would be disallowed for this year if nothing more is paid before 31 March.
 */
export function msmeReport(suppliers: MsmeSupplier[], lines: MsmeLine[], today: string, soonDays = 7): MsmeReport {
  const bills: MsmeBill[] = [];
  const fyEnd = fyEndOf(today);
  let atRisk = 0;
  for (const s of suppliers) {
    if (s.type !== "micro" && s.type !== "small") continue;
    const own = lines.filter(l => l.account_id === s.accountId && l.date <= today).sort((a, b) => a.date.localeCompare(b.date));
    let paid = own.reduce((t, l) => t + (Number(l.dr) || 0), 0);
    for (const b of own.filter(l => (Number(l.cr) || 0) > 0)) {
      const amt = Number(b.cr);
      if (paid >= amt - 0.005) { paid -= amt; continue; }
      const unpaid = r2(amt - Math.max(0, paid)); paid = 0;
      const dueDate = addDays(b.date, allowedDays(s.creditDays));
      const left = days(today, dueDate);
      bills.push({ supplier: s.name, billDate: b.date, unpaid, dueDate, daysLeft: left, status: left < 0 ? "overdue" : left <= soonDays ? "due_soon" : "ok" });
      if (dueDate <= fyEnd) atRisk += unpaid;
    }
  }
  bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    bills, fyEnd,
    overdue: r2(bills.filter(b => b.status === "overdue").reduce((t, b) => t + b.unpaid, 0)),
    dueSoon: r2(bills.filter(b => b.status === "due_soon").reduce((t, b) => t + b.unpaid, 0)),
    atRiskAtFyEnd: r2(atRisk),
  };
}
