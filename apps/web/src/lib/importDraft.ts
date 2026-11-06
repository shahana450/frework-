// Unfinished imports, kept on this device so the user can resume: Smart Inbox, Banking → Import, the statement
// window in FreBook chat, and the chat's Excel template windows. Saved automatically while entries are still to be
// posted, cleared once everything is posted or the user discards it. IndexedDB, not localStorage — a long statement
// is thousands of rows. Nothing here is sent anywhere.
import { useEffect, useRef } from "react";

export type DraftKind = "inbox" | "bank-import" | "statement" | "bulk-template" | "simple-template";
export type ImportDraft<T = unknown> = { kind: DraftKind; bizId: string; savedAt: number; title: string; pending: number; posted: number; data: T };

const DB = "fw-import-drafts", STORE = "drafts";
const key = (kind: DraftKind, bizId: string) => `${kind}:${bizId}`;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>(res => {
      const t = db.transaction(STORE, mode); const req = fn(t.objectStore(STORE));
      req.onsuccess = () => res(req.result ?? null); req.onerror = () => res(null);
    });
  } catch { return null; }   // private window / storage blocked: resuming just isn't offered
}

export const loadDraft = <T,>(kind: DraftKind, bizId: string) => tx<ImportDraft<T>>("readonly", s => s.get(key(kind, bizId)) as IDBRequest<ImportDraft<T>>);
export const saveDraft = <T,>(d: ImportDraft<T>) => tx("readwrite", s => s.put(d, key(d.kind, d.bizId)));
export const clearDraft = (kind: DraftKind, bizId: string) => tx("readwrite", s => s.delete(key(kind, bizId)));

/**
 * Keeps the draft in step with the screen: saves (debounced) while something is still to be posted, clears it
 * when nothing is. `enabled` stays false until the user has resumed or discarded an earlier draft, so an empty
 * screen never overwrites it.
 */
export function useAutoDraft<T>(kind: DraftKind, bizId: string, enabled: boolean, snapshot: () => { title: string; pending: number; posted: number; data: T } | null, deps: unknown[]) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!bizId || !enabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = snapshot();
      if (!s || s.pending <= 0) void clearDraft(kind, bizId);
      else void saveDraft({ kind, bizId, savedAt: Date.now(), ...s });
    }, 700);
    return () => clearTimeout(timer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, enabled, ...deps]);
}

export function draftAge(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
