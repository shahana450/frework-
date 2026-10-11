// Filed ✓ marks on the GST pages, from statuses Portal Connect fetched through Sandbox (the public GST record).
// Pure functions — the pages fetch /api/finance/portals and pass the result in.

export type PortalLink = { portal: string; provider: string; status: string; identifier?: string };
export type PortalStatus = { portal: string; form: string; period: string; status: string; arn: string | null; filed_on: string | null; demo?: boolean };
export type Filing = { on: string | null; arn: string | null };

const FILED = new Set(["filed", "e_verified", "processed"]);

/** True when this business's GSTIN is linked through Sandbox (not Demo mode). */
export function linkedViaSandbox(links: PortalLink[] | null | undefined): boolean {
  return !!links?.some(l => l.portal === "gst" && l.provider === "sandbox" && l.status === "linked");
}

const real = (statuses: PortalStatus[]) => statuses.filter(s => s.portal === "gst" && !s.demo && FILED.has(s.status));
const pick = (rows: PortalStatus[]): Filing | null => {
  if (!rows.length) return null;
  const s = [...rows].sort((a, b) => (b.filed_on ?? "").localeCompare(a.filed_on ?? ""))[0];
  return { on: s.filed_on, arn: s.arn };
};

/** A monthly (or quarterly, by its last month) return: form "GSTR-3B", period "2026-09". */
export function filingFor(statuses: PortalStatus[], form: string, period: string): Filing | null {
  return pick(real(statuses).filter(s => s.form === form && s.period === period));
}

/**
 * An annual return (GSTR-9, GSTR-9C, GSTR-4) for the year starting April `fyStart`.
 * Sandbox's docs show no annual example, so any period inside the year counts ("2026-03", "FY 2025-26" …).
 */
export function annualFilingFor(statuses: PortalStatus[], form: string, fyStart: number): Filing | null {
  const from = `${fyStart}-04`, to = `${fyStart + 1}-03`, label = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  return pick(real(statuses).filter(s => s.form === form && ((/^\d{4}-\d{2}$/.test(s.period) && s.period >= from && s.period <= to) || s.period.includes(label))));
}

/** The filing for one due-date card (`ret` from gstReturns.dueDates). */
export function filingForDue(statuses: PortalStatus[], due: { form: string; ret: string }): Filing | null {
  const fy = due.ret.match(/^FY:(\d{4})$/);
  return fy ? annualFilingFor(statuses, due.form, +fy[1]) : filingFor(statuses, due.form, due.ret);
}

/** "Filed on 18 Oct 2026 (ARN AA3210…)" */
export function filedLine(f: Filing): string {
  const on = f.on ? new Date(`${f.on}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
  return `Filed${on ? ` on ${on}` : ""}${f.arn ? ` (ARN ${f.arn})` : ""}`;
}
