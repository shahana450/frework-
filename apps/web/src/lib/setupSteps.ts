// Business setup wizard rules (B9): what must be filled before moving on, and when the business may be created. Pure.
export type SetupForm = { name: string; country: string; gst_registration_type: string; gstin: string };
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Why the user can't leave this step yet — or null when they can. */
export function stepError(step: number, f: SetupForm): string | null {
  if (step === 1 && !f.name.trim()) return "Business name is required.";
  if (step === 2 && f.country === "IN") {
    if (!f.gst_registration_type) return "Choose your GST status — registered, composition or not registered. FreBook uses it to decide whether GST can be charged.";
    if (f.gst_registration_type !== "unregistered" && !GSTIN_RE.test(f.gstin.trim().toUpperCase())) return "Enter your 15-character GSTIN, or choose “Not registered”.";
  }
  return null;
}

/** The business is created only from the final Review step, after every earlier step passes. */
export function canCreate(step: number, f: SetupForm): { ok: true } | { ok: false; step: number; error: string } {
  for (let s = 1; s <= 3; s++) { const e = stepError(s, f); if (e) return { ok: false, step: s, error: e }; }
  if (step !== 4) return { ok: false, step, error: "Review your details, then create the business." };
  return { ok: true };
}
