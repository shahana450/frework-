// Shared "understanding" layer: the AI describes a transaction (or a question); rules and queries do the rest.
// Used by the Copilot chat and by document upload so both follow the same accounting rules.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEntry, questionFor, ACTIONS, DEFAULT_LEDGERS, type Intent } from "./accountingRules";
import { makeFinder } from "./ledgerResolve";
import type { QJournal } from "./bookQueries";
import { getTaxModule, type TaxModule } from "./tax";
// ── System prompt ──────────────────────────────────────────────────────────────
// The AI only describes what happened. lib/accountingRules.ts decides debits, credits and tax.
export const INTENT_SYSTEM = `You are the understanding layer of a small-business accounting app. You DO NOT write journal entries or debit/credit amounts — the app's accounting rules do that. Your job: read the user's message (and any attached document) and describe the transaction as structured facts. Output ONLY valid JSON, no prose, no markdown.

ACTIONS (pick exactly one):
expense_payment (rent, electricity, travel, fees, repairs…), purchase (goods for resale / raw material), asset_purchase (computer, furniture, vehicle, machinery),
sale, receipt_from_customer (money received against an earlier sale/invoice), payment_to_supplier (paying an earlier bill),
advance_to_supplier, advance_from_customer, capital_introduced, drawings, bank_transfer (between own bank/cash accounts),
loan_received, loan_repayment, salary_payment, interest_income, other_income, gst_payment, tds_payment,
journal_adjustment (ONLY for non-cash adjustments like depreciation, provisions, write-offs, corrections).

FIELDS:
- amount: the amount stated (number, no symbols). If the user says "including GST" or a bill shows a total, give the TOTAL and set gst.inclusive=true. If they say "plus GST", give the pre-tax amount and gst.inclusive=false.
- payment_mode: "cash" | "bank" | "credit" (credit = not paid/received yet) | null if unknown.
- payment_account: the exact bank/cash ledger from the account list if named or obvious (a short name the user typed → the matching full ledger name in the list; never a bank the user didn't name); for cash use the cash ledger; null if not stated. For bank_transfer this is the SOURCE account.
- counter_account: the other ledger — the expense, income, asset, loan or destination-bank ledger. Use an existing ledger from the list when it fits the nature of the transaction; otherwise propose a specific standard name (e.g. "Electricity Charges", "Office Rent", "Travelling Expenses", "Computers"). Never vague names like "Expenses" or "Misc". For sale default "Sales", purchase default "Purchases".
- party_name: customer/supplier/person named, else null. A missing party name is NOT a reason to ask.
- gst: {applicable, rate, inclusive, supply:"intra"|"inter"} — the indirect tax (GST/VAT). Only set applicable when tax is mentioned or shown on the document. Follow the TAX rules for this business below.
- tds: {applicable, section, rate, amount, amount_is_net} — withholding tax (TDS), only when mentioned. Give "rate" when a % is stated and "amount" when a TDS figure is stated (else 0). amount_is_net=true when the main "amount" is what was actually paid/received AFTER TDS was deducted — e.g. "paid 45000 from bank, TDS deducted 5000" → amount 45000, tds.amount 5000, amount_is_net true (gross 50000). amount_is_net=false when the main amount is the full bill before TDS — e.g. "commission 50000, TDS 10%" or "bill of 50000, paid after 5000 TDS" → amount 50000, amount_is_net false. The same applies to money RECEIVED when the customer, client or bank deducted TDS — e.g. "received 45000 from Acme, they deducted TDS 5000" → amount 45000, tds.amount 5000, amount_is_net true (it becomes TDS Receivable). Use receipt_from_customer when it settles an earlier invoice, sale when it is a new sale.
- currency: ISO code (e.g. "USD") ONLY when the amount is in a currency other than the business base currency; else null.
- exchange_rate: base-currency units per 1 unit of "currency", ONLY if the user or document states it. Never look up, estimate or invent a rate; leave null and the app will ask.
- manual_lines: ONLY for journal_adjustment: [{account, debit, credit}].
- confidence: 0–1 for the whole reading; account_confidence: 0–1 for counter_account specifically.
- alternatives: up to 3 other plausible counter_account ledgers when you are not certain, else [].
- reason: one or two sentences explaining WHY you chose the action and counter_account, quoting the words from the message/document you relied on. Do not invent facts.
- missing: list facts that are genuinely unknown and needed: "amount", "payment_account" (paid/received how?), "expense_account" (what was it for?). Never list ledger choice when you can infer it.

DOCUMENTS: read date, party, GSTIN, invoice number, taxable value, GST and total from the document; supplier bills are purchases/expenses; invoices issued by this business are sales. If the document does not show whether it was paid or is on credit and the user didn't say, put "payment_account" in missing.
BANK STATEMENTS / PASSBOOKS with many rows: set "document_kind":"bank_statement" and nothing else needs filling.

OUTPUT:
{
  "action": "...", "transaction_date": "YYYY-MM-DD", "amount": 0, "payment_mode": null, "payment_account": null,
  "counter_account": null, "party_name": null, "invoice_number": null,
  "gst": {"applicable": false, "rate": 0, "inclusive": true, "supply": "intra"},
  "tds": {"applicable": false, "section": null, "rate": 0, "amount": 0, "amount_is_net": false},
  "manual_lines": null, "currency": null, "exchange_rate": null, "narrative": "one plain sentence describing the transaction",
  "reason": "...", "confidence": 0.9, "account_confidence": 0.9, "alternatives": [], "missing": [],
  "document_summary": null, "document_kind": null
}
Default date = today. Amounts are in the business base currency unless another currency is stated. For recorded transactions also include "kind":"record".

QUESTIONS ABOUT THE BOOKS: if the user is ASKING about their accounts rather than recording a transaction (e.g. "how much am I owed", "show expenses above 10000", "why did profit fall", "GST collected last month", "bank balance"), output ONLY:
{"kind":"query","tool":"<tool>","params":{...},"period":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD","label":"short label"},"period2":{...}}
Tools:
- profit_loss — profit, revenue, sales, income, margin for a period
- compare — compare two periods or explain WHY profit/expenses/sales changed (period = recent, period2 = earlier; default this month vs last month)
- receivables — who owes me / how much am I owed / unpaid customers / overdue invoices
- payables — what I owe / unpaid bills / suppliers to pay
- search — list transactions; params: {text, party, account, min_amount, max_amount, kind: "expense"|"income"|"payment"|"receipt"|"sales"|"purchase"|null}
- top_expenses — biggest expenses / where money went; params: {limit}
- gst_summary — GST collected / paid / payable
- balances — cash, bank or a named account's balance; params: {account: name or null}
Resolve relative dates ("this month", "last quarter", "this year" = financial year, "last week") using Today. Omit period if the user gave none. Never answer with numbers yourself — the app computes them.`;

