"use client";
// Auto-push catch-up: entries posted where Tally can't be reached (WhatsApp, another device) are pushed by any open
// FreWork finance page once Tally is connected here and Auto-push is on. Only entries posted after it was switched on.
import { useEffect, useRef } from "react";
import { tallyAutoPushOn, tallyAutoPushSince, tallyAutoPushBusinesses, type TallyState } from "@/lib/tallyConnection";
import { pushToTally, loadPushStatus, verifyOpenCompany } from "@/lib/tallyPushRun";
import { tallyQueueBusy } from "@/lib/tallyUtils";

let running = false;
const lastTry = new Map<string, number>();   // a failed entry is retried, but at most every 10 minutes
const RETRY_MS = 10 * 60 * 1000;
const announced = new Set<string>();
export const AUTO_PUSH_EVENT = "fw:tally-autopush";   // detail: { text: string; ok: boolean }

const say = (ok: boolean, text: string) => window.dispatchEvent(new CustomEvent(AUTO_PUSH_EVENT, { detail: { ok, text } }));

async function catchUp(bizId: string, t: TallyState, quiet = false) {
  if (running || !tallyAutoPushOn(bizId) || t.status !== "connected" || !t.company) return;
  running = true;
  try {
    // Server lists posted entries (30 s grace) with no push record; this browser's own record is checked too
    const res = await fetch(`/api/finance/tally-autopush?business_id=${bizId}&since=${encodeURIComponent(tallyAutoPushSince(bizId))}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { say(false, `Auto-push couldn't check for new entries: ${d.error ?? res.status}`); return; }
    const status = await loadPushStatus(bizId);
    const now = Date.now();
    // Skip entries already in Tally; retry failed ones after a pause, so a lasting problem isn't repeated every 45 s
    const todo = ((d.todo ?? []) as { id: string; date: string; entry_no: string }[])
      .filter(r => !(status[r.id] && "at" in status[r.id]) && now - (lastTry.get(r.id) ?? 0) > RETRY_MS);
    if (!todo.length) return;
    // Another business's company: push only while that company is open in Tally, and say nothing when it isn't
    if (quiet && await verifyOpenCompany(t.port, t.company)) return;
    todo.forEach(r => lastTry.set(r.id, now));
    const r = await pushToTally({ bizId, ids: todo.map(x => x.id), dates: Object.fromEntries(todo.map(x => [x.id, x.date])), company: t.company, port: t.port, educational: t.educational });
    const what = todo.length === 1 ? todo[0].entry_no : `${todo.length} entries`;
    say(r.ok > 0 && !r.failed, r.ok && !r.failed ? `Auto-push: ${what} sent to Tally (${t.company}).` : `Auto-push (${what}): ${r.message}`);
  } catch (e) { say(false, `Auto-push stopped: ${e instanceof Error ? e.message : "error"}`); } finally { running = false; }
}

// The open business first, then every other business on this computer with Auto-push on — each pushed to its own
// Tally company (the push checks that company is open in Tally first). One business at a time.
// Tally answers one request at a time and freezes when they pile up. So: only ONE open FreWork tab checks (a lock
// shared by the tabs), never while this tab is already talking to Tally, and other businesses only every 5 minutes.
const TAB = Math.random().toString(36).slice(2);
const LOCK = "fw_tally_catchup_lock";
let othersAt = 0;
const OTHERS_MS = 5 * 60 * 1000;
function holdLock(): boolean {
  try {
    const now = Date.now();
    const l = JSON.parse(localStorage.getItem(LOCK) ?? "null") as { tab: string; at: number } | null;
    if (l && l.tab !== TAB && now - l.at < 120000) return false;   // another tab is checking (lock lapses after 2 min)
    localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, at: now }));
    return true;
  } catch { return true; }
}
async function catchUpAll(bizId: string | null | undefined, t: TallyState) {
  if (t.status !== "connected" || tallyQueueBusy() || !holdLock()) return;
  if (bizId && t.company) await catchUp(bizId, t);
  if (Date.now() - othersAt < OTHERS_MS) return;
  othersAt = Date.now();
  for (const o of tallyAutoPushBusinesses()) if (o.bizId !== bizId && !tallyQueueBusy()) await catchUp(o.bizId, { ...t, company: o.company }, true);
}

export function useTallyAutoCatchUp(bizId: string | null | undefined, t: TallyState) {
  const ref = useRef(t); ref.current = t;
  useEffect(() => {
    if (t.status !== "connected") return;
    if (bizId && t.company && tallyAutoPushOn(bizId) && !announced.has(bizId)) { announced.add(bizId); say(true, `Auto-push is watching for new entries (WhatsApp too) → Tally "${t.company}".`); }
    void catchUpAll(bizId, ref.current);
    const id = setInterval(() => void catchUpAll(bizId, ref.current), 45000);
    return () => clearInterval(id);
  }, [bizId, t.status, t.company]);
}
