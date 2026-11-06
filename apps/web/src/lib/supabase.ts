import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export const supabase = createClient(url, key);

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
