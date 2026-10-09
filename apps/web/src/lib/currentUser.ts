"use client";
// The signed-in user for page logic, read ONCE per page load from the local session (no network call),
// and shared by every component that asks. Server routes still verify the token on every request.
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

let pending: Promise<User | null> | null = null;

export function currentUser(): Promise<User | null> {
  if (!pending) {
    pending = supabase.auth.getSession().then(({ data }) => data.session?.user ?? null);
    // A sign-in/out elsewhere resets it so the next caller reads the new session
    supabase.auth.onAuthStateChange(() => { pending = null; });
  }
  return pending;
}