export type ParsedTransaction = {
  status: "complete" | "needs_clarification";
  transaction_date: string;
  transaction_type: string;
  narrative: string;
  amount: number;
  party_name: string | null;
  party_type: string | null;
  invoice_number: string | null;
  payment_mode: string | null;
  bank_account_name: string | null;
  gst: { applicable: boolean; rate: number; taxable_value: number; cgst: number; sgst: number; igst: number; transaction_type: string | null };
  tds: { applicable: boolean; section: string | null; rate: number; amount: number; net_payment: number };
  lines: { account: string; debit: number; credit: number; confidence: number; is_new_account: boolean; suggested_type: string | null; fc_debit?: number; fc_credit?: number }[];
  needs_clarification: string[];
  warnings: string[];
  confidence: number;
  document_summary?: string | null;
  document_kind?: string | null;
  // Explanation layer — what the rules did and why the AI chose the account
  rule?: string;
  reason?: string;
  account_confidence?: number;
  counter_account?: string | null;
  alternatives?: string[];
  history_evidence?: string | null;
  fx?: { currency: string; rate: number; base_currency: string } | null;
};

// Posted entries with their lines, for answering questions (paged so nothing is cut off)

export async function loadQueryBooks(sb: SupabaseClient, businessId: string, until: string): Promise<{ accounts: { id: string; name: string; type: string; sub_type: string | null }[]; journals: QJournal[]; error?: unknown }> {
  const accounts: { id: string; name: string; type: string; sub_type: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type,is_group").eq("business_id", businessId).range(from, from + 999);
    if (error) return { accounts, journals: [], error };
    accounts.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Journals first, then their lines in chunks: a joined read of lines per journal times out on big books
  const heads: { id: string; date: string; entry_no: string; narration: string | null; type: string; party_name?: string | null }[] = [];
  // Count first, then read the pages in parallel
  const base = () => sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "posted").lte("date", until);
  const { count, error: cErr } = await base();
  if (cErr) return { accounts, journals: [], error: cErr };
  const pageOf = (from: number, withParty: boolean) => sb.from("fw_fin_journals").select(`id,date,entry_no,narration,type${withParty ? ",party_name" : ""}`).eq("business_id", businessId).eq("status", "posted").lte("date", until).order("date").order("id").range(from, from + 999);
  let withParty = true;
  const starts: number[] = [];
  for (let f = 0; f < Math.max(count ?? 0, 1); f += 1000) starts.push(f);
  for (let i = 0; i < starts.length; i += 6) {
    let res = await Promise.all(starts.slice(i, i + 6).map(f => pageOf(f, withParty)));
    if (withParty && res.some(r => r.error && /party_name/.test(r.error.message))) { withParty = false; res = await Promise.all(starts.slice(i, i + 6).map(f => pageOf(f, false))); }
    for (const r of res) { if (r.error) return { accounts, journals: [], error: r.error }; heads.push(...((r.data ?? []) as unknown as typeof heads)); }
  }
  const lines = new Map<string, { account_id: string; dr: number; cr: number }[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < heads.length; i += 300) chunks.push(heads.slice(i, i + 300).map(h => h.id));
  for (let i = 0; i < chunks.length; i += 6) {
    const res = await Promise.all(chunks.slice(i, i + 6).map(ids => sb.from("fw_fin_journal_lines").select("journal_id,account_id,dr_amount,cr_amount").in("journal_id", ids)));
    for (const { data, error } of res) {
      if (error) return { accounts, journals: [], error };
      for (const l of (data ?? []) as { journal_id: string; account_id: string; dr_amount: number; cr_amount: number }[]) {
        const list = lines.get(l.journal_id) ?? [];
        list.push({ account_id: l.account_id, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 });
        lines.set(l.journal_id, list);
      }
    }
  }
  const journals: QJournal[] = heads.map(j => ({ id: j.id, date: String(j.date).slice(0, 10), entry_no: j.entry_no, narration: j.narration ?? "", type: j.type, party_name: j.party_name ?? null, lines: lines.get(j.id) ?? [] }));
  return { accounts, journals };
}


