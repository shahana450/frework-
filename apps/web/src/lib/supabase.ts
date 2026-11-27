import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

// The sign-in is shared by every FreBook tab and the installed app window through one browser lock. If another
// window holds it (asleep, mid-refresh), a new window could wait on it for ever — the app "stuck loading" after
// opening. Wait at most 2.5 s, then carry on without it (the worst case is one extra token refresh).
const authLock = async <R,>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks?.request) return fn();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    return await locks.request(name, { mode: "exclusive", signal: ctrl.signal }, async () => { clearTimeout(timer); return fn(); });
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") return fn();
    throw e;
  }
};

// After the app sits idle, a request can hang on a dead connection and never answer — the page then "loads" for ever
// until a refresh. Give every Supabase request a time limit so it fails (and retries) instead of hanging.
const timedFetch: typeof fetch = (input, init) => {
  if (typeof AbortController === "undefined" || init?.signal) return fetch(input, init);
  const ctrl = new AbortController();
  // Long enough for a big page of entries on a slow line; file uploads to storage are never cut off
  if (/\/storage\/v1\//.test(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)) return fetch(input, init);
  const t = setTimeout(() => ctrl.abort(), 45000);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
};

export const supabase = createClient(url, key, { auth: { lock: authLock }, global: { fetch: timedFetch } });

// Reading the sign-in must never hang a page. If it takes over 6 s (a stuck token refresh), answer from the session
// saved in this browser instead of waiting — never reload, which would throw away a statement being read or uploaded.
if (typeof window !== "undefined") {
  const realGetSession = supabase.auth.getSession.bind(supabase.auth);
  const stored = () => {
    try {
      const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x));
      const s = k ? JSON.parse(localStorage.getItem(k) || "null") : null;
      return s?.access_token ? s : null;
    } catch { return null; }
  };
  supabase.auth.getSession = (() => {
    const p = realGetSession();
    const fallback = new Promise<Awaited<typeof p>>(res => setTimeout(() => { const s = stored(); if (s) res({ data: { session: s }, error: null } as Awaited<typeof p>); }, 6000));
    return Promise.race([p, fallback]);
  }) as typeof supabase.auth.getSession;
}

// Speed: in the browser, getUser() with no token reads the signed-in user from the local session instead of asking
// Supabase's auth server (a network round trip of ~1–2 s that every page paid before loading anything). Pages only
// use it to know who is signed in; every API route still verifies the token on each request, and getUser(jwt)
// (with a token) keeps the real server check.
if (typeof window !== "undefined") {
  const serverGetUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = (async (jwt?: string) => {
    if (jwt) return serverGetUser(jwt);
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return serverGetUser();   // no local session: behave exactly as before
    return { data: { user: data.session.user }, error: null };
  }) as typeof supabase.auth.getUser;
}

export interface FwUser {
  id?: string;
  name?: string;
  email: string;
  mobile?: string;
  method: "google" | "email";
  created_at?: string;
}

export interface FwEnquiry {
  id?: string;
  name: string;
  email?: string;
  mobile: string;
  service?: string;
  message?: string;
  created_at?: string;
}
