// Encrypts provider session tokens at rest (AES-256-GCM). Key: PORTAL_TOKEN_KEY (32 random bytes, base64) in server settings.
// Demo sessions carry no secret, so they are stored without the key.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const keyBytes = () => {
  const k = process.env.PORTAL_TOKEN_KEY ? Buffer.from(process.env.PORTAL_TOKEN_KEY, "base64") : null;
  return k && k.length === 32 ? k : null;
};

export function seal(plain: string, demo: boolean): string {
  if (demo) return `demo:${plain}`;
  const key = keyBytes();
  if (!key) throw new Error("PORTAL_TOKEN_KEY is not set — real portal sessions can't be stored safely.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

export function open(sealed: string): string {
  if (sealed.startsWith("demo:")) return sealed.slice(5);
  const [v, iv, tag, data] = sealed.split(":");
  const key = keyBytes();
  if (v !== "v1" || !key) throw new Error("Can't read the stored portal session.");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
