// Mirror of fw_fin_repair_bank_plan() in 2026-10-23_p2_repairs.sql — keep the two in step.
// Decides, for a two-line bank-import entry, whether it was posted against the wrong ledger and what the corrected
// entry is (the line that stood in for the bank is replaced by the real bank ledger).
export type PlanLine = { accountId: string; name: string; dr: number; cr: number; bank: boolean };
export type RepairPlan =
  | { status: "ok" }
  | { status: "manual"; problem: string }
  | { status: "repair"; problem: string; newLines: { accountId: string; dr: number; cr: number }[]; newType: "payment" | "receipt" };

export function planBankRepair(type: string, lines: PlanLine[], bankId: string): RepairPlan {
  if (lines.length !== 2) return { status: "ok" };
  const same = lines[0].accountId === lines[1].accountId;
  const hasBank = lines.some(l => l.bank);
  if (hasBank && !same) return { status: "ok" };
  let replace: number | null = null;
  if (same) {
    const side = type === "receipt" ? "dr" : "cr";
    replace = lines[0][side] > 0 ? 0 : 1;
  } else {
    lines.forEach((l, i) => { if (/bank/i.test(l.name)) replace = i; });
  }
  if (replace === null) return { status: "manual", problem: "no cash/bank ledger and no line that stood in for the bank — needs a manual decision" };
  const r = replace;
  return {
    status: "repair",
    problem: same ? "same ledger on both sides" : `"${lines[r].name}" acted as the bank`,
    newLines: lines.map((l, i) => ({ accountId: i === r ? bankId : l.accountId, dr: l.dr, cr: l.cr })),
    newType: lines[r].cr > 0 ? "payment" : "receipt",
  };
}
