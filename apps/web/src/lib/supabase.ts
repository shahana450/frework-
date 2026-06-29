import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

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
