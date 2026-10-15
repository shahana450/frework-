"use client";
// Auto-push catch-up: entries posted where Tally can't be reached (WhatsApp, another device) are pushed by any open
// FreWork finance page once Tally is connected here and Auto-push is on. Only entries posted after it was switched on.
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { tallyAutoPushOn, tallyAutoPushSince, type TallyState } from "@/lib/tallyConnection";
import { pushToTally, loadPushStatus } from "@/lib/tallyPushRun";

let running = false;

async function catchUp(bizId: string, t: TallyState) {
  if (running || !tallyAutoPushOn() || t.status !== "connected" || !t.company) return;
  running = true;
  try {
    // Two minutes' grace so an entry FreBook is pushing right now isn't sent twice
    const before = new Date(Date.now() - 120000).toISOString();
    const { data } = await supabase.from("fw_fin_journals").select("id,date,source,created_at")
      .eq("business_id", bizId).eq("status", "posted").gte("created_at", tallyAutoPushSince()).lte("created_at", before)
      .order("created_at").limit(50);
    const rows = ((data ?? []) as { id: string; date: string; source: string | null }[])
      .filter(r => r.source !== "tally_import" && r.source !== "opening_balances");
    if (!rows.length) return;
    const status = await loadPushStatus(bizId);
    const todo = rows.filter(r => !status[r.id]);   // never pushed (failed ones wait for a manual push)
    if (!todo.length) return;
    await pushToTally({ bizId, ids: todo.map(r => r.id), dates: Object.fromEntries(todo.map(r => [r.id, r.date])), company: t.company, port: t.port, educational: t.educational });
  } catch { /* tries again next minute */ } finally { running = false; }
}

export function useTallyAutoCatchUp(bizId: string | null | undefined, t: TallyState) {
  const ref = useRef(t); ref.current = t;
  useEffect(() => {
    if (!bizId || t.status !== "connected" || !t.company) return;
    void catchUp(bizId, ref.current);
    const id = setInterval(() => void catchUp(bizId, ref.current), 60000);
    return () => clearInterval(id);
  }, [bizId, t.status, t.company]);
}
