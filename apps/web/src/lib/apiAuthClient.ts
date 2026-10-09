"use client";
import { supabase } from "./supabase";

// Adds the signed-in user's token to every same-origin /api/finance request,
// so pages can keep calling fetch() as before.
let installed = false;
export function installApiAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith("/") ? url : url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : "";
    if (!path.startsWith("/api/finance")) return original(input, init);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
    const res = await original(input, { ...init, headers });

    // Possible duplicate: ask once, and re-send only if the user says it's a separate transaction
    if (res.status === 409 && !headers.has("x-confirm-duplicate") && (init?.method ?? "GET").toUpperCase() === "POST") {
      const body = await res.clone().json().catch(() => null) as { code?: string; error?: string; duplicate?: { entry_no: string; date: string; narration: string; total: number } } | null;
      if (body?.code === "POSSIBLE_DUPLICATE") {
        const d = body.duplicate;
        const detail = d ? `\n\nAlready in your books:\n${d.entry_no} · ${new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ₹${d.total.toLocaleString("en-IN")}${d.narration ? `\n${d.narration.slice(0, 120)}` : ""}` : "";
        const lead = d ? "This looks like a duplicate entry." : (body.error ?? "This looks like a duplicate.");
        if (window.confirm(`${lead}${detail}\n\nPress OK only if it really is a separate one. Cancel keeps it unsaved.`)) {
          headers.set("x-confirm-duplicate", "1");
          return original(input, { ...init, headers });
        }
      }
    }
    return res;
  };
}

/** Downloads an authenticated API file without putting the token in the URL. */
export async function downloadApiFile(path: string, fallbackName: string) {
  const res = await fetch(path);
  if (!res.ok) {
    const msg = await res.json().then(j => j.error).catch(() => null);
    throw new Error(msg ?? "Download failed. Please try again.");
  }
  const name = res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
