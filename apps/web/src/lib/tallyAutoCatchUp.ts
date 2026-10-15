"use client";
// Auto-push catch-up: entries posted where Tally can't be reached (WhatsApp, another device) are pushed by any open
// FreWork finance page once Tally is connected here and Auto-push is on. Only entries posted after it was switched on.
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { tallyAutoPushOn, tallyAutoPushSince, type TallyState } from "@/lib/tallyConnection";
import { pushToTally, loadPushStatus } from "@/lib/tallyPushRun";

let running = false;
export const AUTO_PUSH_EVENT = "fw:tally-autopush";   // detail: { text: string; ok: boolean }

async function catchUp(bizId: string, t: TallyState) {
  if (running || !tallyAutoPushOn(bizId) || t.status !== "connected" || !t.company) return;
  running = true;
  try {
    // A short grace so an entry FreBook is pushing right now isn't picked up as well
    const before = new Date(Date.now() - 30000).toISOString();
    const { data, error } = await supabase.from("fw_fin_journals").select("id,date,entry_no,source")
      .eq("business_id", bizId).eq("status", "posted").gte("created_at", tallyAutoPushSince(bizId)).lte("created_at", before)
      .order("created_at").limit(50);
    if (error) { console.warn("auto-push: couldn't read entries", error.message); return; }
    const rows = ((data ?? []) as { id: string; date: string; entry_no: string; source: string | null }[])
      .filter(r => r.source !== "tally_import" && r.source !== "opening_balances");
    if (!rows.length) return;
    const status = await loadPushStatus(bizId);
    const todo = rows.filter(r => !status[r.id]);   // never pushed (failed ones wait for a manual push)
    if (!todo.length) return;
    const r = await pushToTally({ bizId, ids: todo.map(x => x.id), dates: Object.fromEntries(todo.map(x => [x.id, x.date])), company: t.company, port: t.port, educational: t.educational });
    const what = todo.length === 1 ? todo[0].entry_no : `${todo.length} entries`;
    window.dispatchEvent(new CustomEvent(AUTO_PUSH_EVENT, { detail: {
      ok: r.ok > 0 && !r.failed,
      text: r.ok && !r.failed ? `Auto-push: ${what} sent to Tally (${t.company}).` : `Auto-push: ${r.message}`,
    } }));
  } catch (e) { console.warn("auto-push catch-up", e); } finally { running = false; }
}

export function useTallyAutoCatchUp(bizId: string | null | undefined, t: TallyState) {
  const ref = useRef(t); ref.current = t;
  useEffect(() => {
    if (!bizId || t.status !== "connected" || !t.company) return;
    void catchUp(bizId, ref.current);
    const id = setInterval(() => void catchUp(bizId, ref.current), 45000);
    return () => clearInterval(id);
  }, [bizId, t.status, t.company]);
}
