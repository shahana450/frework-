// Unposted FreBook drafts survive a reload or a new tab (B17). Kept per business on this device;
// a draft leaves the store once it is posted or cancelled. Pure apart from the storage passed in.
export type StoredMsg = { id: string; role: string; status?: string; transaction?: unknown; verdict?: unknown; text?: string; timestamp?: number; [k: string]: unknown };
type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export const draftKey = (businessId: string) => `fw_frebook_drafts:${businessId}`;
const OPEN = new Set(["pending", "edited"]);
export const isOpenDraft = (m: StoredMsg) => m.role === "ai" && !!m.transaction && OPEN.has(m.status ?? "pending");

/** Each open draft with the message that asked for it, oldest first (at most 30). */
export function pickDrafts(messages: StoredMsg[]): StoredMsg[] {
  const out: StoredMsg[] = [];
  messages.forEach((m, i) => {
    if (!isOpenDraft(m)) return;
    const ask = [...messages.slice(0, i)].reverse().find(x => x.role === "user");
    if (ask && !out.includes(ask)) out.push(ask);
    out.push(m);
  });
  return out.slice(-60);
}

export function saveDrafts(store: Storage, businessId: string, messages: StoredMsg[]) {
  try {
    const d = pickDrafts(messages);
    if (d.length) store.setItem(draftKey(businessId), JSON.stringify({ at: Date.now(), messages: d }));
    else store.removeItem(draftKey(businessId));
  } catch { /* storage full or blocked — drafts stay in this tab only */ }
}

export function loadDrafts(store: Storage, businessId: string, maxAgeDays = 14): StoredMsg[] {
  try {
    const raw = store.getItem(draftKey(businessId));
    if (!raw) return [];
    const { at, messages } = JSON.parse(raw) as { at: number; messages: StoredMsg[] };
    if (!Array.isArray(messages) || Date.now() - at > maxAgeDays * 86400000) return [];
    return messages;
  } catch { return []; }
}
