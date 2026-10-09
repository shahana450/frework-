// Demo provider: lets the whole flow be used before a GSP/ERI account exists. Every row it returns is marked demo.
import type { PortalProvider, PortalStatusRow, Session } from "./types";
import { PortalError } from "./types";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const code = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase().slice(0, 6);

export function createDemoProvider(portal: "gst" | "it", now: () => Date = () => new Date()): PortalProvider {
  return {
    id: "demo", label: "Demo (sample data)", demo: true,
    async requestOtp(identifier) {
      return { otpRef: `demo-${code(identifier)}`, message: "Demo mode: enter any 6 digits. With a real provider, the portal sends the OTP to the registered mobile/email." };
    },
    async verifyOtp(_id, _ref, otp) {
      if (!/^\d{6}$/.test(otp)) throw new PortalError("OTP_INVALID", "Enter the 6-digit OTP.");
      return { token: `demo-session-${Date.now()}`, expiresAt: new Date(now().getTime() + 30 * 86400000).toISOString() };
    },
    async fetchStatuses(identifier: string, _s: Session, fyStartYear: number) {
      const today = iso(now());
      const rows: PortalStatusRow[] = [];
      if (portal === "gst") {
        for (let k = 0; k < 12; k++) {
          const y = fyStartYear + (k >= 9 ? 1 : 0), m = (3 + k) % 12;            // Apr … Mar
          const period = ym(y, m);
          if (period >= today.slice(0, 7)) break;                                 // current month isn't due yet
          const next = new Date(Date.UTC(y, m + 1, 1));
          for (const [form, day] of [["GSTR-1", 10], ["GSTR-3B", 19]] as const) {
            const filedOn = iso(new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), day)));
            const filed = filedOn <= today;
            rows.push({ kind: "return", form, period, status: filed ? "filed" : "not_filed", arn: filed ? `DEMO${code(identifier + form + period)}` : null, filedOn: filed ? filedOn : null });
          }
        }
        rows.push({ kind: "ledger", form: "Cash ledger", period: today.slice(0, 7), status: "balance", amount: 12500, details: { igst: 0, cgst: 6250, sgst: 6250 } });
        rows.push({ kind: "ledger", form: "Credit ledger (ITC)", period: today.slice(0, 7), status: "balance", amount: 48200, details: { igst: 18200, cgst: 15000, sgst: 15000 } });
      } else {
        // Returns for the year that ended last March (AY = fyStartYear-(fyStartYear+1))
        const ay = `AY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
        const filedOn = `${fyStartYear}-07-25`;
        if (filedOn <= today) {
          rows.push({ kind: "itr", form: "ITR", period: ay, status: "e_verified", arn: `DEMO${code(identifier + ay)}`, filedOn, details: { itrForm: "ITR-3", verifiedOn: `${fyStartYear}-07-26`, processing: "Processed u/s 143(1)" } });
          rows.push({ kind: "refund", form: "Refund", period: ay, status: "issued", amount: 18450, filedOn: `${fyStartYear}-09-12`, details: { mode: "ECS to bank" } });
        } else {
          rows.push({ kind: "itr", form: "ITR", period: ay, status: "not_filed" });
        }
      }
      return rows;
    },
  };
}
