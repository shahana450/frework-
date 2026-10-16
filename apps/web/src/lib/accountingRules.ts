import { IN_GST, type TaxModule } from "./tax";
// Deterministic accounting rules. The AI describes WHAT happened (an Intent);
// these rules decide the debit/credit lines and compute tax. No AI-written amounts reach the books.

export type Action =
  | "expense_payment" | "purchase" | "asset_purchase" | "sale" | "receipt_from_customer" | "payment_to_supplier"
  | "capital_introduced" | "drawings" | "bank_transfer" | "loan_received" | "loan_repayment" | "salary_payment"
  | "interest_income" | "other_income" | "gst_payment" | "tds_payment" | "advance_to_supplier" | "advance_from_customer"
  | "journal_adjustment";

export const ACTIONS: Action[] = [
  "expense_payment", "purchase", "asset_purchase", "sale", "receipt_from_customer", "payment_to_supplier",
  "capital_introduced", "drawings", "bank_transfer", "loan_received", "loan_repayment", "salary_payment",
  "interest_income", "other_income", "gst_payment", "tds_payment", "advance_to_supplier", "advance_from_customer",
  "journal_adjustment",
];

export type Intent = {
  action: Action;
  amount: number;                                  // the amount the user/document states
  payment_mode: "cash" | "bank" | "credit" | null; // credit = not yet paid / received
  payment_account: string | null;                  // bank or cash ledger, or the source bank for transfers
  counter_account: string | null;                  // expense / income / asset / loan / target bank ledger
  party_name: string | null;
  gst?: { applicable: boolean; rate: number; inclusive: boolean; supply: "intra" | "inter" | null } | null;
  // amount: TDS stated in money; amount_is_net: the main amount is what was actually paid/received after TDS
  tds?: { applicable: boolean; section: string | null; rate: number; amount?: number | null; amount_is_net?: boolean | null } | null;
  manual_lines?: { account: string; debit: number; credit: number }[] | null; // journal_adjustment only
  splits?: { account: string; amount: number; date?: string | null }[] | null;  // several expense heads paid together (one line each)
  currency?: string | null;                        // transaction currency when not the base currency
  exchange_rate?: number | null;                   // base units per 1 unit of `currency` — never guessed
};
// taxRegistered: false for an Indian business with no GSTIN — it can neither claim input GST nor charge GST
export type RuleContext = { tax?: TaxModule; baseCurrency?: string; taxRegistered?: boolean };

