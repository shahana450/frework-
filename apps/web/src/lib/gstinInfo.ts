// What a GSTIN tells us by itself, and how to read the public GST record for it.
// A GSTIN is: 2-digit state code · 10-character PAN · entity number · "Z" · check character.
// The PAN's 4th letter is the holder's status: P person, F firm/LLP, C company, T trust, A AOP, B BOI, H HUF, …

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh",
  "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh",
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** GSTIN check character (mod-36 weighted). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export type GstinBasics = { valid: boolean; error?: string; gstin: string; state?: string; stateCode?: string; pan?: string; businessType?: string };

/** Business type from the PAN's 4th letter. A firm's PAN (F) is used by partnerships and LLPs alike — the public record decides. */
export function typeFromPan(pan: string): string | undefined {
  return ({ P: "proprietorship", F: "partnership", C: "pvt_ltd", H: "huf", T: "trust", A: "trust", B: "trust" } as Record<string, string>)[pan[3]];
}

export function decodeGstin(raw: string): GstinBasics {
  const gstin = String(raw ?? "").toUpperCase().replace(/\s+/g, "");
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { valid: false, gstin, error: gstin.length === 15 ? "That isn't a valid GSTIN format." : "A GSTIN has 15 characters, e.g. 32ABCDE1234F1Z5." };
  const stateCode = gstin.slice(0, 2), state = STATE_CODES[stateCode];
  if (!state) return { valid: false, gstin, error: `State code ${stateCode} isn't a GST state.` };
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return { valid: false, gstin, error: "The last character doesn't match — check the GSTIN for a typo." };
  const pan = gstin.slice(2, 12);
  return { valid: true, gstin, state, stateCode, pan, businessType: typeFromPan(pan) };
}

export type GstinDetails = GstinBasics & {
  legalName?: string; tradeName?: string; address?: string; city?: string; pincode?: string;
  registrationType?: "regular" | "composition"; status?: string; registeredOn?: string; source: "gstin" | "gst_record";
};

/** Constitution of business on the GST record → FreBook's business type. */
export function typeFromConstitution(ctb: string | undefined): string | undefined {
  const c = (ctb ?? "").toLowerCase();
  if (!c) return undefined;
  if (/limited liability partnership|llp/.test(c)) return "llp";
  if (/proprietor/.test(c)) return "proprietorship";
  if (/partnership/.test(c)) return "partnership";
  if (/public limited/.test(c)) return "public_ltd";
  if (/private limited|one person/.test(c)) return "pvt_ltd";
  if (/hindu undivided|huf/.test(c)) return "huf";
  if (/trust|society|association|club|ngo|body of individuals/.test(c)) return "trust";
  return undefined;
}

/** Reads the public "search taxpayer" reply (GSTN field names, as passed through by GSPs). */
export function fromGstRecord(basics: GstinBasics, body: unknown): GstinDetails {
  const root = body as { data?: unknown };
  const d = ((root?.data as { data?: unknown })?.data ?? root?.data ?? body) as Record<string, unknown>;
  const s = (k: string) => (typeof d?.[k] === "string" ? (d[k] as string).trim() : "") || undefined;
  const pr = (d?.pradr as { addr?: Record<string, string>; adr?: string } | undefined);
  const a = pr?.addr ?? {};
  const parts = [a.flno, a.bno, a.bnm, a.st, a.loc, a.locality].map(x => (x ?? "").trim()).filter(Boolean);
  const address = parts.length ? parts.join(", ") : pr?.adr;
  const city = (a.city || a.dst || a.loc || "").trim() || undefined;
  const dty = (s("dty") ?? "").toLowerCase();
  return {
    ...basics, source: "gst_record",
    legalName: s("lgnm"), tradeName: s("tradeNam") ?? s("tradeName"),
    businessType: typeFromConstitution(s("ctb")) ?? basics.businessType,
    address: address?.trim() || undefined, city, pincode: (a.pncd ?? "").trim() || undefined,
    registrationType: /composition/.test(dty) ? "composition" : dty ? "regular" : undefined,
    status: s("sts"), registeredOn: s("rgdt"),
  };
}
