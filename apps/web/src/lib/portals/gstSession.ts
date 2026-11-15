// A GST portal session kept for its life (up to 6 hours) without storing it anywhere on our side: the taxpayer token is
// sealed (AES-256-GCM, key derived from a server-only secret) into an opaque blob that only this business's browser tab
// holds and sends back. The blob is bound to the business and GSTIN and refuses to open after it expires.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const key = () => createHash("sha256").update(`fw-gst-session:${process.env.GST_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`).digest();
const MAX_MS = 6 * 3600 * 1000;

export function sealSession(token: string, bizId: string, gstin: string, expiresAt: string): { session: string; expiresAt: string } {
  const exp = Math.min(Date.parse(expiresAt) || Date.now() + MAX_MS, Date.now() + MAX_MS);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify({ t: token, b: bizId, g: gstin, e: exp }), "utf8"), c.final()]);
  return { session: Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url"), expiresAt: new Date(exp).toISOString() };
}

/** The token, or null when the blob is missing, tampered with, for another business / GSTIN, or expired. */
export function openSession(blob: string | null | undefined, bizId: string, gstin: string): string | null {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const v = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as { t: string; b: string; g: string; e: number };
    if (v.b !== bizId || v.g !== gstin || Date.now() > v.e - 60_000) return null;
    return v.t;
  } catch { return null; }
}
