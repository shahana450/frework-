// Marks due-date reminders as filed using statuses fetched from the GST / Income-tax portals.
import type { DueItem } from "../compliance";

export type FetchedStatus = { portal: string; form: string; period: string; status: string; arn: string | null; filed_on: string | null; demo: boolean };
export type DueWithFiling = DueItem & { filed?: { on: string | null; arn: string | null; demo: boolean } };

/** Reminder key → portal form + period. GST keys look like "gstr1-2026-8" (month is 0-based); ITR keys "itr-2026" (FY start year). */
function portalRef(key: string): { form: string; period: string } | null {
  let m = key.match(/^gstr(1|3b)-(\d{4})-(\d{1,2})$/);
  if (m) return { form: m[1] === "1" ? "GSTR-1" : "GSTR-3B", period: `${m[2]}-${String(+m[3] + 1).padStart(2, "0")}` };
  m = key.match(/^itr-(\d{4})$/);
  if (m) { const fy = +m[1]; return { form: "ITR", period: `AY ${fy + 1}-${String(fy + 2).slice(2)}` }; }
  return null;
}

export function markFiled(items: DueItem[], statuses: FetchedStatus[]): DueWithFiling[] {
  const done = new Map(statuses.filter(s => ["filed", "e_verified", "processed"].includes(s.status)).map(s => [`${s.form}|${s.period}`, s]));
  return items.map(it => {
    const ref = portalRef(it.key);
    const s = ref ? done.get(`${ref.form}|${ref.period}`) : undefined;
    return s ? { ...it, filed: { on: s.filed_on, arn: s.arn, demo: s.demo } } : it;
  });
}