export type AiIntent = {
  kind?: "record" | "query"; tool?: string; params?: Record<string, unknown>; period?: unknown; period2?: unknown;
  action?: string; transaction_date?: string; amount?: number; payment_mode?: "cash" | "bank" | "credit" | null;
  payment_account?: string | null; counter_account?: string | null; party_name?: string | null; invoice_number?: string | null;
  gst?: Intent["gst"]; tds?: Intent["tds"]; manual_lines?: Intent["manual_lines"]; narrative?: string; reason?: string;
  confidence?: number; account_confidence?: number; alternatives?: string[]; missing?: string[];
  document_summary?: string | null; document_kind?: string | null;
  currency?: string | null; exchange_rate?: number | null;
};

export type BusinessContext = { country: string; baseCurrency: string; tax: TaxModule; state?: string | null };

/** The AI instructions with this business's country, currency and tax rules added. */
export function intentSystemFor(ctx: BusinessContext): string {
  return `${INTENT_SYSTEM}

THIS BUSINESS: country ${ctx.country}${ctx.state ? `, state ${ctx.state}` : ""}; base currency ${ctx.baseCurrency}.
TAX (${ctx.tax.name}): ${ctx.tax.aiRules}`;
}

/** Reads country/currency/tax regime, tolerating databases without the Phase 7 columns. */
export async function loadBusinessContext(sb: SupabaseClient, businessId: string): Promise<BusinessContext & { name: string; gstin: string | null }> {
  let { data, error } = await sb.from("fw_fin_businesses").select("name,state,gstin,currency,country,tax_regime").eq("id", businessId).single();
  if (error && /country|tax_regime/.test(error.message)) ({ data } = await sb.from("fw_fin_businesses").select("name,state,gstin,currency").eq("id", businessId).single());
  const d = (data ?? {}) as { name?: string; state?: string | null; gstin?: string | null; currency?: string | null; country?: string | null; tax_regime?: string | null };
  return { name: d.name ?? "", gstin: d.gstin ?? null, state: d.state ?? null, country: d.country ?? "IN", baseCurrency: (d.currency ?? "INR").toUpperCase(), tax: getTaxModule(d.tax_regime ?? (d.country && d.country !== "IN" ? "NONE" : "IN_GST")) };
}

