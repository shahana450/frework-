// The simple FreBook bulk template: Date | Particulars | Debit | Credit | Narration — laid out like a Tally journal.
// A row with a date starts an entry; the rows below it without a date belong to it, until debits equal credits.
// Pure: give it the sheet as a grid.
import { cellDate, cellNum } from "./bankExcel";

export const SIMPLE_HEADERS = ["Date", "Particulars", "Debit", "Credit", "Narration"];
export type SimpleLine = { ledger: string; debit: number; credit: number };
export type SimpleEntry = { row: number; date: string; narration: string; lines: SimpleLine[]; debit: number; credit: number; error: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Finds the header row; null when the sheet isn't the simple template. */
function headerOf(grid: unknown[][]) {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const h = (grid[r] ?? []).map(norm);
    const at = (...names: string[]) => h.findIndex(x => names.includes(x));
    const c = { date: at("date"), led: at("particulars", "ledger", "account", "ledgername", "accountname"), dr: at("debit", "dr", "debitamount"), cr: at("credit", "cr", "creditamount"), nar: at("narration", "remarks", "description", "notes") };
    if (c.date >= 0 && c.led >= 0 && c.dr >= 0 && c.cr >= 0) return { row: r, ...c };
  }
  return null;
}

export function parseSimpleGrid(grid: unknown[][], today = new Date().toISOString().slice(0, 10)): SimpleEntry[] | null {
  const h = headerOf(grid);
  if (!h) return null;
  const entries: SimpleEntry[] = [];
  let cur: SimpleEntry | null = null;
  const close = () => {
    if (!cur) return;
    cur.debit = r2(cur.lines.reduce((s, l) => s + l.debit, 0)); cur.credit = r2(cur.lines.reduce((s, l) => s + l.credit, 0));
    if (cur.lines.length < 2) cur.error = "Needs at least two lines (one debit, one credit).";
    else if (cur.debit !== cur.credit) cur.error = `Debits ₹${cur.debit.toLocaleString("en-IN")} ≠ credits ₹${cur.credit.toLocaleString("en-IN")}.`;
    entries.push(cur); cur = null;
  };
  for (let i = h.row + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    const ledger = String(r[h.led] ?? "").replace(/\s+/g, " ").trim();
    const dr = cellNum(r[h.dr]), cr = cellNum(r[h.cr]);
    const debit = isNaN(dr) ? 0 : Math.abs(dr), credit = isNaN(cr) ? 0 : Math.abs(cr);
    const rawDate = r[h.date];
    const date = cellDate(rawDate);
    const nar = h.nar >= 0 ? String(r[h.nar] ?? "").trim() : "";
    if (!ledger && !debit && !credit) { if (nar && cur) cur.narration = `${cur.narration} ${nar}`.trim(); continue; }
    // A date starts a new entry; so does a row after an entry that already balances
    const balanced = cur && cur.lines.length >= 2 && r2(cur.lines.reduce((s, l) => s + l.debit - l.credit, 0)) === 0;
    if (date || !cur || balanced) {
      const carry: string = cur?.date ?? today;
      close();
      cur = { row: i + 1, date: date || carry, narration: nar, lines: [], debit: 0, credit: 0, error: null };
      if (String(rawDate ?? "").trim() && !date) cur.error = `Row ${i + 1}: "${String(rawDate)}" isn't a date (use DD-MM-YYYY).`;
    } else if (nar && !cur.narration) cur.narration = nar;
    const entry = cur as SimpleEntry;
    if (!ledger) { entry.error = entry.error ?? `Row ${i + 1}: Particulars (ledger name) is empty.`; continue; }
    if (debit && credit) { entry.error = entry.error ?? `Row ${i + 1}: put the amount in Debit or Credit, not both.`; }
    entry.lines.push({ ledger, debit: r2(debit), credit: r2(credit) });
  }
  close();
  for (const e of entries) if (!e.narration) e.narration = e.lines.map(l => l.ledger).join(" / ");
  return entries;
}

