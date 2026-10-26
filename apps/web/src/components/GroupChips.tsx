"use client";
// One-tap group choice for a new ledger: the common groups as buttons, everything else under "Other".
import { LEDGER_HEADS } from "@/lib/ledgerHeads";

const QUICK: { key: string; label: string }[] = [
  { key: "debtors", label: "Customer" },
  { key: "creditors", label: "Supplier" },
  { key: "indirect_expense", label: "Expense" },
  { key: "indirect_income", label: "Income" },
  { key: "sales", label: "Sales" },
  { key: "purchase", label: "Purchase" },
  { key: "bank", label: "Bank" },
];

/** Best first guess for a new ledger from its name and which side of cash/bank it sits on. */
export function guessGroup(name: string, side?: "in" | "out" | "party" | null): string {
  const n = name.toLowerCase();
  if (/accumulated depreciation|acc\.? ?dep|provision for depreciation|depreciation (reserve|fund)/.test(n)) return "fixed_asset";
  if (/credit\s*card/.test(n)) return "current_liability";
  if (/\b(bank|hdfc|icici|sbi|axis|kotak|federal|canara|pnb|yes bank|idfc|indusind)\b/.test(n)) return "bank";
  if (/\b(gst|cgst|sgst|igst|tds|tcs|cess)\b/.test(n)) return "duties";
  if (/\b(sales?|revenue)\b|\bb2[bc] ?sales?\b/.test(n)) return "sales";
  if (/\b(purchases?)\b/.test(n)) return "purchase";
  if (/\b(capital|drawings?)\b/.test(n)) return "capital";
  if (/\b(loan|od|overdraft)\b/.test(n)) return "loan";
  if (/\b(rent|salary|salaries|wages|electricity|power|telephone|internet|fuel|petrol|diesel|repairs?|stationery|printing|travel|conveyance|freight|transport|loading|unloading|food|tea|office|maintenance|insurance|fees?|charges?|expenses?|advertis\w*|commission paid|bonus)\b/.test(n)) return "indirect_expense";
  if (/\b(interest received|commission received|discount received|income|rebate)\b/.test(n)) return "indirect_income";
  const business = /\b(traders?|trading|enterprises?|agenc(y|ies)|stores?|ltd|limited|pvt|private|llp|& ?co|company|industries|suppliers?|distributors?|marketing|associates|solutions|services|corp|corporation|inc|co)\b\.?/.test(n);
  if (side === "party") return "creditors";             // the party credited on a supplier bill
  if (side === "in") return "debtors";                 // someone paid us
  if (side === "out") return business ? "creditors" : "indirect_expense";
  return business ? "creditors" : "indirect_expense";
}

export default function GroupChips({ value, onChange, compact }: { value: string; onChange: (key: string) => void; compact?: boolean }) {
  const inQuick = QUICK.some(q => q.key === value);
  const h = compact ? 28 : 32;
  return (
    <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {QUICK.map(q => {
        const on = q.key === value;
        return (
          <button key={q.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(q.key)}
            style={{ height: h, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? "#0F2B25" : "#D9CDB2"}`, background: on ? "#0F2B25" : "#FFFFFF", color: on ? "#FFFFFF" : "#2E3B36", fontWeight: on ? 800 : 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            {on ? "✓ " : ""}{q.label}
          </button>
        );
      })}
      <select aria-label="Other group" value={inQuick ? "" : value} onChange={e => e.target.value && onChange(e.target.value)}
        style={{ height: h, borderRadius: 999, border: `1px solid ${!inQuick && value ? "#0F2B25" : "#D9CDB2"}`, background: !inQuick && value ? "#0F2B25" : "#FFFFFF", color: !inQuick && value ? "#FFFFFF" : "#2E3B36", padding: "0 10px", fontSize: 12.5, fontFamily: "inherit", fontWeight: 600 }}>
        <option value="">Other…</option>
        {LEDGER_HEADS.filter(x => !QUICK.some(q => q.key === x.key)).map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
      </select>
    </div>
  );
}
