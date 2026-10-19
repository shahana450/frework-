// Balance Sheet in the Schedule III (Companies Act 2013, Division I) vertical format, built from the presented
// statement: every displayed line goes under exactly one Schedule III head, so totals are unchanged and still foot.
import type { PresentedBS, StmtLine } from "./statements";
import type { Group } from "./books";

export type S3Head = { key: string; label: string; note: number; total: number; lines: StmtLine[] };
export type S3Block = { key: string; label: string; heads: S3Head[]; total: number };
export type Schedule3BS = { equityLiabilities: S3Block[]; assets: S3Block[]; totalEL: number; totalAssets: number };
export type LineInfo = { group: Group; sub_type: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const CASH = /(^|\b)(cash|bank|petty cash)(\b|$)/i;

const HEADS: { block: "equity" | "noncurrent_liab" | "current_liab" | "noncurrent_assets" | "current_assets"; key: string; label: string }[] = [
  { block: "equity", key: "capital", label: "Capital / Share capital" },
  { block: "equity", key: "reserves", label: "Reserves and surplus" },
  { block: "noncurrent_liab", key: "lt_borrowings", label: "Long-term borrowings" },
  { block: "current_liab", key: "st_borrowings", label: "Short-term borrowings" },
  { block: "current_liab", key: "trade_payables", label: "Trade payables" },
  { block: "current_liab", key: "other_cl", label: "Other current liabilities" },
  { block: "current_liab", key: "st_provisions", label: "Short-term provisions" },
  { block: "noncurrent_assets", key: "ppe", label: "Property, plant and equipment" },
  { block: "current_assets", key: "inventories", label: "Inventories" },
  { block: "current_assets", key: "trade_receivables", label: "Trade receivables" },
  { block: "current_assets", key: "cash", label: "Cash and cash equivalents" },
  { block: "current_assets", key: "loans_advances", label: "Short-term loans and advances" },
  { block: "current_assets", key: "other_ca", label: "Other current assets" },
];
const BLOCKS = {
  equity: "Shareholders' / Owners' funds", noncurrent_liab: "Non-current liabilities", current_liab: "Current liabilities",
  noncurrent_assets: "Non-current assets", current_assets: "Current assets",
} as const;

/** Which Schedule III head a presented line belongs to. `section` is the presented section it came from. */
export function headOf(section: string, l: StmtLine, info?: LineInfo): string {
  const n = l.name, st = info?.sub_type ?? "";
  if (section === "equity") return "capital";
  if (section === "reserves") return "reserves";
  if (section === "long_term_liabilities") return "lt_borrowings";
  if (section === "fixed_assets") return "ppe";
  if (section === "current_liabilities") {
    if (/^(Bank overdraft|Cash credit balance) — /.test(n)) return "st_borrowings";
    if (/^Advances from customers — /.test(n)) return "other_cl";
    if (/provision/i.test(n)) return "st_provisions";
    if (/\b(loan|borrowing|od|overdraft|cc)\b/i.test(n)) return "st_borrowings";
    if (info?.group === "duties" || /\b(gst|tds|tcs|tax|duty|duties|salary|salaries|wages|payable|expenses?|advance|deposit|outstanding|pf|esi)\b/i.test(n)) return st === "trade_payables" && !/\b(gst|tds|tcs|tax|salary|wages)\b/i.test(n) ? "trade_payables" : "other_cl";
    return "trade_payables";
  }
  // current assets
  if (/^Advances to suppliers — /.test(n)) return "loans_advances";
  if (st === "cash" || st === "bank" || CASH.test(n)) return "cash";
  if (/\b(stock|inventor(y|ies)|closing stock)\b/i.test(n)) return "inventories";
  if (st === "trade_receivables" || /\b(debtors?|receivables?)\b/i.test(n)) return "trade_receivables";
  if (/\b(advance|loan|deposit|prepaid|imprest)\b/i.test(n)) return "loans_advances";
  if (/\b(gst|itc|input|tds|tcs|tax|refund|accrued)\b/i.test(n)) return "other_ca";
  return "trade_receivables";
}

export function scheduleIII(p: PresentedBS, info: Map<string, LineInfo>): Schedule3BS {
  const byHead = new Map<string, StmtLine[]>();
  for (const s of [...p.liabilities, ...p.assets]) for (const l of s.lines) {
    const k = headOf(s.key, l, info.get(l.id));
    byHead.set(k, [...(byHead.get(k) ?? []), l]);
  }
  let note = 0;
  const heads = HEADS.filter(h => byHead.get(h.key)?.length).map(h => {
    const lines = byHead.get(h.key)!;
    return { ...h, note: ++note, lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) };
  });
  const block = (b: keyof typeof BLOCKS): S3Block | null => {
    const hs = heads.filter(h => h.block === b).map(({ block: _b, ...h }) => h); // eslint-disable-line @typescript-eslint/no-unused-vars
    return hs.length ? { key: b, label: BLOCKS[b], heads: hs, total: r2(hs.reduce((s, h) => s + h.total, 0)) } : null;
  };
  const el = (["equity", "noncurrent_liab", "current_liab"] as const).map(block).filter((x): x is S3Block => !!x);
  const as = (["noncurrent_assets", "current_assets"] as const).map(block).filter((x): x is S3Block => !!x);
  return { equityLiabilities: el, assets: as, totalEL: r2(el.reduce((s, b) => s + b.total, 0)), totalAssets: r2(as.reduce((s, b) => s + b.total, 0)) };
}
