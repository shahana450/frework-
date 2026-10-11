// How a due date reads everywhere: "due today", "due tomorrow", "due in 5 days", "overdue by 3 days".
export function dueText(daysLeft: number): string {
  const n = Math.round(daysLeft);
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  if (n > 1) return `due in ${n} days`;
  return `overdue by ${-n} day${n === -1 ? "" : "s"}`;
}
/** Short chip form: "Today", "5d", "Overdue 3d". */
export const dueChip = (daysLeft: number) => daysLeft === 0 ? "Today" : daysLeft < 0 ? `Overdue ${-daysLeft}d` : `${daysLeft}d`;

/** Per-route page titles in the finance app: "Balance Sheet · AUDIT TEST TRADERS". */
const TITLES: [RegExp, string][] = [
  [/^\/finance\/?$/, "Home"], [/^\/finance\/chat-book/, "FreBook"], [/^\/finance\/inbox/, "Smart Inbox"], [/^\/finance\/books/, "Books & Tally"],
  [/^\/finance\/journals\/new/, "New Journal"], [/^\/finance\/journals/, "Journal Entries"], [/^\/finance\/ledger/, "Ledger"],
  [/^\/finance\/receivables/, "Receivables"], [/^\/finance\/payables/, "Payables"], [/^\/finance\/banking\/history/, "Bank Transactions"],
  [/^\/finance\/banking\/import/, "Import Statement"], [/^\/finance\/banking/, "Banking"], [/^\/finance\/sales\/new/, "New Invoice"],
  [/^\/finance\/sales/, "Invoices"], [/^\/finance\/purchases\/new/, "New Bill"], [/^\/finance\/invoices/, "Invoice"],
  [/^\/finance\/gst\/returns/, "GST Returns"], [/^\/finance\/gst\/3b/, "GSTR-3B"], [/^\/finance\/gst\/annual/, "GSTR-9"],
  [/^\/finance\/gst\/itc/, "ITC Match"], [/^\/finance\/gst\/composition/, "Composition"], [/^\/finance\/gst/, "GSTR-1"],
  [/^\/finance\/tax-docs/, "Form 168 / 130"], [/^\/finance\/mis/, "MIS Report"], [/^\/finance\/tally/, "Tally"], [/^\/finance\/shelf/, "Shelf"],
  [/^\/finance\/chart-of-accounts/, "Chart of Accounts"], [/^\/finance\/opening-balances/, "Opening Balances"], [/^\/finance\/portals/, "Portal Connect"],
  [/^\/finance\/start/, "Get Started"], [/^\/finance\/settings/, "Settings"], [/^\/finance\/audit/, "Analysis & Audit"],
];
const REPORT_TAB: Record<string, string> = { trial_balance: "Trial Balance", profit_loss: "Profit & Loss", balance_sheet: "Balance Sheet", cash_flow: "Cash Flow" };
export function financeTitle(pathname: string, search: string, business: string): string {
  let t = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "";
  if (/^\/finance\/reports/.test(pathname)) t = REPORT_TAB[new URLSearchParams(search).get("tab") ?? ""] ?? "Reports";
  return [t, business || null].filter(Boolean).join(" · ") + " | FreWork";
}
