// Cash flow (direct method) from the ledger: every movement in cash/bank accounts, classified by
// what was on the other side of the entry. Closing cash always equals the cash & bank ledgers.
import { groupOf, type Account, type Group } from "./books";
import type { QJournal } from "./bookQueries";

export type CashFlow = {
  from: string; to: string; opening: number; closing: number;
  operating: number; investing: number; financing: number; net: number;
  items: { section: "operating" | "investing" | "financing"; name: string; amount: number }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const isCashBank = (a: Account) => a.sub_type === "bank" || a.sub_type === "cash" || a.type === "bank" || a.type === "cash"
  || (/\bbank\b|\bcash\b/i.test(a.name) && groupOf(a) === "current_asset" && !/charges|commission|interest/i.test(a.name));

const sectionOf = (groups: Group[]): CashFlow["items"][number]["section"] =>
  groups.includes("fixed_asset") ? "investing" : groups.some(g => g === "capital" || g === "loan") ? "financing" : "operating";

export function computeCashFlow(accounts: Account[], journals: QJournal[], from: string, to: string): CashFlow {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const cash = new Set(accounts.filter(isCashBank).map(a => a.id));
  let opening = 0;
  const totals = { operating: 0, investing: 0, financing: 0 };
  const items = new Map<string, { section: CashFlow["items"][number]["section"]; name: string; amount: number }>();

  for (const j of journals) {
    if (j.date > to) continue;
    const delta = j.lines.filter(l => cash.has(l.account_id)).reduce((s, l) => s + l.dr - l.cr, 0);
    if (j.date < from) { opening += delta; continue; }
    if (Math.abs(delta) < 0.005) continue;                       // transfers between cash/bank accounts
    const others = j.lines.filter(l => !cash.has(l.account_id));
    const section = sectionOf(others.map(l => groupOf(byId.get(l.account_id) ?? { id: "", name: "", type: "" })));
    totals[section] += delta;
    // Attribute the cash movement to the other-side accounts in proportion to their size
    const weight = others.reduce((s, l) => s + l.dr + l.cr, 0) || 1;
    for (const l of others) {
      const name = byId.get(l.account_id)?.name ?? "Other";
      const key = `${section}|${name}`;
      const it = items.get(key) ?? { section, name, amount: 0 };
      it.amount += delta * ((l.dr + l.cr) / weight);
      items.set(key, it);
    }
  }
  const net = totals.operating + totals.investing + totals.financing;
  return {
    from, to, opening: r2(opening), closing: r2(opening + net),
    operating: r2(totals.operating), investing: r2(totals.investing), financing: r2(totals.financing), net: r2(net),
    items: [...items.values()].map(i => ({ ...i, amount: r2(i.amount) })).filter(i => Math.abs(i.amount) >= 0.01)
      .sort((a, b) => a.section.localeCompare(b.section) || Math.abs(b.amount) - Math.abs(a.amount)),
  };
}
