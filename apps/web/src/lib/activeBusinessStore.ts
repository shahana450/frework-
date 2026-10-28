// The one active business (Task 6) — framework-free store behind lib/activeBusiness.tsx (React context + hooks).
import { tallyCompanyLinked } from "./tallyConnection";

export type ActiveBusiness = { userId: string | null; businessId: string | null; businessName: string; ready: boolean };

const EMPTY: ActiveBusiness = { userId: null, businessId: null, businessName: "", ready: false };
let current: ActiveBusiness = EMPTY;
const listeners = new Set<(a: ActiveBusiness) => void>();

export const activeBusinessKey = (userId: string) => `fw_fin_biz_${userId}`;
const clean = (v: string | null | undefined) => (v ?? "").replace(/﻿/g, "").trim();
const storage = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
// Each browser tab keeps its own business (sessionStorage survives a reload of that tab but isn't shared with
// other tabs), so choosing a business in one tab never moves another tab to it.
const tabStorage = (): Storage | null => { try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; } };

/** The business this tab was working in (survives a reload of the tab). */
export function tabBusiness(userId: string): string {
  try { return clean(tabStorage()?.getItem(activeBusinessKey(userId))); } catch { return ""; }
}

/** The business to open with: this tab's own, else the last one chosen on this device (for a new tab). */
export function rememberedBusiness(userId: string): string {
  const tab = tabBusiness(userId);
  if (tab) return tab;
  try { return clean(storage()?.getItem(activeBusinessKey(userId))); } catch { return ""; }
}

/**
 * The active business id for this user — the one shown in the header. Pages call this instead of localStorage.
 * Outside the finance layout (setup, auth callback) it falls back to the remembered choice.
 */
export function readActiveBusiness(userId: string): string | null {
  if (current.userId === userId && current.businessId) return current.businessId;
  return rememberedBusiness(userId) || null;
}

/** Make `businessId` the active business (switcher, setup, CA desk). Updates the header and every page. */
export function setActiveBusiness(userId: string, businessId: string, businessName?: string) {
  try { storage()?.setItem(activeBusinessKey(userId), businessId); } catch { /* */ }
  try { tabStorage()?.setItem(activeBusinessKey(userId), businessId); } catch { /* */ }
  const same = current.userId === userId && current.businessId === businessId;
  current = { userId, businessId, businessName: businessName ?? (same ? current.businessName : ""), ready: true };
  listeners.forEach(l => l(current));
  // Tally follows the business: each business pushes only to its own linked Tally company
  if (!same) void import("./tallyConnection").then(m => m.setTallyBusiness(businessId, current.businessName)).catch(() => { /* Tally page will relink */ });
}

/** Asks before switching to another business, in a FreBook-styled box naming both businesses and the Tally company
 *  the new one is linked to (warning when that company's name doesn't look like the business). Resolves true to switch. */
export function confirmBusinessSwitch(userId: string, toId: string, toName: string, fromName?: string): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(true);
  const fromId = current.userId === userId ? current.businessId : null;
  if (!fromId || fromId === toId) return Promise.resolve(true);
  const tally = tallyCompanyLinked(toId, toName);   // never another business's company
  const from = fromName || current.businessName || "the current business";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mismatch = !!tally && norm(tally) !== norm(toName);
  const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
  const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.setAttribute("aria-labelledby", "fw-sw-title");
    wrap.style.cssText = "position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(16,36,31,.6);backdrop-filter:blur(6px)";
    const tallyRow = tally
      ? `<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:${mismatch ? "#FBECE8" : "#F3ECDD"};border:1px solid ${mismatch ? "#EBC4BA" : "#E6DFD0"}">
           <span style="width:9px;height:9px;margin-top:6px;border-radius:999px;flex-shrink:0;background:${mismatch ? "#B4321F" : "#0B7A55"}"></span>
           <span style="font-size:14px;line-height:1.5;color:#10241F">Tally will connect to <b>${esc(tally)}</b> — entries go only there.${mismatch ? `<br><span style="color:#B4321F">This Tally company doesn't look like ${esc(toName)}. Check it on the Tally page before pushing.</span>` : ""}</span>
         </div>`
      : `<div style="padding:12px 14px;border-radius:12px;background:#F3ECDD;border:1px solid #E6DFD0;font-size:14px;line-height:1.5;color:#4A5651">${esc(toName)} has no Tally company linked yet — nothing is sent to Tally until you choose one on the Tally page.</div>`;
    wrap.innerHTML = `
      <div style="width:100%;max-width:440px;background:#FFFDF8;border:1px solid #E6DFD0;border-radius:20px;overflow:hidden;font-family:${SERIF};color:#10241F;box-shadow:0 30px 80px -20px rgba(16,36,31,.6)">
        <div style="background:#12352D;border-bottom:3px solid #C9A24A;padding:20px 24px;color:#fff">
          <div style="font-size:11px;letter-spacing:.3em;color:#C9A24A">SWITCH BUSINESS</div>
          <div id="fw-sw-title" style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:20px">
            <span style="opacity:.75">${esc(from)}</span><span style="color:#C9A24A">→</span><i style="font-size:24px">${esc(toName)}</i>
          </div>
        </div>
        <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
          <div style="font-size:15px;color:#4A5651">Every page will show <b style="color:#10241F">${esc(toName)}</b>'s books.</div>
          ${tallyRow}
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button data-a="no" style="height:44px;padding:0 20px;border-radius:999px;border:1px solid #E6DFD0;background:#FFFDF8;color:#10241F;font-family:inherit;font-size:15px;cursor:pointer">Stay on ${esc(from)}</button>
            <button data-a="yes" style="height:44px;padding:0 22px;border-radius:999px;border:none;background:#12352D;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer">Switch</button>
          </div>
        </div>
      </div>`;
    const done = (ok: boolean) => { document.removeEventListener("keydown", onKey); wrap.remove(); resolve(ok); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); if (e.key === "Enter") done(true); };
    wrap.addEventListener("click", e => {
      const a = (e.target as HTMLElement).closest("button")?.getAttribute("data-a");
      if (a) done(a === "yes"); else if (e.target === wrap) done(false);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    (wrap.querySelector('[data-a="yes"]') as HTMLButtonElement | null)?.focus();
  });
}

/** Forget the active business (e.g. after deleting it). */
export function clearActiveBusiness(userId: string) {
  try { storage()?.removeItem(activeBusinessKey(userId)); } catch { /* */ }
  try { tabStorage()?.removeItem(activeBusinessKey(userId)); } catch { /* */ }
  current = { userId, businessId: null, businessName: "", ready: true };
  listeners.forEach(l => l(current));
}

export const getActiveBusiness = (): ActiveBusiness => current;

export function subscribeActiveBusiness(fn: (a: ActiveBusiness) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tests only. */
export function _resetActiveBusiness() { current = EMPTY; listeners.clear(); }
