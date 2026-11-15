// Browser side of the kept GST portal session: the sealed blob (useless without our server) for up to 6 hours.
const k = (biz: string) => `fw_gst_session_${biz}`;
export type KeptSession = { session: string; expires: string };

export function getKept(biz: string): KeptSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(k(biz)) ?? "null") as KeptSession | null;
    if (!v || Date.parse(v.expires) - Date.now() < 60_000) { localStorage.removeItem(k(biz)); return null; }
    return v;
  } catch { return null; }
}
export function keep(biz: string, d: { session?: string; session_expires?: string }) {
  if (!d.session || !d.session_expires) return;
  try { localStorage.setItem(k(biz), JSON.stringify({ session: d.session, expires: d.session_expires })); } catch { /* */ }
}
export function forget(biz: string) { try { localStorage.removeItem(k(biz)); } catch { /* */ } }
export const until = (s: KeptSession) => new Date(s.expires).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
