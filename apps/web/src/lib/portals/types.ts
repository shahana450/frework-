// One interface for every GST (GSP) and Income-tax (ERI) provider. Portal passwords never pass through FreWork:
// the taxpayer approves access with an OTP sent by the portal to their registered mobile/email.

export type Portal = "gst" | "it";

export type PortalStatusRow = {
  kind: "return" | "itr" | "refund" | "ledger";
  form: string;            // "GSTR-1", "GSTR-3B", "ITR", "Refund", "Cash ledger"
  period: string;          // "2026-09" for GST months, "AY 2026-27" for income tax
  status: string;          // filed | not_filed | e_verified | processed | issued | balance
  arn?: string | null;
  filedOn?: string | null; // YYYY-MM-DD
  amount?: number | null;
  details?: Record<string, unknown>;
};

export type OtpStart = { otpRef: string; message: string };
export type Session = { token: string; expiresAt: string };   // provider session — stored encrypted

export interface PortalProvider {
  id: string;
  label: string;
  demo: boolean;
  /** True when no taxpayer OTP is needed (status comes from a public record): linking happens in one step. */
  noOtp?: boolean;
  /** Ask the portal to send an OTP to the taxpayer's registered contact. */
  requestOtp(identifier: string): Promise<OtpStart>;
  /** Exchange the OTP for a provider session. */
  verifyOtp(identifier: string, otpRef: string, otp: string): Promise<Session>;
  /** Fetch filing / refund / ledger statuses for the financial year that starts in fyStartYear (e.g. 2026 → FY 2026-27). */
  fetchStatuses(identifier: string, session: Session, fyStartYear: number): Promise<PortalStatusRow[]>;
}

export class PortalError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "OTP_INVALID" | "SESSION_EXPIRED" | "PROVIDER" | "INVALID", message: string) { super(message); }
}

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
