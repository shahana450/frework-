// Account heads shared by the chart of accounts and Tally ledger creation
export type LedgerHead = { key: string; label: string; type: string; sub_type: string; tally: string };

export const LEDGER_HEADS: LedgerHead[] = [
  { key: "bank", label: "Bank Accounts", type: "asset", sub_type: "bank", tally: "Bank Accounts" },
  { key: "cash", label: "Cash-in-Hand", type: "asset", sub_type: "cash", tally: "Cash-in-Hand" },
  { key: "debtors", label: "Sundry Debtors (customers)", type: "asset", sub_type: "trade_receivables", tally: "Sundry Debtors" },
  { key: "current_asset", label: "Current Assets", type: "asset", sub_type: "current_asset", tally: "Current Assets" },
  { key: "advances", label: "Loans & Advances (Asset)", type: "asset", sub_type: "current_asset", tally: "Loans & Advances (Asset)" },
  { key: "fixed_asset", label: "Fixed Assets", type: "asset", sub_type: "fixed_asset", tally: "Fixed Assets" },
  { key: "stock", label: "Stock-in-Hand", type: "asset", sub_type: "current_asset", tally: "Stock-in-Hand" },
  { key: "capital", label: "Capital Account", type: "equity", sub_type: "capital", tally: "Capital Account" },
  { key: "creditors", label: "Sundry Creditors (suppliers)", type: "liability", sub_type: "trade_payables", tally: "Sundry Creditors" },
  { key: "duties", label: "Duties & Taxes (GST, TDS)", type: "liability", sub_type: "current_liability", tally: "Duties & Taxes" },
  { key: "current_liability", label: "Current Liabilities / Provisions", type: "liability", sub_type: "current_liability", tally: "Current Liabilities" },
  { key: "loan", label: "Loans (Liability)", type: "liability", sub_type: "long_term_liability", tally: "Loans (Liability)" },
  { key: "sales", label: "Sales Accounts", type: "income", sub_type: "revenue", tally: "Sales Accounts" },
  { key: "indirect_income", label: "Indirect Incomes", type: "income", sub_type: "indirect_income", tally: "Indirect Incomes" },
  { key: "purchase", label: "Purchase Accounts", type: "expense", sub_type: "direct_expense", tally: "Purchase Accounts" },
  { key: "direct_expense", label: "Direct Expenses", type: "expense", sub_type: "direct_expense", tally: "Direct Expenses" },
  { key: "indirect_expense", label: "Indirect Expenses", type: "expense", sub_type: "indirect_expense", tally: "Indirect Expenses" },
];
export const headByKey = (k: string) => LEDGER_HEADS.find(h => h.key === k);

const RULES: [RegExp, string][] = [
  [/accumulated depreciation|acc\.? ?dep|provision for depreciation|depreciation (reserve|fund)/, "fixed_asset"],
  [/\b(cgst|sgst|igst|utgst|gst|cess|tds|tcs)\b|duties|tax payable|professional tax/, "duties"],
  [/bank (charges|commission|fees?)|sms charges|processing (fee|charges)|interest (paid|on loan)/, "indirect_expense"],
  [/interest (received|credited|earned)|interest on (fd|deposit)|indirect income|other income|misc(ellaneous)? income/, "indirect_income"],
  [/finance (ltd|limited|co)|nbfc|capital (ltd|limited)$/, "loan"],
  [/\bbank\b|\bhdfc\b|\bicici\b|\bsbi\b|\baxis\b|kotak|federal|canara|\bpnb\b|\bod\b|overdraft/, "bank"],
  [/\bcash\b|petty/, "cash"],
  [/capital|proprietor|partner'?s? (a\/c|account|current)|drawings|owner/, "capital"],
  [/provision|outstanding|accrued|(salary|salaries|wages|rent|expenses?) payable|advance (from|received)/, "current_liability"],
  [/debtor|receivable/, "debtors"],
  [/creditor|payable/, "creditors"],
  [/\bloan\b.*(taken|from|payable)|borrowing|term loan|unsecured loan/, "loan"],
  [/advance (to|paid)|deposit|prepaid|loan (given|to)|staff advance/, "advances"],
  [/furniture|computer|laptop|machinery|plant|vehicle|equipment|building|land|fixed asset|printer|mobile phone/, "fixed_asset"],
  [/^sales?\b|\bb2[bc] ?sales?\b|^(cash|credit|local|interstate|export) ?sales?$|\bsales?\b (a\/c|account)|revenue|service income|turnover/, "sales"],
  [/interest (income|received)|discount received|commission received|rent received|other income|dividend/, "indirect_income"],
  [/^purchases?\b|purchase (a\/c|account)|raw material|stock purchase/, "purchase"],
  [/freight inward|carriage inward|wages|factory|manufacturing|power and fuel|coolie|loading|unloading|hamali/, "direct_expense"],
  [/rent|salary|salaries|electricity|telephone|internet|printing|stationery|travel|conveyance|fees|audit|repairs|maintenance|insurance|advertis|bank charges|office|depreciation|interest (paid|on)|postage|courier|fuel|staff welfare|expense|charges|cleaning|housekeeping|painting|security|sweeping|garden|pest control|water|refreshment|tea|donation|subscription|software|legal|professional|consultancy|commission paid|discount allowed|bad debts?/, "indirect_expense"],
];

// Head for a ledger name, or null when the name doesn't make it clear
export function inferHead(name: string): LedgerHead | null {
  const n = name.toLowerCase();
  for (const [re, key] of RULES) if (re.test(n)) return headByKey(key)!;
  return null;
}

// Head from an AI type hint ("expense", "asset" ...), used only as the pre-selected suggestion
export function headFromType(type: string | null | undefined): LedgerHead {
  return headByKey(({ asset: "current_asset", liability: "current_liability", equity: "capital", income: "sales", expense: "indirect_expense", debtors: "debtors", creditors: "creditors" } as Record<string, string>)[type ?? ""] ?? "indirect_expense")!;
}

// Tally group for an existing account
export function tallyGroupFor(name: string, type: string, sub_type: string | null): string {
  const bySub: Record<string, string> = {
    bank: "Bank Accounts", cash: "Cash-in-Hand", trade_receivables: "Sundry Debtors", trade_payables: "Sundry Creditors",
    fixed_asset: "Fixed Assets", capital: "Capital Account", long_term_liability: "Loans (Liability)",
    revenue: "Sales Accounts", direct_income: "Sales Accounts", indirect_income: "Indirect Incomes",
    direct_expense: "Direct Expenses", indirect_expense: "Indirect Expenses",
  };
  const inferred = inferHead(name);
  if (inferred && (inferred.type === type || !sub_type)) return inferred.tally;
  if (sub_type && bySub[sub_type]) return bySub[sub_type];
  return ({ asset: "Current Assets", liability: "Current Liabilities", equity: "Capital Account", income: "Sales Accounts", expense: "Indirect Expenses" } as Record<string, string>)[type] ?? "Suspense A/c";
}
