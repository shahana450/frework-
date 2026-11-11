"use client";
// Automatic Tally → FreBook sync, while any FreBook tab is open and Tally is connected: every 10 minutes the current
// financial year is read change-only (vouchers created or altered since the last sync, by AlterID) and imported.
// One tab at a time (shared lock), never while another Tally request is running. Per business, on this computer.
import { useEffect, useRef } from "react";
import { tallyFetch, tallyQueueBusy, alterIdIndexXml, alterIdsInRange, vouchersByAlterIdXml, parseTallyVouchers } from "@/lib/tallyUtils";
import { readTallyLedgerGroups, importTallyVouchers } from "@/lib/integrations/tallyClient";
import { pullPartyGstins } from "@/lib/tallyPartyGstin";
import { tallyBusy, type TallyState } from "@/lib/tallyConnection";

const ON = "fw_tally_autosync";          // `${ON}:${bizId}` = "1" when switched on
const LOCK = "fw_tally_autosync_lock";
const EVERY_MS = 10 * 60 * 1000;
export const AUTOSYNC_EVENT = "fw:tally-autosync";   // detail: { ok: boolean; text: string; at: number }
const TAB = Math.random().toString(36).slice(2);

export const tallyAutoSyncOn = (bizId: string) => { try { return localStorage.getItem(`${ON}:${bizId}`) === "1"; } catch { return false; } };
export const setTallyAutoSync = (bizId: string, on: boolean) => { try { if (on) localStorage.setItem(`${ON}:${bizId}`, "1"); else localStorage.removeItem(`${ON}:${bizId}`); } catch { /* */ } };
export const lastAutoSync = (bizId: string): { ok: boolean; text: string; at: number } | null => { try { return JSON.parse(localStorage.getItem(`${ON}:last:${bizId}`) ?? "null"); } catch { return null; } };

/** The key the Tally page and this sync share for "how far we got" */
export const alterKey = (bizId: string, company: string, from: string, to: string) => `fw_tally_alter:${bizId}:${company.toLowerCase().replace(/[^a-z0-9]/g, "")}:${from}:${to}`;

const fyNow = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return { from: `${y}-04-01`, to: `${y + 1}-03-31` }; };

function holdLock(): boolean {
  try {
    const l = JSON.parse(localStorage.getItem(LOCK) ?? "null") as { tab: string; at: number } | null;
    if (l && l.tab !== TAB && Date.now() - l.at < 15 * 60 * 1000) return false;
    localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, at: Date.now() }));
    return true;
  } catch { return true; }
}
const release = () => { try { const l = JSON.parse(localStorage.getItem(LOCK) ?? "null"); if (l?.tab === TAB) localStorage.removeItem(LOCK); } catch { /* */ } };

/** One change-only sync of the current year. Returns what happened, in words. */
export async function syncTallyOnce(bizId: string, t: TallyState, period = fyNow()): Promise<{ ok: boolean; text: string }> {
  const url = `http://localhost:${t.port}`, company = t.company;
  const key = alterKey(bizId, company, period.from, period.to);
  const all = alterIdsInRange(await (await tallyFetch(url, alterIdIndexXml(period.from, period.to, company), 120000)).text(), period.from, period.to);
  const last = Number(localStorage.getItem(key) ?? 0) || 0;
  // The first full read of a year is done from the Tally page (it shows progress); automatic sync only follows changes
  if (!last) return { ok: false, text: "Tally sync: import this year once from the Tally page, then changes come across automatically." };
  const ids = all.filter(a => a > last);
  if (!ids.length) return { ok: true, text: "Tally: up to date." };
  const vouchers: ReturnType<typeof parseTallyVouchers> = [];
  const seen = new Set<string>();
  let size = 300;
  for (let i = 0; i < ids.length;) {
    const j = Math.min(i + size, ids.length);
    try {
      for (const v of parseTallyVouchers(await (await tallyFetch(url, vouchersByAlterIdXml(ids[i], ids[j - 1], period.from, period.to, company), 90000)).text())) {
        const k = v.guid || v.remoteId || `${v.date}|${v.voucherType}|${v.voucherNumber}`;
        if (!seen.has(k) && v.date >= period.from && v.date <= period.to) { seen.add(k); vouchers.push(v); }
      }
      i = j;
    } catch (e) { if (size > 50) { size = Math.floor(size / 2); continue; } throw e; }
  }
  const groups = await readTallyLedgerGroups(url, company);
  const sum = await importTallyVouchers(bizId, vouchers as never, { ledgerGroups: groups, company });
  // Once a day: parties' GSTINs from Tally, so GSTR-1 shows their sales as B2B without a manual step
  try {
    const k = `fw_tally_gstin_day:${bizId}`, today = new Date().toLocaleDateString("en-CA");
    if (localStorage.getItem(k) !== today) { await pullPartyGstins(url, bizId, company ?? null); localStorage.setItem(k, today); }
  } catch { /* never stops the sync */ }
  if (!sum.failedCount && all.length) localStorage.setItem(key, String(all[all.length - 1]));
  const parts = [sum.imported && `${sum.imported} new`, sum.repaired && `${sum.repaired} updated`].filter(Boolean).join(", ");
  return { ok: !sum.failedCount, text: `Tally sync: ${parts || "no changes"}${sum.failedCount ? ` · ${sum.failedCount} couldn't be imported (open the Tally page)` : ""}.` };
}

/** Runs the automatic sync for the open business while Tally is connected and auto-sync is on. */
export function useTallyAutoSync(bizId: string | null | undefined, t: TallyState) {
  const ref = useRef(t); ref.current = t;
  useEffect(() => {
    if (!bizId || t.status !== "connected" || !t.company) return;
    const run = async () => {
      const s = ref.current;
      if (!tallyAutoSyncOn(bizId) || s.status !== "connected" || !s.company || tallyBusy() || tallyQueueBusy() || document.visibilityState !== "visible") return;
      const lastAt = lastAutoSync(bizId)?.at ?? 0;
      if (Date.now() - lastAt < EVERY_MS - 5000 || !holdLock()) return;
      let res: { ok: boolean; text: string };
      try { res = await syncTallyOnce(bizId, s); } catch (e) { res = { ok: false, text: `Tally sync stopped: ${e instanceof Error ? e.message : "error"}` }; }
      finally { release(); }
      const rec = { ...res, at: Date.now() };
      try { localStorage.setItem(`${ON}:last:${bizId}`, JSON.stringify(rec)); } catch { /* */ }
      window.dispatchEvent(new CustomEvent(AUTOSYNC_EVENT, { detail: rec }));
    };
    const first = setTimeout(run, 20000);   // give the page and Tally a moment first
    const id = setInterval(run, 60000);     // checks each minute; syncs when 10 minutes have passed
    return () => { clearTimeout(first); clearInterval(id); };
  }, [bizId, t.status, t.company]);
}
