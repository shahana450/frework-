// The one finance menu. `accountant: true` items are hidden in Simple view, never removed.
export type NavItem = { icon: string; label: string; href: string; accountant?: boolean; badge?: "review"; india?: boolean };   // india: Indian tax only (GST, TDS, Income-tax)
export type NavGroup = { label: string; items: NavItem[] };

export const FINANCE_NAV: NavGroup[] = [
  { label: "", items: [
    { icon: "🏠", label: "Dashboard", href: "/finance" },
    { icon: "✨", label: "FreBook", href: "/finance/chat-book" },
    { icon: "📥", label: "Smart Inbox", href: "/finance/inbox" },
    { icon: "🚀", label: "Get Started", href: "/finance/start" },
  ] },
  { label: "Sales", items: [
    { icon: "🧾", label: "New Invoice", href: "/finance/sales/new" },
    { icon: "📄", label: "Invoices", href: "/finance/sales" },
    { icon: "📥", label: "Receivables", href: "/finance/receivables" },
    { icon: "📲", label: "Collect Payments", href: "/finance/collect" },
    { icon: "🔴", label: "Credit Note", href: "/finance/credit-note", accountant: true },
  ] },
  { label: "Purchases", items: [
    { icon: "📦", label: "New Bill", href: "/finance/purchases/new" },
    { icon: "📤", label: "Payables", href: "/finance/payables" },
    { icon: "🟢", label: "Debit Note", href: "/finance/debit-note", accountant: true },
    { icon: "👥", label: "Customers & Suppliers", href: "/finance/contacts" },
  ] },
  { label: "Money", items: [
    { icon: "💸", label: "Expenses", href: "/finance/expenses" },
    { icon: "💳", label: "Payments", href: "/finance/payment" },
    { icon: "🏦", label: "Banking", href: "/finance/banking" },
    { icon: "⬆", label: "Import Statement", href: "/finance/banking/import" },
    { icon: "📑", label: "Bank History", href: "/finance/banking/history", accountant: true },
    { icon: "👩‍💼", label: "Payroll", href: "/finance/payroll", accountant: true },
  ] },
  { label: "Accounting", items: [
    { icon: "📚", label: "Books & Tally Push", href: "/finance/books" },
    { icon: "📋", label: "Journal", href: "/finance/journals", accountant: true },
    { icon: "📒", label: "Ledger", href: "/finance/ledger", accountant: true },
    { icon: "⚖", label: "Trial Balance", href: "/finance/reports?tab=trial_balance", accountant: true },
    { icon: "📊", label: "Chart of Accounts", href: "/finance/chart-of-accounts", accountant: true },
    { icon: "📂", label: "Opening Balances", href: "/finance/opening-balances" },
    { icon: "🛡", label: "Audit Log", href: "/finance/audit-log", accountant: true },
  ] },
  { label: "Reports", items: [
    { icon: "📈", label: "Profit & Loss", href: "/finance/reports?tab=profit_loss" },
    { icon: "🏛", label: "Balance Sheet", href: "/finance/reports?tab=balance_sheet" },
    { icon: "💧", label: "Cash Flow", href: "/finance/reports?tab=cash_flow" },
    { icon: "🗓", label: "Monthly Recap", href: "/finance/recap" },
    { icon: "🔍", label: "Analysis & Audit", href: "/finance/audit", accountant: true },
    { icon: "🧮", label: "GST Returns", href: "/finance/gst/returns", india: true },
    { icon: "📄", label: "GSTR-1", href: "/finance/gst", india: true },
    { icon: "📄", label: "GSTR-3B", href: "/finance/gst/3b", india: true },
    { icon: "📄", label: "GSTR-9 Annual", href: "/finance/gst/annual", india: true, accountant: true },
    { icon: "📄", label: "Composition (CMP-08)", href: "/finance/gst/composition", india: true, accountant: true },
    { icon: "📑", label: "MIS Report", href: "/finance/mis" },
    { icon: "🧾", label: "ITC Match & 3B Table 4", href: "/finance/gst/itc", india: true },
    { icon: "🔄", label: "GST Reconciliation", href: "/finance/audit/gst-recon", india: true, accountant: true },
    { icon: "🔖", label: "TDS", href: "/finance/tds", india: true, accountant: true },
    { icon: "📄", label: "Form 168 / 130 (26AS / 16)", href: "/finance/tax-docs", india: true },
  ] },
  { label: "AI", items: [
    { icon: "🤖", label: "Review Queue", href: "/finance/ai-review", badge: "review" },
    { icon: "📎", label: "Upload Documents", href: "/finance/upload" },
    { icon: "🗄", label: "Shelf", href: "/finance/shelf" },
    { icon: "💡", label: "Insights", href: "/finance/insights" },
    { icon: "🛩️", label: "FreWork AI", href: "/finance/virtual-ca" },
  ] },
  { label: "Settings", items: [
    { icon: "🏢", label: "Business Details", href: "/finance/settings/business" },
    { icon: "🌍", label: "Region & Currency", href: "/finance/settings/region" },
    { icon: "🔗", label: "Integrations", href: "/finance/integrations" },
    { icon: "🏛", label: "Portal Connect", href: "/finance/portals", india: true },
    { icon: "💬", label: "WhatsApp", href: "/finance/whatsapp" },
    { icon: "📅", label: "Financial Years", href: "/finance/fy", accountant: true },
    { icon: "🫂", label: "Team & Access", href: "/finance/team" },
    { icon: "🔌", label: "Tally", href: "/finance/tally" },
    { icon: "🏢", label: "CA Dashboard", href: "/finance/ca-dashboard", accountant: true },
  ] },
];

/** Active when the path matches and, for report tabs, the tab matches too. */
export function isActive(item: NavItem, pathname: string, search: string): boolean {
  const [path, query] = item.href.split("?");
  if (path === "/finance") return pathname === "/finance";
  if (query) return pathname === path && new URLSearchParams(search).get("tab") === new URLSearchParams(query).get("tab");
  return pathname === path || (pathname.startsWith(path + "/") && !FINANCE_NAV.some(g => g.items.some(i => i.href !== item.href && i.href.split("?")[0].startsWith(path + "/") && pathname.startsWith(i.href.split("?")[0]))));
}
