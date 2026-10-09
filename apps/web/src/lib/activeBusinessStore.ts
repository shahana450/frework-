// The one active business (Task 6) — framework-free store behind lib/activeBusiness.tsx (React context + hooks).

export type ActiveBusiness = { userId: string | null; businessId: string | null; businessName: string; ready: boolean };

const EMPTY: ActiveBusiness = { userId: null, businessId: null, businessName: "", ready: false };
let current: ActiveBusiness = EMPTY;
const listeners = new Set<(a: ActiveBusiness) => void>();

export const activeBusinessKey = (userId: string) => `fw_fin_biz_${userId}`;
const clean = (v: string | null | undefined) => (v ?? "").replace(/﻿/g, "").trim();
const storage = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

/** Remembered choice on this device (used only to pick the business when the app opens). */
export function rememberedBusiness(userId: string): string {
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
  const same = current.userId === userId && current.businessId === businessId;
  current = { userId, businessId, businessName: businessName ?? (same ? current.businessName : ""), ready: true };
  listeners.forEach(l => l(current));
}

/** Forget the active business (e.g. after deleting it). */
export function clearActiveBusiness(userId: string) {
  try { storage()?.removeItem(activeBusinessKey(userId)); } catch { /* */ }
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