export type RuleLine = { account: string; debit: number; credit: number; role: string; suggested_type: string | null; fc_debit?: number; fc_credit?: number };
export type RuleResult = {
  lines: RuleLine[];
  rule: string;                                    // plain description of the rule applied
  gst: { applicable: boolean; rate: number; taxable_value: number; cgst: number; sgst: number; igst: number; transaction_type: "intra" | "inter" | null };
  tds: { applicable: boolean; section: string | null; rate: number; amount: number; net_payment: number };
  missing: string[];                               // facts the rules still need (asked as a question)
  warnings: string[];
  fx?: { currency: string; rate: number; base_currency: string } | null;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const DEFAULT_LEDGERS = {
  cash: "Cash in Hand", debtors: "Debtors Control", creditors: "Creditors Control", capital: "Capital Account",
  drawings: "Drawings", salary: "Salary & Wages", sales: "Sales", purchases: "Purchases", gstPayable: "GST Payable",
  tdsPayable: "TDS Payable", tdsReceivable: "TDS Receivable", interest: "Interest Received", otherIncome: "Other Income",
  advanceToSupplier: "Advance to Suppliers", advanceFromCustomer: "Advance from Customers",
  inCgst: "Input CGST", inSgst: "Input SGST", inIgst: "Input IGST", outCgst: "Output CGST", outSgst: "Output SGST", outIgst: "Output IGST",
};

/** India GST split in the CGST/SGST/IGST shape (delegates to the India tax module). */
export function computeGst(amount: number, rate: number, inclusive: boolean, supply: "intra" | "inter" | null) {
  const s = IN_GST.split(amount, rate, inclusive, supply);
  const of = (code: string) => s.components.find(c => c.code === code)?.amount ?? 0;
  return { taxable: s.taxable, cgst: of("CGST"), sgst: of("SGST"), igst: of("IGST"), gross: s.gross };
}

const DR = (account: string, amount: number, role: string, suggested_type: string | null = null): RuleLine => ({ account, debit: r2(amount), credit: 0, role, suggested_type });
const CR = (account: string, amount: number, role: string, suggested_type: string | null = null): RuleLine => ({ account, debit: 0, credit: r2(amount), role, suggested_type });

/** Builds the entry in the transaction currency, then converts every line to the base currency. */
export function buildEntry(intent: Intent, ctx: RuleContext = {}): RuleResult {
  const base = (ctx.baseCurrency ?? "INR").toUpperCase();
  const cur = intent.currency?.toUpperCase().trim() || null;
  const r = buildLocal(intent, ctx.tax ?? IN_GST, ctx.taxRegistered !== false);
  if (!cur || cur === base) return { ...r, fx: null };
  const rate = Number(intent.exchange_rate) || 0;
  if (!(rate > 0)) return { ...r, missing: [...r.missing, "exchange_rate"], fx: null };
  // Convert each line; any rounding difference goes to the largest credit so the entry balances in base currency
  const lines = r.lines.map(l => ({ ...l, fc_debit: l.debit, fc_credit: l.credit, debit: r2(l.debit * rate), credit: r2(l.credit * rate) }));
  const diff = r2(lines.reduce((s, l) => s + l.debit, 0) - lines.reduce((s, l) => s + l.credit, 0));
  if (diff !== 0) { const big = lines.filter(l => l.credit > 0).sort((a, b) => b.credit - a.credit)[0]; if (big) big.credit = r2(big.credit + diff); }
  const conv = (n: number) => r2(n * rate);
  return {
    ...r, lines,
    gst: { ...r.gst, taxable_value: conv(r.gst.taxable_value), cgst: conv(r.gst.cgst), sgst: conv(r.gst.sgst), igst: conv(r.gst.igst) },
    tds: { ...r.tds, amount: conv(r.tds.amount), net_payment: conv(r.tds.net_payment) },
    rule: `${r.rule} · ${cur} at ${rate} = ${base}`,
    fx: { currency: cur, rate, base_currency: base },
  };
}

function buildLocal(intent: Intent, tax: TaxModule, registered = true): RuleResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  let stated = r2(intent.amount);
  // Not GST-registered: no input credit and no GST charged. A purchase or expense is booked at the full amount
  // paid (GST becomes part of the cost); a sale is booked at the amount received, with no output GST.
  if (!registered && intent.gst?.applicable && (intent.gst.rate ?? 0) > 0 && tax.taxName && stated > 0) {
    const g0 = intent.gst;
    const full = tax.split(stated, g0.rate ?? 0, g0.inclusive ?? true, g0.supply ?? "intra").gross;
    const selling = intent.action === "sale" || intent.action === "receipt_from_customer";
    if (!selling) { warnings.push(`Not GST-registered: the ${tax.taxName} of ₹${r2(full - (g0.inclusive ?? true ? tax.split(stated, g0.rate ?? 0, true, g0.supply ?? "intra").taxable : stated))} is part of the cost — no input credit.`); stated = r2(full); }
    else warnings.push(`Not GST-registered: no ${tax.taxName} is charged on this sale.${g0.inclusive === false ? " Recorded at the amount without GST." : ""}`);
    intent = { ...intent, gst: { ...g0, applicable: false } };
  }
  if (!(stated > 0)) missing.push("amount");

  const credit = intent.payment_mode === "credit";
  const settle = intent.payment_mode === "cash" ? (intent.payment_account || DEFAULT_LEDGERS.cash) : intent.payment_account;
  if (!credit && !settle && intent.action !== "journal_adjustment") missing.push("payment_account");

  const g = intent.gst?.applicable && (intent.gst.rate ?? 0) > 0 && tax.taxName ? intent.gst : null;
  if (intent.gst?.applicable && !tax.taxName) warnings.push("Tax was mentioned, but this business has no tax module — recorded at the gross amount.");

  // TDS can be given as a rate ("10% TDS") or an amount ("TDS 5,000"). When the stated amount is what was
  // actually paid/received after TDS ("paid 45,000 after deducting 5,000"), the expense/income is grossed up.
  if (intent.tds?.applicable && !tax.withholding) warnings.push("Withholding tax was mentioned, but this business has no withholding module — not applied.");
  const wh = intent.tds?.applicable && tax.withholding ? intent.tds : null;
  const fixedTds = wh && Number(wh.amount) > 0 ? r2(Number(wh.amount)) : 0;
  let tdsRate = wh ? Number(wh.rate) || 0 : 0;
  let amount = stated;
  if (wh?.amount_is_net) {
    if (fixedTds) amount = r2(stated + fixedTds);
    else if (tdsRate > 0 && tdsRate < 100 && !g) amount = r2(stated / (1 - tdsRate / 100));
  }

  const split = tax.split(amount, g?.rate ?? 0, g?.inclusive ?? true, g?.supply ?? "intra");
  const comp = (code: string) => split.components.find(c => c.code === code)?.amount ?? 0;
  const gst = { taxable: split.taxable, gross: split.gross, cgst: comp("CGST"), sgst: comp("SGST"), igst: comp("IGST") };
  const tdsPayable = tax.withholding?.payableLedger ?? DEFAULT_LEDGERS.tdsPayable;
  const tdsReceivable = tax.withholding?.receivableLedger ?? DEFAULT_LEDGERS.tdsReceivable;
  const tdsAmt = fixedTds || (tdsRate > 0 ? r2(gst.taxable * tdsRate / 100) : 0);
  if (fixedTds && !tdsRate && gst.taxable > 0) tdsRate = r2(fixedTds / gst.taxable * 100);
  if (tdsAmt >= gst.gross && tdsAmt > 0) warnings.push("TDS is equal to or more than the whole amount — check the figures.");

  const gstOut = { applicable: !!g, rate: g?.rate ?? 0, taxable_value: gst.taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, transaction_type: g ? (g.supply ?? "intra") : null } as RuleResult["gst"];
  const tdsOut = (net: number) => ({ applicable: tdsAmt > 0, section: intent.tds?.section ?? null, rate: tdsRate, amount: tdsAmt, net_payment: r2(net) });
  const party = intent.party_name?.trim() || null;
  const counter = intent.counter_account?.trim() || null;
  const lines: RuleLine[] = [];
  let rule = "";

  const inputTax = () => { for (const t of split.components) if (t.amount) lines.push(DR(t.inputLedger, t.amount, `Input ${t.code}`, "asset")); };
  const outputTax = () => { for (const t of split.components) if (t.amount) lines.push(CR(t.outputLedger, t.amount, `Output ${t.code}`, "liability")); };
  const needCounter = (label: string) => { if (!counter) missing.push(label); return counter ?? ""; };
  // A customer/supplier is its own ledger (under Sundry Debtors / Creditors). A control-ledger name from the model is ignored.
  const isControl = (s: string | null) => !!s && /\b(debtors?|creditors?|receivables?|payables?)\b.*\bcontrol\b|^sundry (debtors|creditors)$|^(debtors|creditors)$/i.test(s.trim());
  const partyLedger = (side: "customer" | "supplier") => {
    const p = party ?? (counter && !isControl(counter) ? counter : null);
    if (!p) { missing.push(side === "customer" ? "customer" : "supplier"); return ""; }
    return p;
  };

  switch (intent.action) {
    case "expense_payment":
    case "purchase":
    case "asset_purchase": {
      // Several heads paid together ("wages 1000, salary 2500, cleaning 3200 in cash"): one debit line each
      const parts = (intent.splits ?? []).filter(s => s.account?.trim() && Number(s.amount) > 0);
      if (parts.length >= 2 && !g && !tdsAmt) {
        const type = intent.action === "asset_purchase" ? "asset" : "expense";
        const total = r2(parts.reduce((s, p) => s + Number(p.amount), 0));
        for (const p of parts) lines.push(DR(p.account.trim(), Number(p.amount), intent.action === "asset_purchase" ? "Asset" : "Expense", type));
        const supplier = credit ? partyLedger("supplier") : "";
        lines.push(credit ? CR(supplier, total, `Payable to ${supplier || "supplier"}`, "creditors") : CR(settle ?? "", total, "Paid from", "asset"));
        if (stated > 0 && Math.abs(stated - total) > 0.5) warnings.push(`The items add up to ${total}, not ${stated} — the entry uses the items.`);
        rule = `${parts.length} expenses paid together: Dr ${parts.map(p => p.account.trim()).join(", ")} — Cr ${credit ? `${supplier || "supplier"} (unpaid)` : settle}`;
        return { lines, rule, gst: gstOut, tds: tdsOut(total), missing: missing.filter(m => m !== "amount"), warnings };
      }
      const acc = intent.action === "purchase" ? (counter || DEFAULT_LEDGERS.purchases) : needCounter(intent.action === "asset_purchase" ? "asset_account" : "expense_account");
      const type = intent.action === "asset_purchase" ? "asset" : "expense";
      lines.push(DR(acc, gst.taxable, intent.action === "asset_purchase" ? "Asset" : intent.action === "purchase" ? "Purchases" : "Expense", type));
      inputTax();
      if (tdsAmt) lines.push(CR(tdsPayable, tdsAmt, `TDS ${intent.tds?.section ?? ""}`.trim(), "liability"));
      const net = gst.gross - tdsAmt;
      const supplier = credit ? partyLedger("supplier") : "";
      lines.push(credit ? CR(supplier, net, `Payable to ${supplier || "supplier"}`, "creditors") : CR(settle ?? "", net, "Paid from", "asset"));
      rule = `${intent.action === "asset_purchase" ? "Asset bought" : intent.action === "purchase" ? "Purchase" : "Expense"}: Dr ${acc}${g ? " + Input GST" : ""} — Cr ${credit ? `${supplier || "supplier"} (unpaid)` : settle}${tdsAmt ? " + TDS Payable" : ""}`;
      return { lines, rule, gst: gstOut, tds: tdsOut(net), missing, warnings };
    }
    case "sale": {
      const acc = counter && !isControl(counter) ? counter : DEFAULT_LEDGERS.sales;
      if (tdsAmt) lines.push(DR(tdsReceivable, tdsAmt, "TDS deducted by customer", "asset"));
      const customer = credit ? partyLedger("customer") : "";
      lines.push(credit ? DR(customer, gst.gross - tdsAmt, `Receivable from ${customer || "customer"}`, "debtors") : DR(settle ?? "", gst.gross - tdsAmt, "Received into", "asset"));
      lines.push(CR(acc, gst.taxable, "Sales", "income"));
      outputTax();
      rule = `Sale: Dr ${credit ? `${customer || "customer"} (not yet received)` : settle} — Cr ${acc}${g ? " + Output GST" : ""}`;
      return { lines, rule, gst: gstOut, tds: tdsOut(gst.gross - tdsAmt), missing, warnings };
    }
    case "receipt_from_customer":
      // Customer paid the invoice after deducting TDS: the TDS is a credit we claim against our own tax
      lines.push(DR(settle ?? "", amount - tdsAmt, "Received into", "asset"));
      if (tdsAmt) lines.push(DR(tdsReceivable, tdsAmt, "TDS deducted by customer", "asset"));
      { const customer = partyLedger("customer");
        lines.push(CR(customer, amount, `From ${customer || "customer"} — on account / advance unless matched to an invoice`, "debtors"));
        rule = `Customer receipt (on account): Dr ${settle}${tdsAmt ? " + TDS Receivable" : ""} — Cr ${customer || "customer"}`; }
      break;
    case "payment_to_supplier":
      // Paying a bill after deducting TDS: the TDS is owed to the government
      const supplierPaid = partyLedger("supplier");
      lines.push(DR(supplierPaid, amount, `To ${supplierPaid || "supplier"} — on account unless matched to a bill`, "creditors"));
      if (tdsAmt) lines.push(CR(tdsPayable, tdsAmt, `TDS ${intent.tds?.section ?? ""}`.trim(), "liability"));
      lines.push(CR(settle ?? "", amount - tdsAmt, "Paid from", "asset"));
      rule = `Supplier payment (on account): Dr ${supplierPaid || "supplier"} — Cr ${settle}${tdsAmt ? " + TDS Payable" : ""}`;
      break;
    case "advance_to_supplier":
      lines.push(DR(counter || DEFAULT_LEDGERS.advanceToSupplier, amount, "Advance paid", "asset"), CR(settle ?? "", amount, "Paid from", "asset"));
      rule = `Advance paid: Dr ${counter || DEFAULT_LEDGERS.advanceToSupplier} — Cr ${settle}`;
      break;
    case "advance_from_customer":
      lines.push(DR(settle ?? "", amount - tdsAmt, "Received into", "asset"));
      if (tdsAmt) lines.push(DR(tdsReceivable, tdsAmt, "TDS deducted by customer", "asset"));
      lines.push(CR(counter || DEFAULT_LEDGERS.advanceFromCustomer, amount, "Advance received", "liability"));
      rule = `Advance received: Dr ${settle}${tdsAmt ? " + TDS Receivable" : ""} — Cr ${counter || DEFAULT_LEDGERS.advanceFromCustomer}`;
      break;
    case "capital_introduced":
      lines.push(DR(settle ?? "", amount, "Received into", "asset"), CR(counter || DEFAULT_LEDGERS.capital, amount, "Capital", "equity"));
      rule = `Capital introduced: Dr ${settle} — Cr ${counter || DEFAULT_LEDGERS.capital}`;
      break;
    case "drawings":
      lines.push(DR(counter || DEFAULT_LEDGERS.drawings, amount, "Drawings", "equity"), CR(settle ?? "", amount, "Paid from", "asset"));
      rule = `Owner drawings: Dr ${counter || DEFAULT_LEDGERS.drawings} — Cr ${settle}`;
      break;
    case "bank_transfer": {
      const to = needCounter("destination_account");
      if (to && settle && to.toLowerCase() === settle.toLowerCase()) warnings.push("Transfer to the same account has no effect.");
      lines.push(DR(to, amount, "Transferred to", "asset"), CR(settle ?? "", amount, "Transferred from", "asset"));
      rule = `Transfer: Dr ${to} — Cr ${settle}`;
      break;
    }
    case "loan_received": {
      const loan = needCounter("loan_account");
      lines.push(DR(settle ?? "", amount, "Received into", "asset"), CR(loan, amount, "Loan", "liability"));
      rule = `Loan received: Dr ${settle} — Cr ${loan}`;
      break;
    }
    case "loan_repayment": {
      const loan = needCounter("loan_account");
      lines.push(DR(loan, amount, "Loan repaid", "liability"), CR(settle ?? "", amount, "Paid from", "asset"));
      rule = `Loan repayment: Dr ${loan} — Cr ${settle}`;
      break;
    }
    case "salary_payment": {
      const acc = counter || DEFAULT_LEDGERS.salary;
      lines.push(DR(acc, amount, "Salary", "expense"));
      if (tdsAmt) lines.push(CR(tdsPayable, tdsAmt, "TDS on salary", "liability"));
      lines.push(CR(settle ?? "", amount - tdsAmt, "Paid from", "asset"));
      rule = `Salary: Dr ${acc} — Cr ${settle}${tdsAmt ? " + TDS Payable" : ""}`;
      return { lines, rule, gst: gstOut, tds: tdsOut(amount - tdsAmt), missing, warnings };
    }
    case "interest_income":
    case "other_income": {
      const acc = counter || (intent.action === "interest_income" ? DEFAULT_LEDGERS.interest : DEFAULT_LEDGERS.otherIncome);
      // Bank interest, rent or fees received net of TDS: book the full income and the TDS as receivable
      lines.push(DR(settle ?? "", amount - tdsAmt, "Received into", "asset"));
      if (tdsAmt) lines.push(DR(tdsReceivable, tdsAmt, "TDS deducted by payer", "asset"));
      lines.push(CR(acc, amount, "Income", "income"));
      rule = `Income: Dr ${settle}${tdsAmt ? " + TDS Receivable" : ""} — Cr ${acc}`;
      break;
    }
    case "gst_payment":
    case "tds_payment": {
      const acc = counter || (intent.action === "gst_payment" ? DEFAULT_LEDGERS.gstPayable : DEFAULT_LEDGERS.tdsPayable);
      lines.push(DR(acc, amount, "Tax paid", "liability"), CR(settle ?? "", amount, "Paid from", "asset"));
      rule = `Tax payment: Dr ${acc} — Cr ${settle}`;
      break;
    }
    case "journal_adjustment": {
      for (const l of intent.manual_lines ?? []) lines.push({ account: l.account, debit: r2(l.debit), credit: r2(l.credit), role: "Adjustment", suggested_type: null });
      if (lines.length < 2) missing.push("adjustment_lines");
      warnings.push("Adjustment lines were proposed by the AI — check each account and amount.");
      rule = "Journal adjustment (lines proposed by AI, checked for balance)";
      break;
    }
  }
  return { lines, rule, gst: gstOut, tds: tdsOut(amount - tdsAmt), missing, warnings };
}

/** One plain question for the first missing fact. */
export function questionFor(missing: string, intent: Intent): string {
  switch (missing) {
    case "amount": return "What was the amount?";
    case "payment_account": return intent.action === "sale" || intent.action.includes("income") || intent.action.includes("receipt") || intent.action === "capital_introduced"
      ? "How was it received? Reply cash, bank (or the bank's name), or credit if it's still to be received."
      : "How was it paid? Reply cash, bank (or the bank's name), or credit if it's not paid yet.";
    case "expense_account": return "What was this expense for (e.g. rent, travel, office supplies)?";
    case "customer": return "Which customer is this? (Name them so it goes to their own account.)";
    case "supplier": return "Which supplier is this? (Name them so it goes to their own account.)";
    case "asset_account": return "What asset was bought (e.g. computer, furniture, vehicle)?";
    case "destination_account": return "Which account was the money transferred to?";
    case "loan_account": return "Which loan is this (lender name)?";
    case "adjustment_lines": return "Which accounts should this adjustment debit and credit?";
    case "exchange_rate": return `What exchange rate should I use for ${intent.currency ?? "this currency"}? (e.g. the rate on the invoice, or your bank's rate that day)`;
    default: return "Could you give a little more detail?";
  }
}
