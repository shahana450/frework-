"use client";
import { supabase } from "./supabase";

// Adds the signed-in user's token to every same-origin /api/finance and /api/phonepe request,
// so pages can keep calling fetch() as before.
let installed = false;
export function installApiAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith("/") ? url : url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : "";
    if (!path.startsWith("/api/finance") && !path.startsWith("/api/phonepe")) return original(input, init);
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
        if (await askInApp(lead, `${detail.trim()}\n\nPost only if it really is a separate transaction.`, "Post anyway", "Go back")) {
          headers.set("x-confirm-duplicate", "1");
          return original(input, { ...init, headers });
        }
      }
    }
    return res;
  };
}

/** An in-app yes/no dialog (no browser pop-up — B14). Built without React because this runs outside any component. */
export function askInApp(title: string, body: string, yes: string, no: string): Promise<boolean> {
  return new Promise(resolve => {
    const prev = document.activeElement as HTMLElement | null;
    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(15,43,37,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:18px;max-width:480px;width:100%;padding:22px;display:flex;flex-direction:column;gap:12px;border-top:5px solid #8A5A00;box-shadow:0 24px 60px -20px rgba(0,0,0,.5);color:#10241F";
    const h = document.createElement("div"); h.textContent = title; h.style.cssText = "font-weight:800;font-size:1.05rem";
    const p = document.createElement("div"); p.textContent = body; p.style.cssText = "white-space:pre-wrap;font-size:.9rem;line-height:1.55;color:#2E3B36";
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
    const mk = (label: string, primary: boolean) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.style.cssText = `height:42px;padding:0 18px;border-radius:11px;font-weight:800;cursor:pointer;font-family:inherit;${primary ? "border:none;background:#8A5A00;color:#fff" : "border:1px solid #D8CDB4;background:#fff;color:#10241F"}`; return b; };
    const bNo = mk(no, false), bYes = mk(yes, true);
    const done = (v: boolean) => { document.removeEventListener("keydown", onKey); wrap.remove(); prev?.focus?.(); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); };
    bNo.onclick = () => done(false); bYes.onclick = () => done(true);
    wrap.onclick = e => { if (e.target === wrap) done(false); };
    row.append(bNo, bYes); box.append(h, p, row); wrap.append(box); document.body.append(wrap);
    document.addEventListener("keydown", onKey); bNo.focus();
  });
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
