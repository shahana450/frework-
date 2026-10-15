"use client";
// Auto-push catch-up: entries posted where Tally can't be reached (WhatsApp, another device) are pushed by any open
// FreWork finance page once Tally is connected here and Auto-push is on. Only entries posted after it was switched on.
import { useEffect, useRef } from "react";
import { tallyAutoPushOn, tallyAutoPushSince, type TallyState } from "@/lib/tallyConnection";
import { pushToTally, loadPushStatus } from "@/lib/tallyPushRun";

let running = false;
const announced = new Set<string>();
export const AUTO_PUSH_EVENT = "fw:tally-autopush";   // detail: { text: string; ok: boolean }

const say = (ok: boolean, text: string) => window.dispatchEvent(new CustomEvent(AUTO_PUSH_EVENT, { detail: { ok, text } }));

async function catchUp(bizId: string, t: TallyState) {
  if (running || !tallyAutoPushOn(bizId) || t.status !== "connected" || !t.company) return;
  running = true;
  try {
    // Server lists posted entries (30 s grace) with no push record; this browser's own record is checked too
    const res = await fetch(`/api/finance/tally-autopush?business_id=${bizId}&since=${encodeURIComponent(tallyAutoPushSince(bizId))}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { say(false, `Auto-push couldn't check for new entries: ${d.error ?? res.status}`); return; }
    const status = await loadPushStatus(bizId);
    const todo = ((d.todo ?? []) as { id: string; date: string; entry_no: string }[]).filter(r => !status[r.id]);
    if (!todo.length) return;
    const r = await pushToTally({ bizId, ids: todo.map(x => x.id), dates: Object.fromEntries(todo.map(x => [x.id, x.date])), company: t.company, port: t.port, educational: t.educational });
    const what = todo.length === 1 ? todo[0].entry_no : `${todo.length} entries`;
    say(r.ok > 0 && !r.failed, r.ok && !r.failed ? `Auto-push: ${what} sent to Tally (${t.company}).` : `Auto-push (${what}): ${r.message}`);
  } catch (e) { say(false, `Auto-push stopped: ${e instanceof Error ? e.message : "error"}`); } finally { running = false; }
}

export function useTallyAutoCatchUp(bizId: string | null | undefined, t: TallyState) {
  const ref = useRef(t); ref.current = t;
  useEffect(() => {
    if (!bizId || t.status !== "connected" || !t.company) return;
    if (tallyAutoPushOn(bizId) && !announced.has(bizId)) { announced.add(bizId); say(true, `Auto-push is watching for new entries (WhatsApp too) → Tally "${t.company}".`); }
    void catchUp(bizId, ref.current);
    const id = setInterval(() => void catchUp(bizId, ref.current), 45000);
    return () => clearInterval(id);
  }, [bizId, t.status, t.company]);
}