/** Voucher type from the lines: money out of cash/bank is a payment, money in a receipt, else journal. */
export function voucherOf(lines: SimpleLine[]): string {
  const cb = (s: string) => /\b(cash|bank|hdfc|icici|sbi|axis|kotak|federal|canara|pnb|od|overdraft)\b/i.test(s);
  if (lines.some(l => cb(l.ledger) && l.credit > 0) && lines.every(l => !cb(l.ledger) || l.credit > 0)) return lines.every(l => cb(l.ledger)) ? "contra" : "payment";
  if (lines.some(l => cb(l.ledger) && l.debit > 0) && lines.every(l => !cb(l.ledger) || l.debit > 0)) return "receipt";
  return "journal";
}

// ── Cash / bank receipts & payments template ───────────────────────────────────
// Date | Receipt/Payment | Cash/Bank | Party / Ledger | Amount | Narration — one row per entry.
// Receipt: Dr Cash/Bank, Cr Party.  Payment: Dr Party, Cr Cash/Bank.
export const CASHBANK_HEADERS = ["Date", "Receipt/Payment", "Cash/Bank", "Party / Ledger", "Amount", "Narration"];

function cashBankHeader(grid: unknown[][]) {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const h = (grid[r] ?? []).map(norm);
    const at = (...names: string[]) => h.findIndex(x => names.includes(x));
    const c = { date: at("date"), kind: at("receiptpayment", "paymentreceipt", "type", "rp", "vouchertype"), cb: at("cashbank", "cashorbank", "bankcash", "mode", "paidvia", "cashbankledger"),
      party: at("partyledger", "party", "ledger", "particulars", "account", "ledgername", "partyname"), amt: at("amount", "amountrs", "amountinr", "rs"), nar: at("narration", "remarks", "description", "notes") };
    if (c.date >= 0 && c.kind >= 0 && c.cb >= 0 && c.party >= 0 && c.amt >= 0) return { row: r, ...c };
  }
  return null;
}

/** Null when the sheet isn't the receipts & payments template. */
export function parseCashBankGrid(grid: unknown[][]): SimpleEntry[] | null {
  const h = cashBankHeader(grid);
  if (!h) return null;
  const out: SimpleEntry[] = [];
  for (let i = h.row + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    const kindRaw = String(r[h.kind] ?? "").trim(), cb = String(r[h.cb] ?? "").replace(/\s+/g, " ").trim();
    const party = String(r[h.party] ?? "").replace(/\s+/g, " ").trim(), n = cellNum(r[h.amt]);
    const amount = isNaN(n) ? 0 : r2(Math.abs(n));
    const nar = h.nar >= 0 ? String(r[h.nar] ?? "").trim() : "";
    if (!kindRaw && !cb && !party && !amount) continue;                       // blank row
    const date = cellDate(r[h.date]);
    const k = kindRaw.toLowerCase();
    const kind = /^(r|rec|rcpt|receipt|received|in|credit)/.test(k) ? "receipt" : /^(p|pay|pmt|payment|paid|out|debit)/.test(k) ? "payment" : null;
    const e: SimpleEntry = { row: i + 1, date: date || "", narration: nar || `${kind === "receipt" ? "Received from" : "Paid to"} ${party}`.trim(), lines: [], debit: amount, credit: amount, error: null };
    if (!date) e.error = `Row ${i + 1}: "${String(r[h.date] ?? "")}" isn't a date (use DD-MM-YYYY).`;
    else if (!kind) e.error = `Row ${i + 1}: write Receipt or Payment.`;
    else if (!cb) e.error = `Row ${i + 1}: Cash/Bank is empty — write Cash or your bank ledger name.`;
    else if (!party) e.error = `Row ${i + 1}: Party / Ledger is empty.`;
    else if (!amount) e.error = `Row ${i + 1}: Amount is empty.`;
    else if (cb.toLowerCase() === party.toLowerCase()) e.error = `Row ${i + 1}: Cash/Bank and Party / Ledger are the same.`;
    if (!e.error) e.lines = kind === "receipt"
      ? [{ ledger: cb, debit: amount, credit: 0 }, { ledger: party, debit: 0, credit: amount }]
      : [{ ledger: party, debit: amount, credit: 0 }, { ledger: cb, debit: 0, credit: amount }];
    out.push(e);
  }
  return out;
}