const BALANCE_SHEET_PLUMBING = /bank|cash|debtor|creditor|receivable|payable|cgst|sgst|igst|gst|tds|capital/i;

// Turns the AI's description into a rule-built entry, with real evidence from earlier entries
/** Supplier or customer ledgers: parties to a transaction, not what was bought or sold. */
export const isPartyLedger = (a: { name: string; sub_type?: string | null }) =>
  a.sub_type === "trade_payables" || a.sub_type === "trade_receivables";
const SPEND_ACTIONS = new Set<string>(["expense_payment", "asset_purchase", "purchase"]);

/** The ledger list given to the AI, with suppliers and customers marked so they are not used as expense or asset accounts. */
export function accountListForAI(accounts: { name: string; type: string; sub_type?: string | null }[]): string {
  return accounts.map(a => a.sub_type === "trade_payables" ? `${a.name} (supplier — a party, not an expense or asset)`
    : a.sub_type === "trade_receivables" ? `${a.name} (customer — a party, not income)`
    : `${a.name} (${a.type}${a.sub_type ? "/" + a.sub_type : ""})`).join(" | ");
}

export async function interpret(sb: SupabaseClient, ai: AiIntent, accounts: { name: string; type: string; sub_type: string | null }[], businessId: string, today: string, ctx?: BusinessContext): Promise<ParsedTransaction> {
  const base = {
    transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(ai.transaction_date ?? "") ? ai.transaction_date! : today,
    narrative: ai.narrative ?? "", party_name: ai.party_name ?? null, party_type: null, invoice_number: ai.invoice_number ?? null,
    document_summary: ai.document_summary ?? null, document_kind: ai.document_kind ?? null, reason: ai.reason ?? "",
    confidence: Math.max(0, Math.min(1, Number(ai.confidence ?? 0.8))), account_confidence: Math.max(0, Math.min(1, Number(ai.account_confidence ?? ai.confidence ?? 0.8))),
    alternatives: (ai.alternatives ?? []).filter(Boolean).slice(0, 3),
  };
  const emptyTax = { gst: { applicable: false, rate: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0, transaction_type: null }, tds: { applicable: false, section: null, rate: 0, amount: 0, net_payment: 0 } };
  if (ai.document_kind === "bank_statement") {
    return { ...base, ...emptyTax, status: "needs_clarification", transaction_type: "bank_statement", amount: 0, payment_mode: null, bank_account_name: null, lines: [], needs_clarification: ["Opening the bank statement for review."], warnings: [] };
  }

  const find = makeFinder(accounts.map((a, i) => ({ id: String(i), name: a.name })));
  const canon = (n: string | null | undefined) => (n ? find(n)?.name ?? n.trim() : null);
  const banks = accounts.filter(a => a.sub_type === "bank" || /\bbank\b/i.test(a.name) && !/charges|commission/i.test(a.name));
  const cashLedger = accounts.find(a => a.sub_type === "cash" || /^cash/i.test(a.name))?.name ?? DEFAULT_LEDGERS.cash;

  let paymentAccount = canon(ai.payment_account);
  if (!paymentAccount && ai.payment_mode === "bank" && banks.length === 1) paymentAccount = banks[0].name;
  // "From bank" in a business with no bank ledger yet: open one rather than asking the same question forever
  if (!paymentAccount && ai.payment_mode === "bank" && banks.length === 0) paymentAccount = "Bank Account";
  if (!paymentAccount && ai.payment_mode === "cash") paymentAccount = cashLedger;

  const action = (ACTIONS as string[]).includes(ai.action ?? "") ? ai.action as Intent["action"] : "journal_adjustment";
  // A supplier/customer ledger is a party, never the expense or asset itself ("office table" ≠ "XYZ Furniture House")
  let counter = canon(ai.counter_account), partyName = ai.party_name ?? null;
  const counterAcc = counter ? accounts.find(a => a.name === counter) : undefined;
  if (counter && SPEND_ACTIONS.has(action)) {
    // Also a party when the name is a saved contact or was the party on an earlier entry —
    // e.g. a supplier's name that was once opened as a Fixed Assets ledger by mistake
    let party = !!counterAcc && isPartyLedger(counterAcc);
    if (!party && counter !== partyName) {
      const name = counter.replace(/[%_]/g, "");
      const [{ count: asContact }, { count: asParty }] = await Promise.all([
        sb.from("fw_fin_contacts").select("id", { count: "exact", head: true }).eq("business_id", businessId).ilike("name", name),
        sb.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", businessId).ilike("party_name", name),
      ]);
      party = (asContact ?? 0) > 0 || (asParty ?? 0) > 0;
    }
    if (party) { partyName = partyName ?? counter; counter = null; }
  }
  const intent: Intent = {
    action, amount: Number(ai.amount) || 0, payment_mode: ai.payment_mode ?? (paymentAccount ? "bank" : null),
    payment_account: paymentAccount, counter_account: counter, party_name: partyName,
    gst: ai.gst ?? null, tds: ai.tds ?? null, manual_lines: ai.manual_lines?.map(l => ({ ...l, account: canon(l.account) ?? l.account })) ?? null,
    currency: ai.currency ?? null, exchange_rate: ai.exchange_rate ?? null,
  };
  const rr = buildEntry(intent, { tax: ctx?.tax, baseCurrency: ctx?.baseCurrency });

  // How this party / ledger was booked before — real data, not the model's guess
  let history_evidence: string | null = null;
  if (intent.party_name) {
    const { data: prior } = await sb.from("fw_fin_journals")
      .select("fw_fin_journal_lines(fw_fin_chart_of_accounts(name))")
      .eq("business_id", businessId).eq("status", "posted").ilike("narration", `%${intent.party_name.replace(/[%_]/g, "")}%`).limit(30);
    const counts = new Map<string, number>();
    for (const j of (prior ?? []) as unknown as { fw_fin_journal_lines: { fw_fin_chart_of_accounts: { name: string } | null }[] }[]) {
      for (const l of j.fw_fin_journal_lines ?? []) {
        const n = l.fw_fin_chart_of_accounts?.name;
        if (n && !BALANCE_SHEET_PLUMBING.test(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      history_evidence = `Earlier entries mentioning ${intent.party_name} were booked to ${top[0]} (${top[1]} time${top[1] > 1 ? "s" : ""}).`;
      if (intent.counter_account && top[0].toLowerCase() !== intent.counter_account.toLowerCase()) {
        rr.warnings.push(`Different from before: ${intent.party_name} was previously booked to ${top[0]}.`);
        if (!base.alternatives.includes(top[0])) base.alternatives.unshift(top[0]);
      }
    }
  }

  const exists = (n: string) => !!find(n);
  const lines = rr.lines.map(l => ({
    account: l.account, debit: l.debit, credit: l.credit,
    confidence: intent.counter_account && l.account === intent.counter_account ? base.account_confidence : 1,
    is_new_account: !!l.account && !exists(l.account), suggested_type: l.suggested_type,
    ...(rr.fx ? { fc_debit: l.fc_debit ?? 0, fc_credit: l.fc_credit ?? 0 } : {}),
  }));
  const missing = rr.missing;
  return {
    ...base, status: missing.length ? "needs_clarification" : "complete", transaction_type: action,
    amount: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100 || intent.amount,
    payment_mode: intent.payment_mode, bank_account_name: intent.payment_account,
    gst: rr.gst, tds: rr.tds, lines,
    // Bank was said but there are several: name them, so a short reply ("HDFC") settles it
    needs_clarification: !missing.length ? [] : missing[0] === "payment_account" && intent.payment_mode === "bank" && banks.length > 1
      ? [`Which bank — ${banks.slice(0, 5).map(b => b.name).join(", ")}?`]
      : [questionFor(missing[0], intent)],
    warnings: [...rr.warnings, ...lines.filter(l => l.is_new_account).map(l => `New ledger "${l.account}" will be created.`)],
    rule: rr.rule, counter_account: intent.counter_account, history_evidence, fx: rr.fx ?? null,
  };
}

